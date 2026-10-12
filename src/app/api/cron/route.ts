import { checkPrices } from "@/lib/scheduler";
import { NextRequest, NextResponse } from "next/server";

// Le cron scrape les produits un par un : on laisse de la marge
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET manquant — cron désactivé");
    return NextResponse.json({ error: "Cron non configuré" }, { status: 500 });
  }

  // Vercel Cron envoie `Authorization: Bearer $CRON_SECRET`
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const summary = await checkPrices();
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("[cron] échec global :", error);
    return NextResponse.json({ error: "Vérification échouée" }, { status: 500 });
  }
}
