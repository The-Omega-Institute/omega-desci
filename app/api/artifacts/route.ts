import { NextResponse } from "next/server";
import { listArtifacts } from "@/lib/server/artifacts";

export const runtime = "nodejs";

export async function GET() {
  const artifacts = await listArtifacts();
  return NextResponse.json(
    {
      count: artifacts.length,
      artifacts: artifacts.map((a) => ({
        hash: a.hash,
        createdAt: a.createdAt,
        id: a.id,
        protocol: a.protocol,
        paperId: a.payload.paper.id,
        paperTitle: a.payload.paper.title,
        taskCount: Array.isArray(a.payload.tasks) ? a.payload.tasks.length : 0,
        bountyTasks: (Array.isArray(a.payload.tasks) ? a.payload.tasks : [])
          .filter((t) => (t as { kind?: string }).kind === "reproduction_ticket")
          .slice(0, 3),
        highRiskCount: (Array.isArray(a.payload.riskFlags) ? a.payload.riskFlags : []).filter((f) => f.severity === "high").length,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
