import pool from "./db";
import { sendPriceAlert } from "./mailer";
import { scrapeProduct } from "./scrape";

export interface WatchRow {
  alert_id: number;
  target_price: string;
  email: string;
  product_id: number;
  url: string;
  name: string | null;
  current_price: string | null;
}

export interface CheckSummary {
  products: number;
  updated: number;
  notified: number;
  failed: number;
}

/** Regroupe les alertes par produit pour ne scraper chaque URL qu'une fois. */
export function groupByProduct(rows: readonly WatchRow[]): Map<number, WatchRow[]> {
  return rows.reduce((groups, row) => {
    const existing = groups.get(row.product_id) ?? [];
    return new Map(groups).set(row.product_id, [...existing, row]);
  }, new Map<number, WatchRow[]>());
}

/** `pg` renvoie les DECIMAL en string : on compare en centimes. */
export function hasPriceChanged(previous: string | null, next: number): boolean {
  if (previous === null) return true;
  return Math.round(Number(previous) * 100) !== Math.round(next * 100);
}

export function shouldNotify(price: number, targetPrice: string): boolean {
  return price <= Number(targetPrice);
}

async function recordPrice(
  productId: number,
  price: number,
  inStock: boolean | null,
): Promise<void> {
  await pool.query(
    `INSERT INTO price_history (product_id, price, in_stock) VALUES ($1, $2, $3)`,
    [productId, price, inStock],
  );
  await pool.query(
    `UPDATE products SET current_price = $1, in_stock = COALESCE($2, in_stock) WHERE id = $3`,
    [price, inStock, productId],
  );
}

async function notify(alert: WatchRow, price: number): Promise<void> {
  await sendPriceAlert(
    alert.email,
    alert.name ?? "Produit",
    price,
    Number(alert.target_price),
    alert.url,
  );
  // Une alerte déclenchée n'est plus renvoyée tant qu'elle n'est pas réarmée
  await pool.query(`UPDATE alerts SET notified_at = NOW() WHERE id = $1`, [
    alert.alert_id,
  ]);
}

/** Traite un produit ; renvoie null si le scrape n'a pas donné de prix. */
async function checkProduct(
  productId: number,
  alerts: readonly WatchRow[],
): Promise<{ updated: boolean; notified: number } | null> {
  const { url, current_price } = alerts[0];
  const result = await scrapeProduct(url);

  if (!result.ok || result.product.price === null) {
    console.warn(`[cron] ${url} ignoré : ${result.ok ? "prix introuvable" : result.error}`);
    return null;
  }

  const { price, in_stock } = result.product;
  const updated = hasPriceChanged(current_price, price);
  if (updated) await recordPrice(productId, price, in_stock);

  let notified = 0;
  for (const alert of alerts.filter((a) => shouldNotify(price, a.target_price))) {
    try {
      await notify(alert, price);
      notified += 1;
    } catch (error) {
      console.error(`[cron] alerte ${alert.alert_id} non envoyée :`, error);
    }
  }
  return { updated, notified };
}

export async function checkPrices(): Promise<CheckSummary> {
  const { rows } = await pool.query<WatchRow>(`
    SELECT a.id AS alert_id, a.target_price, u.email,
           p.id AS product_id, p.url, p.name, p.current_price
    FROM alerts a
    JOIN users u ON a.user_id = u.id
    JOIN products p ON a.product_id = p.id
    WHERE a.notified_at IS NULL
  `);

  const groups = groupByProduct(rows);
  let updated = 0;
  let notified = 0;
  let failed = 0;

  // Séquentiel volontairement : un seul Chromium à la fois côté scraper,
  // et moins de chances de déclencher le CAPTCHA Amazon.
  for (const [productId, alerts] of groups) {
    try {
      const outcome = await checkProduct(productId, alerts);
      if (!outcome) {
        failed += 1;
        continue;
      }
      if (outcome.updated) updated += 1;
      notified += outcome.notified;
    } catch (error) {
      failed += 1;
      console.error(`[cron] produit ${productId} en échec :`, error);
    }
  }

  return { products: groups.size, updated, notified, failed };
}
