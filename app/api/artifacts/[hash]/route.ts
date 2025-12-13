import { NextResponse } from "next/server";
import { getArtifact } from "@/lib/server/artifacts";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: { hash: string } }) {
  const hashParam = (context.params.hash || "").trim();
  const hash = hashParam.startsWith("sha256:") ? hashParam : `sha256:${hashParam}`;
  const artifact = await getArtifact(hash);
  if (!artifact) return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
  return NextResponse.json(artifact, { headers: { "Cache-Control": "no-store" } });
}
