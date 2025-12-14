import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Separator } from "@/components/ui/shadcn";
import { getArtifact } from "@/lib/server/artifacts";
import { EmbedChrome } from "@/components/card/EmbedChrome";

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export async function generateMetadata({ params }: { params: { hash: string } }): Promise<Metadata> {
  const hashParam = (params.hash || "").trim();
  const hash = hashParam.startsWith("sha256:") ? hashParam : `sha256:${hashParam}`;
  const artifact = await getArtifact(hash);
  if (!artifact) return { title: "Omega Review Card", description: "Artifact not found." };

  const title = artifact.payload.paper.title || "Omega Review Card";
  const desc = `Structured epistemic review card · ${artifact.hash.slice(0, 18)}…`;
  return {
    title,
    description: desc,
    openGraph: { title, description: desc, type: "article" },
    twitter: { card: "summary", title, description: desc },
  };
}

export default async function ReviewCardPage({ params }: { params: { hash: string } }) {
  const hashParam = (params.hash || "").trim();
  const hash = hashParam.startsWith("sha256:") ? hashParam : `sha256:${hashParam}`;
  const artifact = await getArtifact(hash);
  if (!artifact) return notFound();

  const paper = artifact.payload.paper;
  const claims = artifact.payload.claims || [];
  const evidence = artifact.payload.evidence || [];
  const tests = artifact.payload.tests || [];
  const tasks = artifact.payload.tasks || [];
  const flags = artifact.payload.riskFlags || [];

  const counts = tests.reduce(
    (acc, t) => {
      const s = (t.status || "needs_evidence") as string;
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const bountyTasks = tasks.filter((t) => (t as { kind?: string }).kind === "reproduction_ticket").slice(0, 3) as Array<
    { id: string; kind: string; status: string; detail?: string; rewardELF?: number; stakeELF?: number; claim?: string; controversyScore?: number }
  >;

  return (
    <div className="container py-10">
      <EmbedChrome />

      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-zinc-600">OMEGA_REVIEW_CARD</div>
                <CardTitle className="text-zinc-100">{paper.title}</CardTitle>
                <div className="text-sm text-zinc-400 break-words">
                  {paper.doi ? <span className="font-mono text-zinc-500">ID:</span> : null}{" "}
                  <span className="font-mono text-zinc-300">{paper.doi || paper.id}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="muted" className="font-mono text-[10px]">
                  {paper.importedFrom?.toUpperCase?.() || "SOURCE"}
                </Badge>
                <div className="text-[10px] font-mono text-zinc-600">HASH</div>
                <div className="text-xs font-mono text-zinc-400 break-all">{artifact.hash}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="muted" className="font-mono text-[10px]">
                CREATED: {fmt(artifact.createdAt)}
              </Badge>
              <Badge variant="muted" className="font-mono text-[10px]">
                CLAIMS: {claims.length}
              </Badge>
              <Badge variant="muted" className="font-mono text-[10px]">
                EVIDENCE: {evidence.length}
              </Badge>
              <Badge variant="muted" className="font-mono text-[10px]">
                TESTS: {tests.length}
              </Badge>
              <Badge variant={flags.some((f) => f.severity === "high") ? "destructive" : "amber"} className="font-mono text-[10px]">
                RISK_FLAGS: {flags.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {paper.abstract ? (
              <div className="border border-zinc-800 bg-black/30 p-4">
                <div className="text-[10px] font-mono text-zinc-600 mb-2">ABSTRACT</div>
                <div className="text-sm text-zinc-300 leading-relaxed">{paper.abstract}</div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["pass", "needs_evidence", "fail", "na"].map((k) => (
                <div key={k} className="border border-zinc-800 bg-black/20 p-3">
                  <div className="text-[10px] font-mono text-zinc-600">{k.toUpperCase()}</div>
                  <div className="text-2xl font-mono text-emerald-500">{counts[k] || 0}</div>
                </div>
              ))}
            </div>

            <Separator className="bg-zinc-800" />

            <div className="space-y-3">
              <div className="text-xs font-mono text-emerald-500">TOP_CLAIMS</div>
              {claims.length ? (
                <div className="space-y-3">
                  {claims.slice(0, 6).map((c) => (
                    <div key={c.id} className="border border-zinc-800 bg-black/20 p-4">
                      <div className="text-[10px] font-mono text-zinc-600 mb-1">{c.id}</div>
                      <div className="text-sm text-zinc-200">{c.claim}</div>
                      {c.sourceRef ? <div className="mt-1 text-xs font-mono text-zinc-500">SOURCE_REF: {c.sourceRef}</div> : null}
                      <div className="mt-2 text-xs font-mono text-zinc-600">EVIDENCE_IDS: {(c.evidenceIds || []).length}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-zinc-600 italic">No structured claims extracted (record-level info only).</div>
              )}
            </div>

            {flags.length ? (
              <div className="space-y-3">
                <div className="text-xs font-mono text-emerald-500">RISK_LABELS</div>
                {flags.slice(0, 6).map((f) => (
                  <div key={f.id} className="border border-zinc-800 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={f.severity === "high" ? "destructive" : f.severity === "medium" ? "amber" : "muted"} className="font-mono text-[10px]">
                        {f.severity.toUpperCase()}
                      </Badge>
                      <div className="text-sm font-semibold text-zinc-100">{f.title}</div>
                    </div>
                    <div className="mt-2 text-sm text-zinc-400">{f.detail}</div>
                    <div className="mt-2 text-xs font-mono text-emerald-500 break-words">FIX: {f.fix}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {bountyTasks.length ? (
              <div className="space-y-3">
                <div className="text-xs font-mono text-emerald-500">BOUNTY_TASKS (TOP 3)</div>
                {bountyTasks.map((t) => (
                  <div key={t.id} className="border border-zinc-800 bg-black/20 p-4 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="text-[10px] font-mono text-zinc-600">{t.id}</div>
                        <div className="text-sm text-zinc-200">{t.detail || "Reproduction bounty"}</div>
                        {t.claim ? <div className="text-xs text-zinc-500">{t.claim}</div> : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="muted" className="font-mono text-[10px]">
                          STATUS: {t.status?.toUpperCase() || "OPEN"}
                        </Badge>
                        {typeof t.rewardELF === "number" ? (
                          <Badge variant="muted" className="font-mono text-[10px]">
                            REWARD: {t.rewardELF} ELF
                          </Badge>
                        ) : null}
                        {typeof t.stakeELF === "number" ? (
                          <Badge variant="muted" className="font-mono text-[10px]">
                            STAKE: {t.stakeELF} ELF
                          </Badge>
                        ) : null}
                        {typeof t.controversyScore === "number" ? (
                          <Badge variant="amber" className="font-mono text-[10px]">
                            CONTROVERSY: {t.controversyScore.toFixed(2)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-xs text-zinc-500">
                  Claim these in the bounty marketplace:{" "}
                  <Link href="/market" className="text-emerald-500 hover:underline font-mono">
                    /market
                  </Link>
                </div>
              </div>
            ) : null}

            <Separator className="bg-zinc-800" />

            <div className="space-y-2">
              <div className="text-xs font-mono text-emerald-500">EMBED</div>
              <div className="text-xs text-zinc-500">Use this iframe snippet in blogs/docs.</div>
              <pre className="bg-black/40 border border-zinc-800 p-3 text-xs text-zinc-300 overflow-auto">
{`<iframe src="${`/card/${artifact.hash.replace("sha256:", "")}?embed=1`}" style="width:100%;max-width:720px;height:560px;border:0" loading="lazy"></iframe>`}
              </pre>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href={`/api/artifacts/${encodeURIComponent(artifact.hash.replace("sha256:", ""))}`}>
                <Button variant="outline" className="border-zinc-700">
                  DOWNLOAD_JSON
                </Button>
              </Link>
              <Link href="/arxiv">
                <Button variant="emerald">GENERATE_NEW</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
