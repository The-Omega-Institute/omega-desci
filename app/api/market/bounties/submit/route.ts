import { NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/server/rateLimit";
import { submitBounty } from "@/lib/server/market";

export const runtime = "nodejs";

type RequestBody = {
  id: string;
  handle: string;
  result: "pass" | "fail";
  artifactUrl?: string;
  artifactHash?: string;
  notes?: string;
};

export async function POST(request: Request) {
  const rl = applyRateLimit(request, { key: "market_submit_v1", limit: 40, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded.", resetAt: rl.resetAt }, { status: 429, headers: { "Cache-Control": "no-store" } });

  let body: RequestBody | null = null;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const id = (body?.id || "").trim();
  const handle = (body?.handle || "").trim();
  const result = body?.result;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (!handle) return NextResponse.json({ error: "Missing handle." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (result !== "pass" && result !== "fail") {
    return NextResponse.json({ error: "Invalid result (must be pass|fail)." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const bounty = await submitBounty({
      id,
      handle,
      result,
      artifactUrl: body?.artifactUrl,
      artifactHash: body?.artifactHash,
      notes: body?.notes,
    });
    return NextResponse.json({ bounty }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submit failed.";
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}

