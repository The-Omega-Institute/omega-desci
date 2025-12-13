import { NextResponse } from "next/server";
import { listBounties } from "@/lib/server/market";

export const runtime = "nodejs";

export async function GET() {
  const bounties = await listBounties();
  return NextResponse.json({ bounties }, { headers: { "Cache-Control": "no-store" } });
}

