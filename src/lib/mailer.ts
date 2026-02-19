import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPriceAlert(
  email: string,
  productName: string,
  currentPrice: number,
  targetPrice: number,
  productUrl: string,
) {
  await resend.emails.send({
    from: "Kairos <onboarding@resend.dev>",
    to: email,
    subject: `Prix baissé : ${productName}`,
    html: `
      <h2>Bonne nouvelle !</h2>
      <p>Le prix de <strong>${productName}</strong> est passé à <strong>${currentPrice}€</strong>.</p>
      <p>Ton prix cible était : ${targetPrice}€</p>
      <a href="${productUrl}">Voir le produit</a>
    `,
  });
}
