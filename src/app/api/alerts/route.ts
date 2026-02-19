import pool from "@/lib/db";
import { sendPriceAlert } from "@/lib/mailer";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log("Route alerts appelée");
  console.log("Body:", body);
  const { email, target_price, product } = body;

  // Créer l'utilisateur s'il n'existe pas
  const userResult = await pool.query(
    `INSERT INTO users (email) VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING *`,
    [email],
  );
  const user = userResult.rows[0];

  // Sauvegarder le produit s'il n'existe pas
  const productResult = await pool.query(
    `INSERT INTO products (url, name, current_price, in_stock, image)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(url) DO UPDATE SET current_price = EXCLUDED.current_price
     RETURNING *`,
    [
      product.url,
      product.name ?? "Produit sans nom",
      product.price,
      product.in_stock,
      product.image,
    ],
  );
  const savedProduct = productResult.rows[0];

  // Créer l'alerte
  await pool.query(
    `INSERT INTO alerts (user_id, product_id, target_price)
     VALUES ($1, $2, $3)`,
    [user.id, savedProduct.id, target_price],
  );
  await sendPriceAlert(
    email,
    product.name ?? "Produit sans nom",
    product.price,
    target_price,
    product.url,
  );

  return NextResponse.json({ success: true });
}
