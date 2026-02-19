import pool from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, name, price, in_stock, image } = body;

  const result = await pool.query(
    `INSERT INTO products (url, name, current_price, in_stock, image)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [url, name, price, in_stock, image],
  );

  return NextResponse.json(result.rows[0]);
}
