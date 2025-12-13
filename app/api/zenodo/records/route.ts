import { NextResponse } from "next/server";
import { fetchZenodoCommunityRecords } from "@/lib/zenodo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const size = Number(url.searchParams.get("size") || "24");
  const sort = url.searchParams.get("sort") || "newest";
  const q = url.searchParams.get("q");
  const community = url.searchParams.get("community") || undefined;

  try {
    const data = await fetchZenodoCommunityRecords({ community, page, size, sort, q });
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}

