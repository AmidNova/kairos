import { NextRequest, NextResponse } from "next/server";
import { extractProductInfo } from "@/lib/ai";

interface ScraperResponse {
  url: string;
  name: string | null;
  price: number | null;
  in_stock: boolean | null;
  image: string | null;
  status: "ok" | "missing_data" | "captcha";
  html?: string;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL manquante" }, { status: 400 });
  }

  const response = await fetch(
    `${process.env.PYTHON_SCRAPER_URL}/scrape?url=${encodeURIComponent(url)}`,
  );

  if (!response.ok) {
    return NextResponse.json({ error: "Scraping échoué" }, { status: 500 });
  }

  const data: ScraperResponse = await response.json();

  if (data.status === "captcha") {
    return NextResponse.json(
      { error: "Amazon a affiché un CAPTCHA, réessaie plus tard" },
      { status: 503 },
    );
  }

  // Fallback IA : le parser DOM n'a pas trouvé les infos clés,
  // on demande à Gemini d'extraire depuis le HTML brut.
  if (data.status === "missing_data" && data.html) {
    const aiResult = await extractProductInfo(data.html);
    if (aiResult) {
      return NextResponse.json({
        url: data.url,
        name: aiResult.name ?? data.name,
        price: aiResult.price ?? data.price,
        in_stock: aiResult.in_stock ?? data.in_stock ?? true,
        image: aiResult.image ?? data.image,
        source: "ai_fallback" as const,
      });
    }
  }

  return NextResponse.json({
    url: data.url,
    name: data.name,
    price: data.price,
    in_stock: data.in_stock ?? true,
    image: data.image,
    source: "dom_parser" as const,
  });
}
