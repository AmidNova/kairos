import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL manquante" }, { status: 400 });
  }

  const response = await fetch(
    `${process.env.PYTHON_SCRAPER_URL}/scrape?url=${encodeURIComponent(url)}`,
  );

  const data = await response.json();
  return NextResponse.json(data);
}
