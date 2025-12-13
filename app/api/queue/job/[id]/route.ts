import { NextResponse } from "next/server";
import { getJob } from "@/lib/server/queue";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: { id: string } }) {
  const id = (context.params.id || "").trim();
  if (!id) return NextResponse.json({ error: "Missing job id." }, { status: 400 });
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  return NextResponse.json(job, { headers: { "Cache-Control": "no-store" } });
}

