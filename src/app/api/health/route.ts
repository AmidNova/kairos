import { NextResponse } from "next/server";

const HEALTH_TIMEOUT_MS = 3_000;

export async function GET() {
  const scraperUrl = process.env.PYTHON_SCRAPER_URL;
  if (!scraperUrl) {
    return NextResponse.json({ scraper: "down" });
  }

  try {
    const res = await fetch(`${scraperUrl}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      cache: "no-store",
    });
    return NextResponse.json({ scraper: res.ok ? "up" : "down" });
  } catch {
    return NextResponse.json({ scraper: "down" });
  }
}
