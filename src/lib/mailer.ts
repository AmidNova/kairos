import { Resend } from "resend";
import { escapeHtml } from "./html";

const MAIL_FROM = process.env.MAIL_FROM ?? "Kairos <onboarding@resend.dev>";

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY manquante");
    client = new Resend(apiKey);
  }
  return client;
}

export async function sendPriceAlert(
  email: string,
  productName: string,
  currentPrice: number,
  targetPrice: number,
  productUrl: string,
): Promise<void> {
  const name = escapeHtml(productName);
  const { error } = await getClient().emails.send({
    from: MAIL_FROM,
    to: email,
    subject: `Prix baissé : ${productName.slice(0, 80)}`,
    html: `
      <h2>Bonne nouvelle !</h2>
      <p>Le prix de <strong>${name}</strong> est passé à <strong>${currentPrice.toFixed(2)}€</strong>.</p>
      <p>Ton prix cible était : ${targetPrice.toFixed(2)}€</p>
      <a href="${escapeHtml(productUrl)}">Voir le produit</a>
    `,
  });

  if (error) {
    throw new Error(`Envoi email échoué : ${error.message}`);
  }
}
