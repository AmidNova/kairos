import { NextRequest, NextResponse } from "next/server";
import { scrapeProduct } from "@/lib/scrape";
import { isAllowedProductUrl } from "@/lib/validation";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL manquante" }, { status: 400 });
  }
  if (!isAllowedProductUrl(url)) {
    return NextResponse.json(
      { error: "Seules les URLs Amazon sont supportées" },
      { status: 400 },
    );
  }

  const result = await scrapeProduct(url);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.product);
}
