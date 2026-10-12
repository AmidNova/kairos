import pool from "@/lib/db";
import { parseAlertInput } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const input = parseAlertInput(body);
  if (!input.ok) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }
  const { email, targetPrice, product } = input.value;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userResult = await client.query<{ id: number }>(
      `INSERT INTO users (email) VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [email],
    );

    const productResult = await client.query<{ id: number }>(
      `INSERT INTO products (url, name, current_price, in_stock, image)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (url) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, products.name),
         current_price = COALESCE(EXCLUDED.current_price, products.current_price),
         in_stock = COALESCE(EXCLUDED.in_stock, products.in_stock),
         image = COALESCE(EXCLUDED.image, products.image)
       RETURNING id`,
      [product.url, product.name ?? "Produit sans nom", product.price, product.in_stock, product.image],
    );
    const productId = productResult.rows[0].id;

    // Le prix observé au scan devient un point d'historique s'il diffère du
    // dernier connu : current_price et price_history restent cohérents.
    if (product.price !== null) {
      await client.query(
        `INSERT INTO price_history (product_id, price, in_stock)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (
           SELECT 1 FROM (
             SELECT price FROM price_history
             WHERE product_id = $1 ORDER BY checked_at DESC LIMIT 1
           ) last
           WHERE last.price = $2
         )`,
        [productId, product.price, product.in_stock],
      );
    }

    // Réarmer une alerte existante remet le compteur à zéro
    await client.query(
      `INSERT INTO alerts (user_id, product_id, target_price)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id) DO UPDATE SET
         target_price = EXCLUDED.target_price,
         notified_at = NULL`,
      [userResult.rows[0].id, productId, targetPrice],
    );

    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Création d'alerte échouée :", error);
    return NextResponse.json(
      { error: "Impossible d'armer l'alerte" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
