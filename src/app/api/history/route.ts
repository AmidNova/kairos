import pool from "@/lib/db";
import type { PricePoint } from "@/lib/types";
import { isAllowedProductUrl } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

const MAX_POINTS = 48;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!isAllowedProductUrl(url)) {
    return NextResponse.json({ error: "URL invalide" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query<{ price: string; checked_at: Date }>(
      `SELECT h.price, h.checked_at
       FROM price_history h
       JOIN products p ON p.id = h.product_id
       WHERE p.url = $1
       ORDER BY h.checked_at DESC
       LIMIT $2`,
      [url, MAX_POINTS],
    );

    const points: PricePoint[] = rows
      .map((r) => ({ price: Number(r.price), checked_at: r.checked_at.toISOString() }))
      .reverse();
    return NextResponse.json({ points });
  } catch (error) {
    console.error("Lecture historique échouée :", error);
    return NextResponse.json({ error: "Historique indisponible" }, { status: 500 });
  }
}
