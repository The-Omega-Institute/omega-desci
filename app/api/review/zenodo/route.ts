import { NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/server/rateLimit";
import { fetchZenodoRecordById } from "@/lib/zenodo";
import type { OmegaReviewArtifactV1 } from "@/lib/review/protocol/types";

export const runtime = "nodejs";

type RequestBody = {
  url: string;
  userContext?: string;
  engine?: "auto" | "simulated";
};

function extractZenodoId(input: string) {
  const text = (input || "").trim();
  if (!text) return null;

  if (/^\d+$/.test(text)) return text;

  const m0 = text.match(/^zenodo:(\d+)$/i);
  if (m0) return m0[1];

  const m1 = text.match(/10\.5281\/zenodo\.(\d+)/i);
  if (m1) return m1[1];

  const m2 = text.match(/zenodo\.org\/(?:records|record)\/(\d+)/i);
  if (m2) return m2[1];

  const m3 = text.match(/zenodo\.org\/api\/records\/(\d+)/i);
  if (m3) return m3[1];

  const m4 = text.match(/zenodo\.org\/communities\/[^/]+\/(?:records|record)\/(\d+)/i);
  if (m4) return m4[1];

  const m5 = text.match(/zenodo\.(\d+)/i);
  if (m5) return m5[1];

  return null;
}

async function postJson<T>(url: URL, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Upstream error (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function POST(request: Request) {
  const rl = applyRateLimit(request, { key: "review_zenodo_v1", limit: 20, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded.", resetAt: rl.resetAt }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }

  let body: RequestBody | null = null;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const url = (body?.url || "").trim();
  if (!url) return NextResponse.json({ error: "Missing url." }, { status: 400 });

  const zenodoId = extractZenodoId(url);
  if (!zenodoId) return NextResponse.json({ error: "Could not extract Zenodo record id from input." }, { status: 400 });

  const userContext = (body?.userContext || "").trim();
  const engine = body?.engine || "auto";

  try {
    const paper = await fetchZenodoRecordById(zenodoId);

    const origin = new URL(request.url);
    const engineUrl = new URL("/api/review/engine", origin);
    const { artifact } = await postJson<{ artifact: OmegaReviewArtifactV1 }>(engineUrl, {
      paper,
      evidencePointers: [],
      claimEvidence: [],
      userContext,
      engine,
      enqueueReproQueue: false,
    });

    const hashHex = artifact.hash.replace("sha256:", "");
    const cardPath = `/card/${encodeURIComponent(hashHex)}`;
    const cardUrl = new URL(cardPath, origin).toString();
    const embedHtml = `<iframe src=\"${cardUrl}?embed=1\" style=\"width:100%;max-width:720px;height:560px;border:0\" loading=\"lazy\" referrerpolicy=\"no-referrer\"></iframe>`;

    return NextResponse.json(
      {
        zenodoId,
        paper,
        artifact,
        cardUrl,
        embedHtml,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate review card.";
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

