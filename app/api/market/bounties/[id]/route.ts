import { NextResponse } from "next/server";
import { getBounty } from "@/lib/server/market";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const id = (params.id || "").trim();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const bounty = await getBounty(id);
  if (!bounty) return NextResponse.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });

  return NextResponse.json({ bounty }, { headers: { "Cache-Control": "no-store" } });
}

