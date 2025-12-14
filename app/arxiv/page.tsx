"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/shadcn";
import { ExternalLink, Sparkles } from "lucide-react";

type ReviewCardResponse = {
  paper?: { title?: string; doi?: string; id?: string; importedFrom?: string };
  artifact?: { hash: string };
  cardUrl?: string;
  embedHtml?: string;
  error?: string;
};

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) {
    const message = (data as { error?: string })?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export default function ArxivReviewPage() {
  const [tab, setTab] = useState<"arxiv" | "zenodo">("arxiv");
  const [url, setUrl] = useState("");
  const [userContext, setUserContext] = useState("");
  const [engine, setEngine] = useState<"auto" | "simulated">("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewCardResponse | null>(null);

  const endpoint = tab === "arxiv" ? "/api/review/arxiv" : "/api/review/zenodo";
  const placeholder = tab === "arxiv" ? "https://arxiv.org/abs/2401.01234" : "10.5281/zenodo.1234567 or https://zenodo.org/records/1234567";

  const artifactHashHex = useMemo(() => {
    const hash = result?.artifact?.hash || "";
    return hash.replace(/^sha256:/, "");
  }, [result]);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await postJson<ReviewCardResponse>(endpoint, { url, userContext, engine });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate review card.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-zinc-600">AI_INITIAL_REVIEW_AS_A_SERVICE</div>
            <h1 className="text-2xl md:text-3xl font-serif text-zinc-100">Generate a structured Omega review card</h1>
            <p className="text-sm text-zinc-500">Paste an arXiv or Zenodo link and get a citeable artifact + embeddable card.</p>
            <p className="text-xs text-zinc-600 font-mono">
              AI_AUDIT_LINE_ONLY — AI reports are audit tools and do not decide Level upgrades; human open reviews do. / AI 审计线：AI 只做审计不做裁决，Level 升级由人类评审线决定。
            </p>
          </div>
          <Badge variant="emerald" className="font-mono text-[10px]">
            NO_BACKEND_DB • MOCK_FRIENDLY
          </Badge>
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-zinc-100 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Review Card Generator
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={engine === "auto" ? "emerald" : "outline"}
                  size="sm"
                  className={engine === "auto" ? "" : "border-zinc-700 text-zinc-300"}
                  onClick={() => setEngine("auto")}
                >
                  AUTO
                </Button>
                <Button
                  type="button"
                  variant={engine === "simulated" ? "emerald" : "outline"}
                  size="sm"
                  className={engine === "simulated" ? "" : "border-zinc-700 text-zinc-300"}
                  onClick={() => setEngine("simulated")}
                >
                  SIMULATED
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "arxiv" | "zenodo")}>
              <TabsList>
                <TabsTrigger value="arxiv">arXiv</TabsTrigger>
                <TabsTrigger value="zenodo">Zenodo</TabsTrigger>
              </TabsList>

              <TabsContent value="arxiv" className="space-y-4">
                <div className="text-xs font-mono text-zinc-600">INPUT_URL</div>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={placeholder} />
                <div className="text-xs font-mono text-zinc-600">CONTEXT (OPTIONAL)</div>
                <Input value={userContext} onChange={(e) => setUserContext(e.target.value)} placeholder="What should reviewers focus on? e.g. leakage, causal ID, OOD..." />
                <Button variant="emerald" className="w-full" onClick={() => void submit()} disabled={loading || !url.trim()}>
                  {loading ? "GENERATING..." : "GENERATE_REVIEW_CARD"}
                </Button>
              </TabsContent>

              <TabsContent value="zenodo" className="space-y-4">
                <div className="text-xs font-mono text-zinc-600">INPUT_ID / DOI / URL</div>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={placeholder} />
                <div className="text-xs font-mono text-zinc-600">CONTEXT (OPTIONAL)</div>
                <Input value={userContext} onChange={(e) => setUserContext(e.target.value)} placeholder="What should reviewers focus on? e.g. p-hacking, reproducibility..." />
                <Button variant="emerald" className="w-full" onClick={() => void submit()} disabled={loading || !url.trim()}>
                  {loading ? "GENERATING..." : "GENERATE_REVIEW_CARD"}
                </Button>
              </TabsContent>
            </Tabs>

            {error ? <div className="text-sm text-red-400 border border-red-900/40 bg-red-950/20 p-3">{error}</div> : null}

            {result?.cardUrl ? (
              <div className="space-y-4">
                <div className="border border-zinc-800 bg-black/20 p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-mono text-emerald-500">OUTPUT</div>
                    {result.paper?.importedFrom ? (
                      <Badge variant="muted" className="font-mono text-[10px]">
                        SOURCE: {String(result.paper.importedFrom).toUpperCase()}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-sm text-zinc-200">{result.paper?.title || "Review Card"}</div>
                  <div className="text-xs font-mono text-zinc-500 break-all">
                    HASH: <span className="text-zinc-300">{result.artifact?.hash}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <a href={result.cardUrl} target="_blank" rel="noreferrer">
                      <Button variant="outline" className="border-zinc-700">
                        OPEN_CARD <ExternalLink className="ml-2 h-3.5 w-3.5" />
                      </Button>
                    </a>
                    <Link href="/market">
                      <Button variant="outline" className="border-zinc-700">
                        OPEN_MARKET
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="border border-zinc-800 bg-black/20 p-4 space-y-3">
                  <div className="text-xs font-mono text-emerald-500">EMBED_HTML</div>
                  <pre className="bg-black/40 border border-zinc-800 p-3 text-xs text-zinc-300 overflow-auto">{result.embedHtml}</pre>
                </div>

                {artifactHashHex ? (
                  <div className="border border-zinc-800 bg-black/20 p-4 space-y-3">
                    <div className="text-xs font-mono text-emerald-500">PREVIEW</div>
                    <iframe
                      title="Omega Review Card Preview"
                      src={`/card/${encodeURIComponent(artifactHashHex)}?embed=1`}
                      style={{ width: "100%", maxWidth: 720, height: 560, border: 0 }}
                      loading="lazy"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
