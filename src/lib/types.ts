export type ProductSource = "dom_parser" | "ai_fallback";

export interface ScrapedProduct {
  url: string;
  name: string | null;
  price: number | null;
  in_stock: boolean | null;
  image: string | null;
}

export interface Product extends ScrapedProduct {
  source: ProductSource;
}

export interface PricePoint {
  price: number;
  checked_at: string;
}
