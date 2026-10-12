import type { ScrapedProduct } from "./types";

// Garder synchro avec ALLOWED_HOSTS dans scraper/scraper.py
const ALLOWED_HOSTS = [
  "amazon.fr",
  "amazon.com",
  "amazon.de",
  "amazon.co.uk",
  "amazon.it",
  "amazon.es",
  "amazon.ca",
  "amazon.be",
  "amazon.nl",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_TARGET_PRICE = 1_000_000;

export function isAllowedProductUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase();
  return ALLOWED_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
}

export interface AlertInput {
  email: string;
  targetPrice: number;
  product: ScrapedProduct;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function optionalString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function optionalNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function isHttpsUrl(v: unknown): v is string {
  if (typeof v !== "string") return false;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

export function parseAlertInput(body: unknown): ParseResult<AlertInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Corps de requête invalide" };
  }
  const { email, target_price, product } = body as Record<string, unknown>;

  if (
    typeof email !== "string" ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(email.trim())
  ) {
    return { ok: false, error: "Email invalide" };
  }

  if (
    typeof target_price !== "number" ||
    !Number.isFinite(target_price) ||
    target_price <= 0 ||
    target_price > MAX_TARGET_PRICE
  ) {
    return { ok: false, error: "Prix cible invalide" };
  }

  if (typeof product !== "object" || product === null) {
    return { ok: false, error: "Produit manquant" };
  }
  const p = product as Record<string, unknown>;
  if (!isAllowedProductUrl(p.url)) {
    return { ok: false, error: "URL produit non supportée" };
  }

  return {
    ok: true,
    value: {
      email: email.trim().toLowerCase(),
      targetPrice: Math.round(target_price * 100) / 100,
      product: {
        url: p.url,
        name: optionalString(p.name),
        price: optionalNumber(p.price),
        in_stock: typeof p.in_stock === "boolean" ? p.in_stock : null,
        image: isHttpsUrl(p.image) ? p.image : null,
      },
    },
  };
}
