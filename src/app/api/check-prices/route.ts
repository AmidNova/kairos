import { checkPrices } from "@/lib/scheduler";
import { NextResponse } from "next/server";

export async function GET() {
  await checkPrices();
  return NextResponse.json({ success: true });
}
