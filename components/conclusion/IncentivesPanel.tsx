"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Paper } from "@/lib/mockData";
import type { ClaimEvidence } from "@/lib/review/evidence";
import type { EpistemicReview } from "@/lib/review/epistemic";
import type { DefenseEvaluation } from "@/lib/review/steelman";
import type { WorkOrdersStoreV1 } from "@/lib/review/verification";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui/shadcn";

type AuthorProfileV1 = {
  version: 1;
  handle: string;
  createdAt: string;
  updatedAt: string;
  reputation: number;
  tokensELF: number;
};

type AuthorProfilesStoreV1 = {
  version: 1;
  updatedAt: string;
  activeHandle: string | null;
  profilesByHandle: Record<string, AuthorProfileV1>;
};

type AuthorRewardClaimV1 = {
  version: 1;
  paperId: string;
  claimedAt: string;
  claimedBy: string;
  amountELF: number;
  criteria: {
    defenseVerdict: string;
    evidenceCoverage: { total: number; covered: number; ratio: number };
    verifiedTickets: number;
  };
};

const AUTHOR_PROFILES_KEY = "omega_author_profiles_v1";

function authorRewardKey(paperId: string) {
  return `omega_author_rewards_v1:${paperId}`;
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeAuthorProfile(parsed: unknown): AuthorProfileV1 | null {
  if (!parsed || typeof parsed !== "object") return null;
  const value = parsed as Partial<AuthorProfileV1>;
  if (value.version !== 1) return null;
  if (typeof value.handle !== "string" || !value.handle.trim()) return null;
  return {
    version: 1,
    handle: value.handle.trim(),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    reputation: typeof value.reputation === "number" ? value.reputation : 0,
    tokensELF: typeof value.tokensELF === "number" ? value.tokensELF : 0,
  };
}

function safeParseAuthorStore(raw: string | null): AuthorProfilesStoreV1 | null {
  const parsed = safeParseJson<Partial<AuthorProfilesStoreV1>>(raw);
  if (!parsed || parsed.version !== 1) return null;
  const profilesRaw =
    parsed.profilesByHandle && typeof parsed.profilesByHandle === "object" ? (parsed.profilesByHandle as Record<string, unknown>) : {};
  const profilesByHandle: Record<string, AuthorProfileV1> = {};
  for (const entry of Object.values(profilesRaw)) {
    const profile = normalizeAuthorProfile(entry);
    if (profile) profilesByHandle[profile.handle] = profile;
  }
  const handles = Object.keys(profilesByHandle).sort((a, b) => a.localeCompare(b));
  const preferred = typeof parsed.activeHandle === "string" ? parsed.activeHandle : null;
  const activeHandle = preferred && profilesByHandle[preferred] ? preferred : handles[0] || null;
  return {
    version: 1,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    activeHandle,
    profilesByHandle,
  };
}

function safeParseAuthorClaim(raw: string | null, paperId: string): AuthorRewardClaimV1 | null {
  const parsed = safeParseJson<Partial<AuthorRewardClaimV1>>(raw);
  if (!parsed || parsed.version !== 1) return null;
  if (parsed.paperId !== paperId) return null;
  if (typeof parsed.claimedBy !== "string" || !parsed.claimedBy.trim()) return null;
  return {
    version: 1,
    paperId,
    claimedAt: typeof parsed.claimedAt === "string" ? parsed.claimedAt : new Date().toISOString(),
    claimedBy: parsed.claimedBy,
    amountELF: typeof parsed.amountELF === "number" ? parsed.amountELF : 0,
    criteria: {
      defenseVerdict: typeof parsed.criteria?.defenseVerdict === "string" ? parsed.criteria.defenseVerdict : "unknown",
      evidenceCoverage: {
        total: typeof parsed.criteria?.evidenceCoverage?.total === "number" ? parsed.criteria.evidenceCoverage.total : 0,
        covered: typeof parsed.criteria?.evidenceCoverage?.covered === "number" ? parsed.criteria.evidenceCoverage.covered : 0,
        ratio: typeof parsed.criteria?.evidenceCoverage?.ratio === "number" ? parsed.criteria.evidenceCoverage.ratio : 0,
      },
      verifiedTickets: typeof parsed.criteria?.verifiedTickets === "number" ? parsed.criteria.verifiedTickets : 0,
    },
  };
}

function computeEvidenceCoverage(args: { claimEvidence: ClaimEvidence[]; alignment: EpistemicReview["alignment"] }) {
  const claims = (args.claimEvidence || []).filter((c) => c.claim.trim().length > 0);
  if (claims.length) {
    const covered = claims.filter((c) => (c.evidenceIds || []).length > 0).length;
    return { total: claims.length, covered, ratio: covered / claims.length };
  }
  const aligned = (args.alignment || []).filter((a) => a.claim.trim().length > 0);
  if (!aligned.length) return { total: 0, covered: 0, ratio: 0 };
  const covered = aligned.filter((a) => (a.evidence || []).length > 0).length;
  return { total: aligned.length, covered, ratio: covered / aligned.length };
}

function computeAuthorRewardAmount(paper: Paper) {
  const bounty = paper.replicationBounty?.active ? paper.replicationBounty.amountELF : 0;
  if (bounty > 0) return Math.max(180, Math.min(650, Math.round(bounty * 0.08)));
  return 180;
}

export function IncentivesPanel({
  paper,
  paperId,
  claimEvidence,
  alignment,
  defenseEvaluation,
  workOrdersStore,
}: {
  paper: Paper;
  paperId: string;
  claimEvidence: ClaimEvidence[];
  alignment: EpistemicReview["alignment"];
  defenseEvaluation: DefenseEvaluation | null;
  workOrdersStore: WorkOrdersStoreV1 | null;
}) {
  const [authorStore, setAuthorStore] = useState<AuthorProfilesStoreV1 | null>(null);
  const [newAuthorHandle, setNewAuthorHandle] = useState("");
  const [authorClaim, setAuthorClaim] = useState<AuthorRewardClaimV1 | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setAuthorStore(safeParseAuthorStore(localStorage.getItem(AUTHOR_PROFILES_KEY)));
  }, []);

  useEffect(() => {
    if (!paperId.trim()) return;
    setAuthorClaim(safeParseAuthorClaim(localStorage.getItem(authorRewardKey(paperId)), paperId));
  }, [paperId]);

  useEffect(() => {
    if (!authorStore) return;
    localStorage.setItem(AUTHOR_PROFILES_KEY, JSON.stringify(authorStore));
  }, [authorStore]);

  useEffect(() => {
    if (!paperId.trim() || !authorClaim) return;
    localStorage.setItem(authorRewardKey(paperId), JSON.stringify(authorClaim));
  }, [authorClaim, paperId]);

  const authorHandles = useMemo(
    () => Object.keys(authorStore?.profilesByHandle ?? {}).sort((a, b) => a.localeCompare(b)),
    [authorStore]
  );

  const activeAuthor = useMemo(() => {
    const handle = authorStore?.activeHandle;
    if (!handle || !authorStore?.profilesByHandle) return null;
    return authorStore.profilesByHandle[handle] ?? null;
  }, [authorStore]);

  const upsertAuthor = (profile: AuthorProfileV1, opts?: { makeActive?: boolean }) => {
    const now = new Date().toISOString();
    setAuthorStore((prev) => {
      const base: AuthorProfilesStoreV1 = prev ?? { version: 1, updatedAt: now, activeHandle: null, profilesByHandle: {} };
      return {
        version: 1,
        updatedAt: now,
        activeHandle: opts?.makeActive ? profile.handle : base.activeHandle ?? profile.handle,
        profilesByHandle: { ...base.profilesByHandle, [profile.handle]: profile },
      };
    });
  };

  const setActiveAuthor = (handle: string) => {
    const nextHandle = handle.trim();
    if (!nextHandle) return;
    setAuthorStore((prev) => {
      if (!prev || !prev.profilesByHandle[nextHandle]) return prev;
      return { ...prev, updatedAt: new Date().toISOString(), activeHandle: nextHandle };
    });
  };

  const createAuthor = () => {
    setActionError(null);
    const handle = newAuthorHandle.trim();
    if (!handle) {
      setActionError("Enter a new author handle.");
      return;
    }
    const now = new Date().toISOString();
    const created: AuthorProfileV1 = { version: 1, handle, createdAt: now, updatedAt: now, reputation: 0, tokensELF: 0 };
    upsertAuthor(created, { makeActive: true });
    setNewAuthorHandle("");
  };

  const coverage = useMemo(() => computeEvidenceCoverage({ claimEvidence, alignment }), [alignment, claimEvidence]);
  const verifiedTickets = useMemo(() => workOrdersStore?.orders?.filter((o) => o.status === "passed").length ?? 0, [workOrdersStore]);
  const pendingAudits = useMemo(
    () => workOrdersStore?.orders?.filter((o) => o.status === "pass_pending_audit").length ?? 0,
    [workOrdersStore]
  );
  const escrowELF = useMemo(() => {
    const pending = workOrdersStore?.orders?.filter((o) => o.status === "pass_pending_audit") ?? [];
    return pending.reduce((acc, o) => acc + o.stakeELF + o.rewardELF, 0);
  }, [workOrdersStore]);

  const authorRewardELF = useMemo(() => computeAuthorRewardAmount(paper), [paper]);

  const eligibility = useMemo(() => {
    const reasons: string[] = [];
    if (!defenseEvaluation) reasons.push("No defense evaluation yet (run the Defense tab).");
    else if (defenseEvaluation.summary.verdict !== "pass") reasons.push("Defense verdict is not PASS.");
    if (coverage.total === 0) reasons.push("No structured claims/evidence matrix yet.");
    else if (coverage.ratio < 0.6) reasons.push("Evidence linkage coverage is below 60%.");
    if (verifiedTickets < 1) reasons.push("No audited verification tickets have PASSED yet.");
    return { eligible: reasons.length === 0, reasons };
  }, [coverage.ratio, coverage.total, defenseEvaluation, verifiedTickets]);

  const claimReward = () => {
    setActionError(null);
    if (!activeAuthor) {
      setActionError("Select or create an author profile first.");
      return;
    }
    if (authorClaim) {
      setActionError("Author reward already claimed for this paper.");
      return;
    }
    if (!eligibility.eligible) {
      setActionError("Not eligible yet. Resolve the blocking items and try again.");
      return;
    }

    const now = new Date().toISOString();
    const claim: AuthorRewardClaimV1 = {
      version: 1,
      paperId,
      claimedAt: now,
      claimedBy: activeAuthor.handle,
      amountELF: authorRewardELF,
      criteria: {
        defenseVerdict: defenseEvaluation?.summary.verdict || "unknown",
        evidenceCoverage: coverage,
        verifiedTickets,
      },
    };
    setAuthorClaim(claim);

    const nextAuthor: AuthorProfileV1 = {
      ...activeAuthor,
      updatedAt: now,
      reputation: activeAuthor.reputation + 12,
      tokensELF: Number((activeAuthor.tokensELF + authorRewardELF).toFixed(2)),
    };
    upsertAuthor(nextAuthor, { makeActive: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-zinc-100">Incentives</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-zinc-400">
          Rewards are mock/local-only. Validators earn tokens only after random audit; authors can claim once after passing adversarial defense + verification gates.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-zinc-800 bg-black/30 p-4 space-y-3">
            <div className="text-xs font-mono text-emerald-500">VALIDATOR_FLOW</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="muted" className="font-mono text-[10px]">
                VERIFIED_TICKETS: {verifiedTickets}
              </Badge>
              <Badge variant="amber" className="font-mono text-[10px]">
                AUDIT_PENDING: {pendingAudits}
              </Badge>
              <Badge variant="muted" className="font-mono text-[10px]">
                ESCROW_ELF: {Math.round(escrowELF)}
              </Badge>
            </div>
            <div className="text-xs text-zinc-500">
              Tip: create two validator handles; one submits PASS, the other claims and submits the audit to release rewards.
            </div>
          </div>

          <div className="border border-zinc-800 bg-black/30 p-4 space-y-3">
            <div className="text-xs font-mono text-emerald-500">AUTHOR_REWARD</div>

            {authorHandles.length ? (
              <div className="space-y-2">
                <div className="text-xs font-mono text-zinc-500">ACTIVE_AUTHOR</div>
                <div className="flex flex-wrap gap-2">
                  {authorHandles.map((h) => (
                    <Button
                      key={h}
                      size="sm"
                      variant={h === authorStore?.activeHandle ? "emerald" : "outline"}
                      className={h === authorStore?.activeHandle ? undefined : "border-zinc-700"}
                      onClick={() => setActiveAuthor(h)}
                    >
                      {h}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-600">No author profiles yet.</div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-mono text-zinc-500">NEW_AUTHOR_HANDLE</label>
              <div className="flex gap-2">
                <Input value={newAuthorHandle} onChange={(e) => setNewAuthorHandle(e.target.value)} placeholder="e.g. lab42" />
                <Button size="sm" variant="emerald" onClick={createAuthor} disabled={!newAuthorHandle.trim()}>
                  CREATE
                </Button>
              </div>
            </div>

            {activeAuthor ? (
              <div className="flex flex-wrap gap-4 text-xs font-mono text-zinc-600">
                <span>
                  AUTHOR_REP: <span className="text-emerald-500">{activeAuthor.reputation}</span>
                </span>
                <span>
                  AUTHOR_TOKENS_ELF: <span className="text-emerald-500">{Math.round(activeAuthor.tokensELF)}</span>
                </span>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Badge variant={defenseEvaluation?.summary.verdict === "pass" ? "emerald" : "amber"} className="font-mono text-[10px]">
                DEFENSE: {defenseEvaluation?.summary.verdict?.toUpperCase() || "MISSING"}
              </Badge>
              <Badge variant={coverage.ratio >= 0.6 ? "emerald" : "amber"} className="font-mono text-[10px]">
                EVIDENCE_COVERAGE: {coverage.total ? `${Math.round(coverage.ratio * 100)}%` : "N/A"}
              </Badge>
              <Badge variant={verifiedTickets >= 1 ? "emerald" : "amber"} className="font-mono text-[10px]">
                VERIFIED_TICKETS: {verifiedTickets}
              </Badge>
              <Badge variant="muted" className="font-mono text-[10px]">
                REWARD: {authorRewardELF} ELF
              </Badge>
            </div>

            {!eligibility.eligible ? (
              <div className="text-xs text-zinc-500 space-y-1">
                <div className="text-xs font-mono text-amber-400">BLOCKERS</div>
                <ul className="list-disc list-inside">
                  {eligibility.reasons.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-xs text-emerald-400 font-mono">ELIGIBLE_TO_CLAIM</div>
            )}

            {authorClaim ? (
              <div className="border border-zinc-800 bg-black/20 p-3 space-y-2">
                <div className="text-xs font-mono text-emerald-500">CLAIMED</div>
                <div className="text-xs text-zinc-500">
                  BY: <span className="font-mono text-zinc-300">{authorClaim.claimedBy}</span> | AT:{" "}
                  <span className="font-mono text-zinc-300">{new Date(authorClaim.claimedAt).toLocaleString()}</span>
                </div>
                <div className="text-xs text-zinc-500">
                  AMOUNT: <span className="font-mono text-emerald-500">{authorClaim.amountELF} ELF</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-zinc-700"
                    onClick={() => downloadJson(`omega-author-reward-${paperId}.json`, authorClaim)}
                  >
                    EXPORT_REWARD_JSON
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="emerald" onClick={claimReward} disabled={!eligibility.eligible || !activeAuthor}>
                  CLAIM_AUTHOR_REWARD
                </Button>
                <span className="text-xs font-mono text-zinc-600">PAPER: {paperId}</span>
              </div>
            )}

            {actionError ? <div className="text-xs text-red-400 font-mono">{actionError}</div> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

