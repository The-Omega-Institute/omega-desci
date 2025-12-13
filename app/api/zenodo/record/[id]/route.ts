import { NextResponse } from "next/server";
import { fetchZenodoRecordById } from "@/lib/zenodo";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const paper = await fetchZenodoRecordById(params.id);
    return NextResponse.json(
      { paper },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}

