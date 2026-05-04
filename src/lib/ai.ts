import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ExtractedProduct {
  name: string | null;
  price: number | null;
  in_stock: boolean | null;
  image: string | null;
}

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const PROMPT = `Tu es un extracteur de données produit e-commerce.
À partir du HTML ci-dessous, retourne UNIQUEMENT un objet JSON valide (pas de markdown, pas de commentaire) avec ces champs :
{
  "name": string | null,
  "price": number | null,
  "in_stock": boolean | null,
  "image": string | null
}
- price : nombre décimal en euros, sans symbole ni espace
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

export async function extractProductInfo(
  html: string,
): Promise<ExtractedProduct | null> {
  if (!genAI) {
    console.warn("GEMINI_API_KEY manquante — fallback IA désactivé");
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(PROMPT + html.slice(0, 12000));
    const text = stripFences(result.response.text());
    const parsed = JSON.parse(text) as ExtractedProduct;

    return {
      name: typeof parsed.name === "string" ? parsed.name : null,
      price: typeof parsed.price === "number" ? parsed.price : null,
      in_stock: typeof parsed.in_stock === "boolean" ? parsed.in_stock : null,
      image: typeof parsed.image === "string" ? parsed.image : null,
    };
  } catch (error) {
    console.error("Fallback Gemini échoué :", error);
    return null;
  }
}
