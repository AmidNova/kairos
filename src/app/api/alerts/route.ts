import pool from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, target_price, product } = body;

  const userResult = await pool.query(
    `INSERT INTO users (email) VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING *`,
    [email],
  );
  const user = userResult.rows[0];

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

  await pool.query(
    `INSERT INTO alerts (user_id, product_id, target_price)
     VALUES ($1, $2, $3)`,
    [user.id, savedProduct.id, target_price],
  );

  return NextResponse.json({ success: true });
}
