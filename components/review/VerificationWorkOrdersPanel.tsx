"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Paper } from "@/lib/mockData";
import type { ClaimEvidence, EvidencePointer } from "@/lib/review/evidence";
import { formatEvidencePointer } from "@/lib/review/evidence";
import {
  claimAudit,
  claimWorkOrder,
  forkWorkOrder,
  generateVerificationWorkOrders,
  makeDefaultValidatorProfile,
  submitAudit,
  submitWorkOrder,
  type ValidatorProfileV1,
  type WorkOrdersStoreV1,
  type WorkOrderV1,
} from "@/lib/review/verification";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui/shadcn";

type ValidatorProfilesStoreV1 = {
  version: 1;
  updatedAt: string;
  activeHandle: string | null;
  profilesByHandle: Record<string, ValidatorProfileV1>;
};

type EvidenceStoreV1 = {
  version: 1;
  updatedAt?: string;
  evidencePointers: EvidencePointer[];
  claimEvidence: ClaimEvidence[];
};

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

function normalizeProfile(parsed: unknown): ValidatorProfileV1 | null {
  if (!parsed || typeof parsed !== "object") return null;
  const value = parsed as Partial<ValidatorProfileV1>;
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

function safeParseProfile(raw: string | null): ValidatorProfileV1 | null {
  return normalizeProfile(safeParseJson(raw));
}

function safeParseProfilesStore(raw: string | null): ValidatorProfilesStoreV1 | null {
  const parsed = safeParseJson<Partial<ValidatorProfilesStoreV1>>(raw);
  if (!parsed || parsed.version !== 1) return null;
  const profilesRaw =
    parsed.profilesByHandle && typeof parsed.profilesByHandle === "object" ? (parsed.profilesByHandle as Record<string, unknown>) : {};
  const profilesByHandle: Record<string, ValidatorProfileV1> = {};
  for (const entry of Object.values(profilesRaw)) {
    const profile = normalizeProfile(entry);
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

function safeParseOrdersStore(raw: string | null, paperId: string): WorkOrdersStoreV1 | null {
  const parsed = safeParseJson<Partial<WorkOrdersStoreV1>>(raw);
  if (!parsed || parsed.version !== 1) return null;
  if (parsed.paperId !== paperId) return null;
  return {
    version: 1,
    paperId,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    orders: Array.isArray(parsed.orders) ? (parsed.orders as WorkOrderV1[]) : [],
    ledger: Array.isArray(parsed.ledger) ? (parsed.ledger as WorkOrdersStoreV1["ledger"]) : [],
  };
}

function evidenceKey(paperId: string) {
  return `omega_evidence_v1:${paperId}`;
}

function workOrdersKey(paperId: string) {
  return `omega_work_orders_v1:${paperId}`;
}

const PROFILES_KEY = "omega_validator_profiles_v1";
const LEGACY_PROFILE_KEY = "omega_validator_profile_v1";

function severityVariant(status: WorkOrderV1["status"]) {
  if (status === "passed") return "emerald";
  if (status === "claimed" || status === "pass_pending_audit") return "amber";
  return "muted";
}

function short(s: string, max = 140) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function VerificationWorkOrdersPanel({
  paper,
  evidencePointers: evidencePointersProp,
  claimEvidence: claimEvidenceProp,
}: {
  paper: Paper;
  evidencePointers?: EvidencePointer[];
  claimEvidence?: ClaimEvidence[];
}) {
  const [profilesStore, setProfilesStore] = useState<ValidatorProfilesStoreV1 | null>(null);
  const [newHandleDraft, setNewHandleDraft] = useState("");
  const [ordersStore, setOrdersStore] = useState<WorkOrdersStoreV1 | null>(null);

  const [evidencePointers, setEvidencePointers] = useState<EvidencePointer[]>(evidencePointersProp || []);
  const [claimEvidence, setClaimEvidence] = useState<ClaimEvidence[]>(claimEvidenceProp || []);

  const [actionStatus, setActionStatus] = useState<"idle" | "error">("idle");
  const [actionError, setActionError] = useState<string | null>(null);

  const [draftResultById, setDraftResultById] = useState<Record<string, "pass" | "fail">>({});
  const [draftArtifactUrlById, setDraftArtifactUrlById] = useState<Record<string, string>>({});
  const [draftArtifactHashById, setDraftArtifactHashById] = useState<Record<string, string>>({});
  const [draftNotesById, setDraftNotesById] = useState<Record<string, string>>({});
  const [draftAuditDecisionById, setDraftAuditDecisionById] = useState<Record<string, "confirm" | "reject">>({});
  const [draftAuditArtifactUrlById, setDraftAuditArtifactUrlById] = useState<Record<string, string>>({});
  const [draftAuditArtifactHashById, setDraftAuditArtifactHashById] = useState<Record<string, string>>({});
  const [draftAuditNotesById, setDraftAuditNotesById] = useState<Record<string, string>>({});

  useEffect(() => {
    setEvidencePointers(evidencePointersProp || []);
  }, [evidencePointersProp]);

  useEffect(() => {
    setClaimEvidence(claimEvidenceProp || []);
  }, [claimEvidenceProp]);

  const handles = useMemo(() => Object.keys(profilesStore?.profilesByHandle ?? {}).sort((a, b) => a.localeCompare(b)), [profilesStore]);
  const activeHandle = profilesStore?.activeHandle ?? null;
  const profile = useMemo(() => {
    if (!activeHandle || !profilesStore) return null;
    return profilesStore.profilesByHandle[activeHandle] ?? null;
  }, [activeHandle, profilesStore]);

  useEffect(() => {
    const storedStore = safeParseProfilesStore(localStorage.getItem(PROFILES_KEY));
    if (storedStore) {
      setProfilesStore(storedStore);
      return;
    }

    const legacy = safeParseProfile(localStorage.getItem(LEGACY_PROFILE_KEY));
    if (legacy) {
      const now = new Date().toISOString();
      const migrated: ValidatorProfilesStoreV1 = {
        version: 1,
        updatedAt: now,
        activeHandle: legacy.handle,
        profilesByHandle: { [legacy.handle]: legacy },
      };
      localStorage.setItem(PROFILES_KEY, JSON.stringify(migrated));
      localStorage.removeItem(LEGACY_PROFILE_KEY);
      setProfilesStore(migrated);
    }
  }, []);

  useEffect(() => {
    if (!paper.id) return;

    if (!evidencePointersProp && !claimEvidenceProp) {
      const evidenceStored = safeParseJson<Partial<EvidenceStoreV1>>(localStorage.getItem(evidenceKey(paper.id)));
      if (evidenceStored?.version === 1) {
        setEvidencePointers(Array.isArray(evidenceStored.evidencePointers) ? (evidenceStored.evidencePointers as EvidencePointer[]) : []);
        setClaimEvidence(Array.isArray(evidenceStored.claimEvidence) ? (evidenceStored.claimEvidence as ClaimEvidence[]) : []);
      }
    }

    const store = safeParseOrdersStore(localStorage.getItem(workOrdersKey(paper.id)), paper.id);
    if (store) {
      setOrdersStore(store);
      return;
    }

    const generated = generateVerificationWorkOrders({
      paper,
      evidencePointers: evidencePointersProp || evidencePointers,
      claimEvidence: claimEvidenceProp || claimEvidence,
    });
    const init: WorkOrdersStoreV1 = {
      version: 1,
      paperId: paper.id,
      updatedAt: new Date().toISOString(),
      orders: generated,
      ledger: [],
    };
    localStorage.setItem(workOrdersKey(paper.id), JSON.stringify(init));
    setOrdersStore(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper.id]);

  useEffect(() => {
    if (!profilesStore) return;
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profilesStore));
  }, [profilesStore]);

  useEffect(() => {
    if (!ordersStore) return;
    localStorage.setItem(workOrdersKey(ordersStore.paperId), JSON.stringify(ordersStore));
  }, [ordersStore]);

  const openCount = useMemo(() => ordersStore?.orders.filter((o) => o.status === "open").length ?? 0, [ordersStore]);
  const passedCount = useMemo(() => ordersStore?.orders.filter((o) => o.status === "passed").length ?? 0, [ordersStore]);
  const claimedCount = useMemo(
    () => ordersStore?.orders.filter((o) => o.status === "claimed" || o.status === "pass_pending_audit").length ?? 0,
    [ordersStore]
  );
  const pendingAuditCount = useMemo(() => ordersStore?.orders.filter((o) => o.status === "pass_pending_audit").length ?? 0, [ordersStore]);

  const upsertProfile = (nextProfile: ValidatorProfileV1, opts?: { makeActive?: boolean }) => {
    const now = new Date().toISOString();
    setProfilesStore((prev) => {
      const base: ValidatorProfilesStoreV1 = prev ?? {
        version: 1,
        updatedAt: now,
        activeHandle: nextProfile.handle,
        profilesByHandle: {},
      };
      return {
        version: 1,
        updatedAt: now,
        activeHandle: opts?.makeActive ? nextProfile.handle : base.activeHandle ?? nextProfile.handle,
        profilesByHandle: {
          ...base.profilesByHandle,
          [nextProfile.handle]: nextProfile,
        },
      };
    });
  };

  const ensureProfile = () => {
    if (profile) return profile;
    const handle = newHandleDraft.trim();
    if (!handle) throw new Error("Create or select a validator profile first.");
    const created = makeDefaultValidatorProfile(handle);
    upsertProfile(created, { makeActive: true });
    setNewHandleDraft("");
    return created;
  };

  const setActiveProfile = (handle: string) => {
    const nextHandle = handle.trim();
    if (!nextHandle) return;
    setProfilesStore((prev) => {
      if (!prev || !prev.profilesByHandle[nextHandle]) return prev;
      return { ...prev, updatedAt: new Date().toISOString(), activeHandle: nextHandle };
    });
  };

  const createProfile = () => {
    setActionStatus("idle");
    setActionError(null);
    try {
      const handle = newHandleDraft.trim();
      if (!handle) throw new Error("Enter a new handle.");
      const created = makeDefaultValidatorProfile(handle);
      upsertProfile(created, { makeActive: true });
      setNewHandleDraft("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create profile.";
      setActionError(message);
      setActionStatus("error");
    }
  };

  const airdrop = () => {
    setActionStatus("idle");
    setActionError(null);
    try {
      const p = ensureProfile();
      const next = { ...p, tokensELF: Number((p.tokensELF + 120).toFixed(2)), updatedAt: new Date().toISOString() };
      upsertProfile(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to airdrop.";
      setActionError(message);
      setActionStatus("error");
    }
  };

  const resetAll = () => {
    setActionStatus("idle");
    setActionError(null);
    localStorage.removeItem(PROFILES_KEY);
    localStorage.removeItem(LEGACY_PROFILE_KEY);
    if (paper.id) localStorage.removeItem(workOrdersKey(paper.id));
    setProfilesStore(null);
    setNewHandleDraft("");
    setOrdersStore(null);
  };

  const claim = (workOrderId: string) => {
    setActionStatus("idle");
    setActionError(null);
    try {
      const p = ensureProfile();
      if (!ordersStore) throw new Error("Missing work orders store.");
      const next = claimWorkOrder({ profile: p, store: ordersStore, workOrderId });
      upsertProfile(next.profile);
      setOrdersStore(next.store);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to claim ticket.";
      setActionError(message);
      setActionStatus("error");
    }
  };

  const submit = (workOrderId: string) => {
    setActionStatus("idle");
    setActionError(null);
    try {
      const p = ensureProfile();
      if (!ordersStore) throw new Error("Missing work orders store.");
      const result = draftResultById[workOrderId] || "pass";
      const next = submitWorkOrder({
        profile: p,
        store: ordersStore,
        workOrderId,
        result,
        artifactUrl: draftArtifactUrlById[workOrderId] || "",
        artifactHash: draftArtifactHashById[workOrderId] || "",
        notes: draftNotesById[workOrderId] || "",
      });
      upsertProfile(next.profile);
      setOrdersStore(next.store);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit verification.";
      setActionError(message);
      setActionStatus("error");
    }
  };

  const claimAuditTicket = (workOrderId: string) => {
    setActionStatus("idle");
    setActionError(null);
    try {
      const auditor = ensureProfile();
      if (!ordersStore) throw new Error("Missing work orders store.");
      const next = claimAudit({ auditor, store: ordersStore, workOrderId });
      upsertProfile(next.auditor);
      setOrdersStore(next.store);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to claim audit.";
      setActionError(message);
      setActionStatus("error");
    }
  };

  const submitAuditTicket = (workOrderId: string) => {
    setActionStatus("idle");
    setActionError(null);
    try {
      const auditor = ensureProfile();
      if (!ordersStore) throw new Error("Missing work orders store.");
      const order = ordersStore.orders.find((o) => o.id === workOrderId);
      if (!order) throw new Error("Work order not found.");
      const submitterHandle = order.claimedBy;
      if (!submitterHandle) throw new Error("Missing submitter handle on work order.");
      const submitter = profilesStore?.profilesByHandle?.[submitterHandle];
      if (!submitter) throw new Error(`Missing submitter profile "${submitterHandle}". Create it locally to apply payouts/slashes.`);

      const decision = draftAuditDecisionById[workOrderId] || "confirm";
      const next = submitAudit({
        auditor,
        submitter,
        store: ordersStore,
        workOrderId,
        decision,
        artifactUrl: draftAuditArtifactUrlById[workOrderId] || "",
        artifactHash: draftAuditArtifactHashById[workOrderId] || "",
        notes: draftAuditNotesById[workOrderId] || "",
      });

      upsertProfile(next.auditor);
      upsertProfile(next.submitter);
      setOrdersStore(next.store);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit audit.";
      setActionError(message);
      setActionStatus("error");
    }
  };

  const exportTicket = (order: WorkOrderV1) => {
    downloadJson(`omega-workorder-${paper.id}-${order.id}.json`, { version: 1, paperId: paper.id, workOrder: order });
  };

  const forkTicket = (order: WorkOrderV1) => {
    setActionStatus("idle");
    setActionError(null);
    try {
      if (!ordersStore) throw new Error("Missing work orders store.");
      const forked = forkWorkOrder({ order });
      const next: WorkOrdersStoreV1 = {
        ...ordersStore,
        updatedAt: new Date().toISOString(),
        orders: [forked, ...ordersStore.orders],
      };
      setOrdersStore(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fork ticket.";
      setActionError(message);
      setActionStatus("error");
    }
  };

  const allEvidenceText = useMemo(() => {
    const lines = [
      paper.doi ? `DOI: ${paper.doi}` : null,
      paper.codeUrl ? `Code: ${paper.codeUrl}` : null,
      paper.dataUrl ? `Data: ${paper.dataUrl}` : null,
      ...evidencePointers.map((p) => formatEvidencePointer(p)),
    ].filter(Boolean) as string[];
    return lines;
  }, [evidencePointers, paper.codeUrl, paper.dataUrl, paper.doi]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-zinc-100">Community Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-zinc-400">
            Validators claim reproducibility work orders (auto notebook spec + random subsample). PASS may be selected for random audit; rewards release only after a second validator confirms. FAIL triggers rollback (ticket returns to OPEN, stake is slashed).
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-zinc-800 bg-zinc-950 p-4 space-y-3">
              <div className="text-xs font-mono text-emerald-500">VALIDATOR_PROFILE</div>
              {handles.length ? (
                <div className="space-y-2">
                  <div className="text-xs font-mono text-zinc-500">ACTIVE_HANDLE</div>
                  <div className="flex flex-wrap gap-2">
                    {handles.map((h) => (
                      <Button
                        key={h}
                        size="sm"
                        variant={h === activeHandle ? "emerald" : "outline"}
                        className={h === activeHandle ? undefined : "border-zinc-700"}
                        onClick={() => setActiveProfile(h)}
                      >
                        {h}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-zinc-600">No validator profiles yet. Create one to claim tickets.</div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-mono text-zinc-500">NEW_HANDLE</label>
                <Input value={newHandleDraft} onChange={(e) => setNewHandleDraft(e.target.value)} placeholder="e.g. verifier_42" />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button size="sm" variant="emerald" onClick={createProfile} disabled={!newHandleDraft.trim()}>
                  CREATE_PROFILE
                </Button>
                <Button size="sm" variant="outline" className="border-zinc-700" onClick={airdrop}>
                  DEV_AIRDROP +120 ELF
                </Button>
                <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-white" onClick={resetAll}>
                  RESET_LOCAL
                </Button>
              </div>
              {profile ? (
                <div className="flex flex-wrap gap-4 text-xs font-mono text-zinc-600 pt-2">
                  <span>REP: <span className="text-emerald-500">{profile.reputation}</span></span>
                  <span>TOKENS_ELF: <span className="text-emerald-500">{Math.round(profile.tokensELF)}</span></span>
                </div>
              ) : (
                <div className="text-xs text-zinc-600">Create a profile to claim tickets and receive rewards.</div>
              )}
            </div>

            <div className="border border-zinc-800 bg-zinc-950 p-4 space-y-3">
              <div className="text-xs font-mono text-emerald-500">QUEUE_STATUS</div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="muted" className="font-mono text-[10px]">OPEN: {openCount}</Badge>
                <Badge variant="amber" className="font-mono text-[10px]">CLAIMED: {claimedCount}</Badge>
                <Badge variant="amber" className="font-mono text-[10px]">AUDIT_PENDING: {pendingAuditCount}</Badge>
                <Badge variant="emerald" className="font-mono text-[10px]">PASSED: {passedCount}</Badge>
              </div>
              <div className="text-xs font-mono text-zinc-600">PAPER_ID: {paper.id}</div>
              <div className="text-xs text-zinc-600">
                Evidence pointers visible: <span className="font-mono text-emerald-500">{evidencePointers.length}</span>{" "}
                | Claims: <span className="font-mono text-emerald-500">{claimEvidence.filter((c) => c.claim.trim()).length}</span>
              </div>
              <div className="text-xs font-mono text-zinc-700 break-words">
                NOTEBOOK: uses a deterministic seed + random subsample indices for auditability.
              </div>
            </div>
          </div>

          {actionStatus === "error" && actionError ? (
            <div className="text-sm text-red-400 font-mono">{actionError}</div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-zinc-100">Reproducibility Work Orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ordersStore?.orders.length ? (
            <div className="space-y-4">
              {ordersStore.orders.map((o) => {
                const isMine = profile && o.claimedBy === profile.handle;
                const canClaim = o.status === "open";
                const canSubmit = o.status === "claimed" && isMine;
                const audit = o.audit;
                const auditStatus = audit?.status ?? "pending";
                const canClaimAudit =
                  Boolean(profile) && o.status === "pass_pending_audit" && Boolean(o.claimedBy) && o.claimedBy !== profile?.handle && auditStatus === "pending";
                const canSubmitAudit =
                  Boolean(profile) && o.status === "pass_pending_audit" && auditStatus === "claimed" && audit?.claimedBy === profile?.handle;
                const result = draftResultById[o.id] || "pass";
                const auditDecision = draftAuditDecisionById[o.id] || "confirm";
                const auditRewardELF = audit?.rewardELF ?? Math.max(10, Math.round(o.rewardELF * 0.35));
                const auditRepReward = audit?.repReward ?? Math.max(4, Math.round(o.repReward * 0.4));
                const auditPenalty = Math.max(o.repSlash, Math.round(o.repSlash * 1.5));

                return (
                  <div key={o.id} className="border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={severityVariant(o.status)} className="font-mono text-[10px] px-2 py-0.5">
                            {o.status.toUpperCase()}
                          </Badge>
                          <span className="text-xs font-mono text-zinc-600">WORKORDER</span>
                          <span className="text-xs font-mono text-zinc-700 break-all">{o.id}</span>
                        </div>
                        <div className="text-sm font-semibold text-zinc-100">{o.title}</div>
                        <div className="text-sm text-zinc-400">{short(o.claim, 220)}</div>
                        {o.lastAttempt ? (
                          <div className="text-xs font-mono text-zinc-600">
                            LAST_ATTEMPT: {o.lastAttempt.result.toUpperCase()} by {o.lastAttempt.by} @{" "}
                            {new Date(o.lastAttempt.at).toLocaleString()}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="muted" className="font-mono text-[10px]">STAKE: {o.stakeELF} ELF</Badge>
                          <Badge variant="muted" className="font-mono text-[10px]">REWARD: {o.rewardELF} ELF</Badge>
                          <Badge variant="muted" className="font-mono text-[10px]">REP: +{o.repReward}/-{o.repSlash}</Badge>
                        </div>
                        {o.claimedBy && (o.status === "claimed" || o.status === "pass_pending_audit" || o.status === "passed") ? (
                          <div className="text-xs font-mono text-zinc-600">
                            CLAIMED_BY: {o.claimedBy} {o.dueAt ? `| DUE: ${new Date(o.dueAt).toLocaleString()}` : ""}
                          </div>
                        ) : null}
                        <div className="flex gap-2">
                          {canClaim ? (
                            <Button
                              size="sm"
                              variant="emerald"
                              onClick={() => claim(o.id)}
                              disabled={!profile || (profile?.tokensELF ?? 0) < o.stakeELF}
                            >
                              CLAIM_TICKET
                            </Button>
                          ) : null}
                          {canClaimAudit ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-500/50 text-amber-400 hover:text-amber-200"
                              onClick={() => claimAuditTicket(o.id)}
                            >
                              CLAIM_AUDIT
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" className="border-zinc-700" onClick={() => exportTicket(o)}>
                            EXPORT_JSON
                          </Button>
                          <Button size="sm" variant="outline" className="border-zinc-700" onClick={() => forkTicket(o)}>
                            FORK_TICKET
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="border border-zinc-800 bg-black/30 p-3">
                        <div className="text-[10px] font-mono text-zinc-600 mb-2">AUTOMATED_NOTEBOOK_SPEC</div>
                        <div className="text-xs font-mono text-zinc-500 break-words">{o.notebook.title}</div>
                        <div className="mt-2 space-y-2">
                          <div>
                            <div className="text-[10px] font-mono text-zinc-600 mb-1">COMMANDS</div>
                            <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                              {o.notebook.commands.map((c) => (
                                <li key={c} className="break-words">{c.replace("<ID>", o.id)}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <div className="text-[10px] font-mono text-zinc-600 mb-1">STEPS</div>
                            <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                              {o.notebook.steps.map((s, idx) => (
                                <li key={idx} className="break-words">{s}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="border border-zinc-800 bg-black/30 p-3 space-y-3">
                        <div className="text-[10px] font-mono text-zinc-600">RANDOM_SUBSAMPLE</div>
                        <div className="text-xs font-mono text-zinc-500 break-words">
                          SEED: {o.seed} | POOL: {o.subsample.poolSize} | SIZE: {o.subsample.size}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Indices (first {o.subsample.indices.length}):{" "}
                          <span className="font-mono text-zinc-400">{o.subsample.indices.join(", ")}</span>
                        </div>
                        <div className="border-t border-zinc-800 pt-3 space-y-2">
                          <div className="text-[10px] font-mono text-zinc-600">EVIDENCE_POINTERS</div>
                          {o.evidenceSummary.length ? (
                            <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                              {o.evidenceSummary.map((e, idx) => (
                                <li key={idx} className="break-words">{e}</li>
                              ))}
                            </ul>
                          ) : allEvidenceText.length ? (
                            <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
                              {allEvidenceText.slice(0, 6).map((e, idx) => (
                                <li key={idx} className="break-words">{e}</li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-xs text-zinc-600 italic">No evidence pointers available for this paper yet.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {o.status === "claimed" && !isMine ? (
                      <div className="text-sm text-zinc-600 italic">Locked: claimed by another validator.</div>
                    ) : null}

                    {o.status === "pass_pending_audit" ? (
                      <div className="border border-amber-500/20 bg-black/20 p-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-mono text-amber-400">RANDOM_AUDIT_GATE</div>
                            <div className="mt-1 text-xs text-zinc-500">
                              PASS is submitted. Stake + reward stay escrowed until a second validator confirms or rejects the artifact.
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="muted" className="font-mono text-[10px]">
                              ESCROW: {o.stakeELF + o.rewardELF} ELF
                            </Badge>
                            <Badge variant="muted" className="font-mono text-[10px]">
                              AUDIT_REWARD: +{auditRewardELF} ELF
                            </Badge>
                            <Badge variant="muted" className="font-mono text-[10px]">
                              AUDIT_REP: +{auditRepReward}
                            </Badge>
                          </div>
                        </div>

                        <div className="text-xs font-mono text-zinc-600">
                          SUBMITTER: {o.claimedBy || "unknown"} | AUDIT_STATUS: {auditStatus.toUpperCase()}
                        </div>

                        {audit?.claimedBy ? (
                          <div className="text-xs font-mono text-zinc-600">
                            AUDITOR: {audit.claimedBy} {audit.claimedAt ? `| CLAIMED_AT: ${new Date(audit.claimedAt).toLocaleString()}` : ""}
                          </div>
                        ) : null}

                        {auditStatus === "pending" ? (
                          <div className="text-xs text-zinc-600 italic">
                            Waiting for a second validator. Switch profiles above and click <span className="font-mono">CLAIM_AUDIT</span>.
                          </div>
                        ) : null}

                        {auditStatus === "claimed" && !canSubmitAudit ? (
                          <div className="text-xs text-zinc-600 italic">Audit claimed; waiting for the auditor to submit.</div>
                        ) : null}

                        {canSubmitAudit ? (
                          <div className="border border-amber-500/20 bg-black/30 p-4 space-y-3">
                            <div className="text-xs font-mono text-amber-400">SUBMIT_AUDIT</div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant={auditDecision === "confirm" ? "emerald" : "outline"}
                                onClick={() => setDraftAuditDecisionById((p) => ({ ...p, [o.id]: "confirm" }))}
                              >
                                CONFIRM_PASS
                              </Button>
                              <Button
                                size="sm"
                                variant={auditDecision === "reject" ? "destructive" : "outline"}
                                onClick={() => setDraftAuditDecisionById((p) => ({ ...p, [o.id]: "reject" }))}
                              >
                                REJECT_PASS
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <label className="text-xs font-mono text-zinc-500">AUDIT_ARTIFACT_URL</label>
                                <Input
                                  value={draftAuditArtifactUrlById[o.id] || ""}
                                  onChange={(e) => setDraftAuditArtifactUrlById((p) => ({ ...p, [o.id]: e.target.value }))}
                                  placeholder="https://... (audit notebook/results)"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-mono text-zinc-500">AUDIT_ARTIFACT_HASH</label>
                                <Input
                                  value={draftAuditArtifactHashById[o.id] || ""}
                                  onChange={(e) => setDraftAuditArtifactHashById((p) => ({ ...p, [o.id]: e.target.value }))}
                                  placeholder="sha256 / content hash"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-mono text-zinc-500">AUDIT_NOTES</label>
                              <textarea
                                value={draftAuditNotesById[o.id] || ""}
                                onChange={(e) => setDraftAuditNotesById((p) => ({ ...p, [o.id]: e.target.value }))}
                                className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[96px] focus:outline-none focus:border-amber-400"
                                placeholder="Confirm/reject criteria, thresholds, and reproduction diffs."
                              />
                            </div>

                            <div className="flex items-center gap-3">
                              <Button variant="emerald" onClick={() => submitAuditTicket(o.id)}>
                                SUBMIT_AUDIT
                              </Button>
                              <div className="text-xs font-mono text-zinc-600">
                                {auditDecision === "confirm"
                                  ? `RELEASE: +${o.stakeELF + o.rewardELF} ELF to submitter | AUDITOR: +${auditRewardELF} ELF`
                                  : `REJECT: stake burned | REP -${auditPenalty} (submitter) | AUDITOR: +${auditRewardELF} ELF`}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {o.status === "passed" && o.lastAttempt ? (
                      <div className="border border-zinc-800 bg-black/20 p-3">
                        <div className="text-[10px] font-mono text-zinc-600 mb-1">VERIFIED_OUTPUT</div>
                        <div className="text-xs font-mono text-zinc-500">
                          BY: {o.lastAttempt.by} | AT: {new Date(o.lastAttempt.at).toLocaleString()}
                        </div>
                        {o.audit?.required && o.audit.status === "confirmed" && o.audit.claimedBy ? (
                          <div className="text-xs font-mono text-zinc-500">
                            AUDITED_BY: {o.audit.claimedBy} {o.audit.decidedAt ? `| AT: ${new Date(o.audit.decidedAt).toLocaleString()}` : ""}
                          </div>
                        ) : null}
                        {o.lastAttempt.artifactUrl ? (
                          <div className="text-xs text-zinc-400 break-words">URL: {o.lastAttempt.artifactUrl}</div>
                        ) : null}
                        {o.lastAttempt.artifactHash ? (
                          <div className="text-xs font-mono text-zinc-500 break-words">HASH: {o.lastAttempt.artifactHash}</div>
                        ) : null}
                        {o.lastAttempt.notes ? (
                          <div className="text-xs text-zinc-500 whitespace-pre-line mt-2">{o.lastAttempt.notes}</div>
                        ) : null}
                        {o.audit?.required && o.audit.status === "confirmed" && (o.audit.artifactUrl || o.audit.artifactHash || o.audit.notes) ? (
                          <div className="border-t border-zinc-800 mt-3 pt-3 space-y-1">
                            <div className="text-[10px] font-mono text-zinc-600 mb-1">AUDIT_OUTPUT</div>
                            {o.audit.artifactUrl ? <div className="text-xs text-zinc-400 break-words">URL: {o.audit.artifactUrl}</div> : null}
                            {o.audit.artifactHash ? (
                              <div className="text-xs font-mono text-zinc-500 break-words">HASH: {o.audit.artifactHash}</div>
                            ) : null}
                            {o.audit.notes ? <div className="text-xs text-zinc-500 whitespace-pre-line mt-2">{o.audit.notes}</div> : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {canSubmit ? (
                      <div className="border border-zinc-800 bg-black/20 p-4 space-y-3">
                        <div className="text-xs font-mono text-emerald-500">SUBMIT_VERIFICATION</div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={result === "pass" ? "emerald" : "outline"}
                            onClick={() => setDraftResultById((p) => ({ ...p, [o.id]: "pass" }))}
                          >
                            PASS
                          </Button>
                          <Button
                            size="sm"
                            variant={result === "fail" ? "destructive" : "outline"}
                            onClick={() => setDraftResultById((p) => ({ ...p, [o.id]: "fail" }))}
                          >
                            FAIL
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500">ARTIFACT_URL</label>
                            <Input
                              value={draftArtifactUrlById[o.id] || ""}
                              onChange={(e) => setDraftArtifactUrlById((p) => ({ ...p, [o.id]: e.target.value }))}
                              placeholder="https://... (results notebook, gist, zenodo, etc.)"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-mono text-zinc-500">ARTIFACT_HASH</label>
                            <Input
                              value={draftArtifactHashById[o.id] || ""}
                              onChange={(e) => setDraftArtifactHashById((p) => ({ ...p, [o.id]: e.target.value }))}
                              placeholder="sha256 / content hash"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-mono text-zinc-500">NOTES</label>
                          <textarea
                            value={draftNotesById[o.id] || ""}
                            onChange={(e) => setDraftNotesById((p) => ({ ...p, [o.id]: e.target.value }))}
                            className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[96px] focus:outline-none focus:border-emerald-500"
                            placeholder="Describe reproduction result, thresholds, controls, and any deviations."
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <Button variant="emerald" onClick={() => submit(o.id)}>
                            SUBMIT_RESULT
                          </Button>
                            <div className="text-xs font-mono text-zinc-600">
                              {result === "pass"
                                ? `PASS: +${o.stakeELF + o.rewardELF} ELF, REP +${o.repReward} (random audit may escrow payout)`
                                : `ROLLBACK: stake slashed, REP -${o.repSlash} (ticket returns to OPEN)`}
                            </div>
                          </div>
                        </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-zinc-600 italic">No work orders available for this paper.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
