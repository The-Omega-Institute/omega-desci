import { NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

function normalizeDoi(input: string) {
  const raw = (input || "").trim();
  if (!raw) return "";
  return raw
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/[)\].,;]+$/g, "")
    .trim();
}

function isValidDoi(doi: string) {
  return /^10\.\d{4,9}\/\S+$/i.test(doi);
}

type CslJson = {
  title?: string;
};

export async function GET(request: Request) {
  const rl = applyRateLimit(request, { key: "citation_doi_v1", limit: 60, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded.", resetAt: rl.resetAt }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }

  const url = new URL(request.url);
  const doi = normalizeDoi(url.searchParams.get("doi") || "");
  if (!doi) return NextResponse.json({ error: "Missing doi." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (!isValidDoi(doi)) return NextResponse.json({ error: "Invalid doi format." }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const doiUrl = new URL(`https://doi.org/${doi}`);

  try {
    const res = await fetch(doiUrl, {
      method: "GET",
      headers: { Accept: "application/vnd.citationstyles.csl+json" },
      redirect: "follow",
      cache: "no-store",
    });

    if (res.status === 404) {
      return NextResponse.json({ doi, exists: false, status: 404 }, { headers: { "Cache-Control": "no-store" } });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { doi, exists: null, status: res.status, error: text || res.statusText },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data = (await res.json().catch(() => null)) as CslJson | null;
    return NextResponse.json(
      { doi, exists: true, status: res.status, title: data?.title || undefined },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "DOI check failed.";
    return NextResponse.json({ doi, exists: null, status: null, error: message }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}

