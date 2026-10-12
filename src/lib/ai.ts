import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";

export interface ExtractedProduct {
  name: string | null;
  price: number | null;
  in_stock: boolean | null;
  image: string | null;
}

const DEFAULT_MODEL = "gemini-3.5-flash";
const DEFAULT_BACKUP_MODEL = "gemini-3.5-flash-lite";

// Les modèles Gemini sont régulièrement en surcharge (503) ou retirés :
// on essaie le modèle principal puis un modèle de secours.
export const AI_MODELS: readonly string[] = [
  ...new Set([
    process.env.GEMINI_MODEL || DEFAULT_MODEL,
    process.env.GEMINI_BACKUP_MODEL || DEFAULT_BACKUP_MODEL,
  ]),
];

// Extraction de champs = pas besoin de raisonnement. MINIMAL n'est pas
// accepté par tous les modèles : on ne l'envoie qu'à ceux qu'on a validés.
const MINIMAL_THINKING_MODELS = new Set([DEFAULT_MODEL, DEFAULT_BACKUP_MODEL]);

// Un modèle surchargé peut ne jamais répondre : on coupe avant que le scan
// ne paraisse figé côté UI.
const AI_TIMEOUT_MS = 15_000;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

// Le scraper Python envoie déjà un HTML réduit (~30k chars), on garde une marge
const HTML_BUDGET = 40_000;

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const PROMPT = `Tu es un extracteur de données produit e-commerce.
À partir du HTML ci-dessous, retourne UNIQUEMENT un objet JSON valide avec ces champs :
{
  "name": string | null,
  "price": number | null,
  "in_stock": boolean | null,
  "image": string | null
}
- price : nombre décimal en euros, sans symbole ni espace (ex: 1299.99)
- image : URL absolue de l'image principale du produit
- Si une info est introuvable, mets null
HTML:
`;

function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function toExtractedProduct(raw: unknown): ExtractedProduct | null {
  if (typeof raw !== "object" || raw === null) return null;
  const parsed = raw as Record<string, unknown>;
  const price =
    typeof parsed.price === "number" && Number.isFinite(parsed.price) && parsed.price > 0
      ? parsed.price
      : null;

  return {
    name: typeof parsed.name === "string" ? parsed.name : null,
    price,
    in_stock: typeof parsed.in_stock === "boolean" ? parsed.in_stock : null,
    image: typeof parsed.image === "string" ? parsed.image : null,
  };
}

/** Surcharge, quota ou timeout : ça vaut le coup d'essayer un autre modèle. */
export function isRetryableAiError(error: unknown): boolean {
  if (error instanceof ApiError) return RETRYABLE_STATUS.has(error.status);
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function extractWith(client: GoogleGenAI, model: string, html: string) {
  const response = await client.models.generateContent({
    model,
    contents: PROMPT + html.slice(0, HTML_BUDGET),
    config: {
      responseMimeType: "application/json",
      temperature: 0,
      thinkingConfig: MINIMAL_THINKING_MODELS.has(model)
        ? { thinkingLevel: ThinkingLevel.MINIMAL }
        : undefined,
      abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
    },
  });
  const text = response.text;
  return text ? toExtractedProduct(JSON.parse(stripFences(text))) : null;
}

export async function extractProductInfo(
  html: string,
): Promise<ExtractedProduct | null> {
  if (!ai) {
    console.warn("GEMINI_API_KEY manquante — fallback IA désactivé");
    return null;
  }

  for (const model of AI_MODELS) {
    try {
      return await extractWith(ai, model, html);
    } catch (error) {
      const retryable = isRetryableAiError(error);
      console.error(
        `Fallback Gemini (${model}) échoué${retryable ? ", modèle suivant" : ""} :`,
        error instanceof Error ? error.message : error,
      );
      if (!retryable) return null;
    }
  }
  return null;
}
