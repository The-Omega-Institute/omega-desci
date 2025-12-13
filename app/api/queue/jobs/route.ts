import { NextResponse } from "next/server";
import { listJobs } from "@/lib/server/queue";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ jobs: listJobs() }, { headers: { "Cache-Control": "no-store" } });
}

