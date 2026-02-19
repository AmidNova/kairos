import pool from "./db";
import { sendPriceAlert } from "./mailer";

export async function checkPrices() {
  const alerts = await pool.query(`
    SELECT a.id, a.target_price, a.user_id,
           u.email,
           p.id as product_id, p.url, p.name, p.current_price
    FROM alerts a
    JOIN users u ON a.user_id = u.id
    JOIN products p ON a.product_id = p.id
  `);

  for (const alert of alerts.rows) {
    const res = await fetch(
      `http://localhost:8000/scrape?url=${encodeURIComponent(alert.url)}`,
    );
    const data = await res.json();

    if (data.price && data.price !== alert.current_price) {
      await pool.query(
        `INSERT INTO price_history (product_id, price, in_stock) VALUES ($1, $2, $3)`,
        [alert.product_id, data.price, data.in_stock],
      );

      await pool.query(`UPDATE products SET current_price = $1 WHERE id = $2`, [
        data.price,
        alert.product_id,
      ]);
    }

    if (data.price && data.price <= alert.target_price) {
      await sendPriceAlert(
        alert.email,
        alert.name ?? "Produit",
        data.price,
        alert.target_price,
        alert.url,
      );
    }
  }
}
