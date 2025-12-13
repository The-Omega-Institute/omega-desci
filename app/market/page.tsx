"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Separator } from "@/components/ui/shadcn";
import { ExternalLink, Gavel, RefreshCcw } from "lucide-react";

type MarketAuditV1 = {
  status: "pending" | "claimed" | "confirmed" | "rejected";
  rewardELF: number;
  claimedBy?: string;
  claimedAt?: string;
  decidedAt?: string;
  decision?: "confirm" | "reject";
  artifactUrl?: string;
  artifactHash?: string;
  notes?: string;
};

type MarketBountyV1 = {
  id: string;
  createdAt: string;
  updatedAt: string;
  artifactHash: string;
  paperId: string;
  paperTitle: string;
  paperDoi?: string;
  claim: string;
  detail: string;
  alignmentStatus?: string;
  controversyScore?: number;
  evidenceIds?: string[];
  rewardELF: number;
  stakeELF: number;
  status: "open" | "claimed" | "pass_pending_audit" | "passed";
  claimedBy?: string;
  claimedAt?: string;
  lastAttempt?: { by: string; at: string; result: "pass" | "fail"; artifactUrl?: string; artifactHash?: string; notes?: string };
  audit?: MarketAuditV1;
};

type ListResponse = { bounties: MarketBountyV1[]; error?: string };

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

function hashToCardPath(hash: string) {
  const hex = (hash || "").replace(/^sha256:/, "");
  return `/card/${encodeURIComponent(hex)}`;
}

export default function MarketPage() {
  const [handle, setHandle] = useState("");
  const [bounties, setBounties] = useState<MarketBountyV1[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { artifactUrl: string; artifactHash: string; notes: string }>>({});
  const [auditDrafts, setAuditDrafts] = useState<Record<string, { artifactUrl: string; artifactHash: string; notes: string }>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("omega_market_handle_v1");
      if (saved) setHandle(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (handle.trim()) localStorage.setItem("omega_market_handle_v1", handle.trim());
    } catch {
      // ignore
    }
  }, [handle]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/market/bounties", { cache: "no-store" });
      const data = (await res.json()) as ListResponse;
      if (!res.ok) throw new Error(data?.error || `Failed to load (${res.status})`);
      setBounties(Array.isArray(data.bounties) ? data.bounties : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market.");
      setBounties([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const openCount = useMemo(() => bounties.filter((b) => b.status === "open").length, [bounties]);
  const pendingAuditCount = useMemo(() => bounties.filter((b) => b.status === "pass_pending_audit").length, [bounties]);

  const setDraft = (id: string, patch: Partial<{ artifactUrl: string; artifactHash: string; notes: string }>) => {
    setDrafts((prev) => ({ ...prev, [id]: { artifactUrl: "", artifactHash: "", notes: "", ...(prev[id] || {}), ...patch } }));
  };

  const setAuditDraft = (id: string, patch: Partial<{ artifactUrl: string; artifactHash: string; notes: string }>) => {
    setAuditDrafts((prev) => ({ ...prev, [id]: { artifactUrl: "", artifactHash: "", notes: "", ...(prev[id] || {}), ...patch } }));
  };

  const claim = async (id: string) => {
    const h = handle.trim();
    if (!h) {
      setError("Set your validator handle first.");
      return;
    }
    setActionBusy(id);
    setError(null);
    try {
      await postJson("/api/market/bounties/claim", { id, handle: h });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed.");
    } finally {
      setActionBusy(null);
    }
  };

  const submit = async (id: string, result: "pass" | "fail") => {
    const h = handle.trim();
    if (!h) {
      setError("Set your validator handle first.");
      return;
    }
    setActionBusy(id);
    setError(null);
    try {
      const d = drafts[id] || { artifactUrl: "", artifactHash: "", notes: "" };
      await postJson("/api/market/bounties/submit", { id, handle: h, result, ...d });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed.");
    } finally {
      setActionBusy(null);
    }
  };

  const claimAudit = async (id: string) => {
    const h = handle.trim();
    if (!h) {
      setError("Set your validator handle first.");
      return;
    }
    setActionBusy(id);
    setError(null);
    try {
      await postJson("/api/market/bounties/audit/claim", { id, handle: h });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit claim failed.");
    } finally {
      setActionBusy(null);
    }
  };

  const submitAudit = async (id: string, decision: "confirm" | "reject") => {
    const h = handle.trim();
    if (!h) {
      setError("Set your validator handle first.");
      return;
    }
    setActionBusy(id);
    setError(null);
    try {
      const d = auditDrafts[id] || { artifactUrl: "", artifactHash: "", notes: "" };
      await postJson("/api/market/bounties/audit/submit", { id, handle: h, decision, ...d });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit submit failed.");
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="container py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-zinc-600">REPRODUCTION_TICKET_MARKET</div>
            <h1 className="text-2xl md:text-3xl font-serif text-zinc-100">Bounty Marketplace</h1>
            <p className="text-sm text-zinc-500">Claim a controversial-claim ticket, submit PASS/FAIL, resolve via audit.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted" className="font-mono text-[10px]">
              OPEN: {openCount}
            </Badge>
            <Badge variant="amber" className="font-mono text-[10px]">
              PENDING_AUDIT: {pendingAuditCount}
            </Badge>
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-zinc-100 flex items-center gap-2">
                <Gavel className="h-4 w-4 text-emerald-500" />
                Validator Console
              </CardTitle>
              <Button variant="outline" className="border-zinc-700" onClick={() => void refresh()} disabled={loading}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                REFRESH
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <div className="text-xs font-mono text-zinc-600 mb-2">YOUR_HANDLE</div>
                <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="e.g. validator_zenodo_42" />
              </div>
              <div className="text-xs text-zinc-600">
                Seed bounties by generating a review card from{" "}
                <Link href="/arxiv" className="text-emerald-500 hover:underline font-mono">
                  /arxiv
                </Link>{" "}
                or the archive drawer.
              </div>
            </div>

            {error ? <div className="text-sm text-red-400 border border-red-900/40 bg-red-950/20 p-3">{error}</div> : null}

            <Separator className="bg-zinc-800" />

            {loading ? (
              <div className="text-emerald-500 font-mono text-sm">LOADING_MARKET...</div>
            ) : bounties.length === 0 ? (
              <div className="text-sm text-zinc-600 italic">No bounties yet. Generate a review artifact to seed tickets.</div>
            ) : (
              <div className="space-y-4">
                {bounties.map((b) => {
                  const draft = drafts[b.id] || { artifactUrl: "", artifactHash: "", notes: "" };
                  const auditDraft = auditDrafts[b.id] || { artifactUrl: "", artifactHash: "", notes: "" };
                  const busy = actionBusy === b.id;
                  const cardPath = hashToCardPath(b.artifactHash);
                  const last = b.lastAttempt;
                  const audit = b.audit;

                  return (
                    <div key={b.id} className="border border-zinc-800 bg-black/20 p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-[10px] font-mono text-zinc-600">{b.id}</div>
                          <div className="text-sm text-zinc-200">{b.detail}</div>
                          <div className="text-xs text-zinc-500">{b.claim}</div>
                          <div className="text-xs text-zinc-600 font-mono">
                            PAPER: {b.paperTitle} {b.paperDoi ? `• ${b.paperDoi}` : ""}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={b.status === "open" ? "emerald" : b.status === "passed" ? "muted" : "amber"} className="font-mono text-[10px]">
                            {b.status.toUpperCase()}
                          </Badge>
                          <Badge variant="muted" className="font-mono text-[10px]">
                            REWARD: {b.rewardELF} ELF
                          </Badge>
                          <Badge variant="muted" className="font-mono text-[10px]">
                            STAKE: {b.stakeELF} ELF
                          </Badge>
                          {typeof b.controversyScore === "number" ? (
                            <Badge variant="amber" className="font-mono text-[10px]">
                              CONTROVERSY: {b.controversyScore.toFixed(2)}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link href={cardPath}>
                          <Button variant="outline" className="border-zinc-700">
                            SOURCE_CARD
                          </Button>
                        </Link>
                        {b.artifactHash ? (
                          <a href={`/api/artifacts/${encodeURIComponent(b.artifactHash.replace(/^sha256:/, ""))}`} target="_blank" rel="noreferrer">
                            <Button variant="outline" className="border-zinc-700">
                              ARTIFACT_JSON <ExternalLink className="ml-2 h-3.5 w-3.5" />
                            </Button>
                          </a>
                        ) : null}
                      </div>

                      {b.status === "open" ? (
                        <Button variant="emerald" onClick={() => void claim(b.id)} disabled={busy}>
                          {busy ? "CLAIMING..." : "CLAIM_BOUNTY"}
                        </Button>
                      ) : null}

                      {b.status === "claimed" ? (
                        <div className="space-y-3">
                          <div className="text-xs font-mono text-zinc-600">CLAIMED_BY: {b.claimedBy || "?"}</div>
                          {b.claimedBy === handle.trim() ? (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <div className="text-xs font-mono text-zinc-600 mb-2">RESULT_URL (OPTIONAL)</div>
                                  <Input value={draft.artifactUrl} onChange={(e) => setDraft(b.id, { artifactUrl: e.target.value })} placeholder="https://... notebook / gist / zenodo" />
                                </div>
                                <div>
                                  <div className="text-xs font-mono text-zinc-600 mb-2">RESULT_HASH (OPTIONAL)</div>
                                  <Input value={draft.artifactHash} onChange={(e) => setDraft(b.id, { artifactHash: e.target.value })} placeholder="sha256:..." />
                                </div>
                                <div>
                                  <div className="text-xs font-mono text-zinc-600 mb-2">NOTES</div>
                                  <Input value={draft.notes} onChange={(e) => setDraft(b.id, { notes: e.target.value })} placeholder="Short evidence summary…" />
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="emerald" onClick={() => void submit(b.id, "pass")} disabled={busy}>
                                  {busy ? "SUBMITTING..." : "SUBMIT_PASS"}
                                </Button>
                                <Button variant="outline" className="border-zinc-700" onClick={() => void submit(b.id, "fail")} disabled={busy}>
                                  SUBMIT_FAIL
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="text-sm text-zinc-600 italic">Claimed by another validator.</div>
                          )}
                        </div>
                      ) : null}

                      {b.status === "pass_pending_audit" ? (
                        <div className="space-y-3">
                          {last ? (
                            <div className="border border-zinc-800 bg-black/30 p-3 space-y-1">
                              <div className="text-xs font-mono text-zinc-600">LAST_ATTEMPT</div>
                              <div className="text-xs text-zinc-500">
                                {last.by} • {new Date(last.at).toLocaleString()} • RESULT:{" "}
                                <span className="text-emerald-500 font-mono">{last.result.toUpperCase()}</span>
                              </div>
                              {last.notes ? <div className="text-xs text-zinc-400">NOTES: {last.notes}</div> : null}
                              {last.artifactUrl ? (
                                <a href={last.artifactUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-500 hover:underline font-mono">
                                  OPEN_RESULT_URL <ExternalLink className="inline ml-1 h-3 w-3" />
                                </a>
                              ) : null}
                              {last.artifactHash ? <div className="text-xs font-mono text-zinc-500 break-all">HASH: {last.artifactHash}</div> : null}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-2 items-center">
                            <Badge variant="amber" className="font-mono text-[10px]">
                              AUDIT: {audit?.status?.toUpperCase() || "PENDING"}
                            </Badge>
                            {audit?.claimedBy ? (
                              <Badge variant="muted" className="font-mono text-[10px]">
                                AUDITOR: {audit.claimedBy}
                              </Badge>
                            ) : null}
                            {audit?.rewardELF ? (
                              <Badge variant="muted" className="font-mono text-[10px]">
                                AUDIT_REWARD: {audit.rewardELF} ELF
                              </Badge>
                            ) : null}
                          </div>

                          {audit?.status === "pending" ? (
                            <Button variant="emerald" onClick={() => void claimAudit(b.id)} disabled={busy}>
                              {busy ? "CLAIMING..." : "CLAIM_AUDIT"}
                            </Button>
                          ) : null}

                          {audit?.status === "claimed" && audit.claimedBy === handle.trim() ? (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <div className="text-xs font-mono text-zinc-600 mb-2">AUDIT_URL (OPTIONAL)</div>
                                  <Input value={auditDraft.artifactUrl} onChange={(e) => setAuditDraft(b.id, { artifactUrl: e.target.value })} placeholder="https://... audit notebook" />
                                </div>
                                <div>
                                  <div className="text-xs font-mono text-zinc-600 mb-2">AUDIT_HASH (OPTIONAL)</div>
                                  <Input value={auditDraft.artifactHash} onChange={(e) => setAuditDraft(b.id, { artifactHash: e.target.value })} placeholder="sha256:..." />
                                </div>
                                <div>
                                  <div className="text-xs font-mono text-zinc-600 mb-2">NOTES</div>
                                  <Input value={auditDraft.notes} onChange={(e) => setAuditDraft(b.id, { notes: e.target.value })} placeholder="Audit decision rationale…" />
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="emerald" onClick={() => void submitAudit(b.id, "confirm")} disabled={busy}>
                                  {busy ? "SUBMITTING..." : "CONFIRM_PASS"}
                                </Button>
                                <Button variant="outline" className="border-zinc-700" onClick={() => void submitAudit(b.id, "reject")} disabled={busy}>
                                  REJECT
                                </Button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}

                      {b.status === "passed" ? (
                        <div className="text-sm text-emerald-500 font-mono border border-emerald-900/40 bg-emerald-950/10 p-3">
                          VERIFIED • REWARD_RELEASED (SIMULATED)
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

