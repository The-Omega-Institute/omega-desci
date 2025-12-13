import { NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/server/rateLimit";
import { arxivRecordToPaper, extractArxivId, fetchArxivRecord } from "@/lib/server/arxiv";
import type { OmegaReviewArtifactV1 } from "@/lib/review/protocol/types";

export const runtime = "nodejs";

type RequestBody = {
  url: string;
  userContext?: string;
  engine?: "auto" | "simulated";
};

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
  const rl = applyRateLimit(request, { key: "review_arxiv_v1", limit: 20, windowMs: 5 * 60 * 1000 });
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

  const arxivId = extractArxivId(url);
  if (!arxivId) return NextResponse.json({ error: "Could not extract arXiv id from url." }, { status: 400 });

  const userContext = (body?.userContext || "").trim();
  const engine = body?.engine || "auto";

  try {
    const record = await fetchArxivRecord(arxivId);
    const paper = arxivRecordToPaper(record);

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
        arxivId,
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

