import { extractProductInfo, type ExtractedProduct } from "./ai";
import type { Product } from "./types";

export interface ScraperResponse {
  url: string;
  name: string | null;
  price: number | null;
  in_stock: boolean | null;
  image: string | null;
  status: "ok" | "missing_data" | "captcha" | "not_found";
  html?: string;
}

export type ScrapeOutcome =
  | { ok: true; product: Product }
  | { ok: false; status: number; error: string };

const SCRAPER_TIMEOUT_MS = 90_000;

/**
 * Interroge le scraper Python puis, si le parser DOM n'a pas trouvé les
 * infos clés, bascule sur l'extraction Gemini depuis le HTML réduit.
 */
export async function scrapeProduct(url: string): Promise<ScrapeOutcome> {
  const scraperUrl = process.env.PYTHON_SCRAPER_URL;
  if (!scraperUrl) {
    console.error("PYTHON_SCRAPER_URL manquante");
    return { ok: false, status: 500, error: "Scraper non configuré" };
  }

  let response: Response;
  try {
    response = await fetch(
      `${scraperUrl}/scrape?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(SCRAPER_TIMEOUT_MS), cache: "no-store" },
    );
  } catch (error) {
    console.error("Scraper injoignable :", error);
    return { ok: false, status: 502, error: "Scraper injoignable" };
  }

  if (!response.ok) {
    return { ok: false, status: 502, error: "Scraping échoué" };
  }

  const data: ScraperResponse = await response.json();
  return resolveScrape(data, extractProductInfo);
}

type Extractor = (html: string) => Promise<ExtractedProduct | null>;

/**
 * Décide du résultat final à partir de la réponse du scraper.
 * Un tracker de prix sans prix n'a pas de sens : on échoue explicitement
 * plutôt que de renvoyer une fiche vide.
 */
export async function resolveScrape(
  data: ScraperResponse,
  extract: Extractor,
): Promise<ScrapeOutcome> {
  if (data.status === "captcha") {
    return {
      ok: false,
      status: 503,
      error: "Amazon a affiché un CAPTCHA, réessaie plus tard",
    };
  }
  if (data.status === "not_found") {
    return { ok: false, status: 404, error: "Produit introuvable sur Amazon" };
  }

  // Fallback IA : le parser DOM n'a pas trouvé les infos clés,
  // on demande à Gemini d'extraire depuis le HTML réduit.
  const aiResult =
    data.status === "missing_data" && data.html ? await extract(data.html) : null;

  const product: Product = aiResult
    ? {
        url: data.url,
        name: aiResult.name ?? data.name,
        price: aiResult.price ?? data.price,
        in_stock: aiResult.in_stock ?? data.in_stock ?? true,
        image: aiResult.image ?? data.image,
        source: "ai_fallback",
      }
    : {
        url: data.url,
        name: data.name,
        price: data.price,
        in_stock: data.in_stock ?? true,
        image: data.image,
        source: "dom_parser",
      };

  if (product.price === null) {
    return {
      ok: false,
      status: 422,
      error: "Prix introuvable sur cette page (parser DOM et fallback IA)",
    };
  }
  return { ok: true, product };
}
