import type { Paper } from "@/lib/mockData";
import type { ClaimEvidence, EvidencePointer } from "@/lib/review/evidence";
import { formatEvidencePointer } from "@/lib/review/evidence";

export type ValidatorProfileV1 = {
  version: 1;
  handle: string;
  createdAt: string;
  updatedAt: string;
  reputation: number;
  tokensELF: number;
};

export type WorkOrderStatus = "open" | "claimed" | "pass_pending_audit" | "passed";

export type WorkOrderAuditStatus = "pending" | "claimed" | "confirmed" | "rejected";

export type WorkOrderAuditV1 = {
  version: 1;
  required: boolean;
  rate: number; // 0..1
  status: WorkOrderAuditStatus;
  rewardELF: number;
  repReward: number;
  claimedBy?: string;
  claimedAt?: string;
  decidedAt?: string;
  decision?: "confirm" | "reject";
  artifactUrl?: string;
  artifactHash?: string;
  notes?: string;
};

export type WorkOrderV1 = {
  id: string;
  version: 1;
  paperId: string;
  createdAt: string;
  status: WorkOrderStatus;

  title: string;
  claim: string;
  evidenceIds: string[];
  evidenceSummary: string[];

  seed: number;
  subsample: { method: "random"; poolSize: number; size: number; indices: number[] };
  notebook: { title: string; commands: string[]; steps: string[] };

  stakeELF: number;
  rewardELF: number;
  repReward: number;
  repSlash: number;
  attemptCount: number;

  claimedBy?: string;
  claimedAt?: string;
  dueAt?: string;
  lastAttempt?: {
    by: string;
    at: string;
    result: "pass" | "fail";
    artifactUrl?: string;
    artifactHash?: string;
    notes?: string;
  };

  audit?: WorkOrderAuditV1;
};

export type LedgerEntryV1 = {
  id: string;
  version: 1;
  at: string;
  type: "stake_lock" | "stake_refund" | "stake_slash" | "reward";
  amountELF: number;
  paperId: string;
  workOrderId: string;
  detail: string;
};

export type WorkOrdersStoreV1 = {
  version: 1;
  updatedAt: string;
  paperId: string;
  orders: WorkOrderV1[];
  ledger: LedgerEntryV1[];
};

type DeterministicRng = () => number;

function hashStringToUint32(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): DeterministicRng {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}`;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function pickSubsampleIndices(seed: number, poolSize: number, size: number) {
  const rng = mulberry32(seed);
  const pool = Array.from({ length: poolSize }, (_, i) => i);
  const out: number[] = [];
  while (pool.length && out.length < size) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

const DEFAULT_AUDIT_RATE = 0.35;

function auditRoll(order: WorkOrderV1, attemptNumber: number) {
  const seed = hashStringToUint32(`${order.paperId}|${order.id}|audit|${attemptNumber}`);
  return (seed % 1000) / 1000;
}

function computeAuditReward(order: WorkOrderV1) {
  const rewardELF = Math.max(10, Math.round(order.rewardELF * 0.35));
  const repReward = Math.max(4, Math.round(order.repReward * 0.4));
  return { rewardELF, repReward };
}

function makeAudit(order: WorkOrderV1, now: string, rate: number): WorkOrderAuditV1 {
  const reward = computeAuditReward(order);
  return {
    version: 1,
    required: true,
    rate,
    status: "pending",
    rewardELF: reward.rewardELF,
    repReward: reward.repReward,
    claimedBy: undefined,
    claimedAt: undefined,
    decidedAt: undefined,
    decision: undefined,
    artifactUrl: undefined,
    artifactHash: undefined,
    notes: undefined,
  };
}

export function makeDefaultValidatorProfile(handle: string): ValidatorProfileV1 {
  const now = new Date().toISOString();
  return {
    version: 1,
    handle: handle.trim(),
    createdAt: now,
    updatedAt: now,
    reputation: 0,
    tokensELF: 120,
  };
}

export function generateVerificationWorkOrders(args: {
  paper: Paper;
  evidencePointers: EvidencePointer[];
  claimEvidence: ClaimEvidence[];
}): WorkOrderV1[] {
  const { paper } = args;
  const evidencePointers = args.evidencePointers || [];
  const claimEvidence = (args.claimEvidence || []).filter((c) => c.claim.trim().length > 0);

  const formattedEvidence = new Map(evidencePointers.map((p) => [p.id, formatEvidencePointer(p)]));

  const defaultOrders: Array<{ title: string; claim: string; evidenceIds: string[] }> = [
    {
      title: "Artifact integrity + pinning",
      claim: "The provided code/data artifacts are sufficient to reproduce the reported results.",
      evidenceIds: evidencePointers.filter((p) => p.type === "code" || p.type === "data").map((p) => p.id),
    },
    {
      title: "Statistical sanity check",
      claim: "Reported statistical claims are robust to basic counter-tests (controls, power, multiple comparisons).",
      evidenceIds: evidencePointers.filter((p) => p.type === "stat_test" || p.type === "table" || p.type === "figure").map((p) => p.id),
    },
    {
      title: "Reproduction on randomized subsample",
      claim: "Key quantitative result holds on a randomized subsample / parameter slice using the provided seed.",
      evidenceIds: evidencePointers.map((p) => p.id),
    },
  ];

  const perClaim = claimEvidence.slice(0, 8).map((c, idx) => ({
    title: `Reproduce claim #${idx + 1}`,
    claim: c.claim,
    evidenceIds: c.evidenceIds || [],
  }));

  const base = perClaim.length ? perClaim : defaultOrders;

  const rewardBase = paper.replicationBounty?.active ? Math.max(25, Math.min(250, Math.round(paper.replicationBounty.amountELF / 12))) : 60;
  const stakeBase = Math.max(10, Math.round(rewardBase * 0.2));

  return base.map((item) => {
    const seed = hashStringToUint32(`${paper.id}|${item.claim}`);
    const subsample = {
      method: "random" as const,
      poolSize: 1000,
      size: 64,
      indices: pickSubsampleIndices(seed, 1000, 16),
    };
    const evidenceIds = unique(item.evidenceIds || []).filter((id) => formattedEvidence.has(id));
    const evidenceSummary = evidenceIds.map((id) => formattedEvidence.get(id) || id);

    const notebookTitle = `Omega Verification Notebook: ${item.title}`;
    const commands = [
      `python -m omega.verify --paper "${paper.id}" --seed ${seed} --subsample ${subsample.size} --workorder "<ID>"`,
      "python -m omega.verify --export results.json",
    ];
    const steps = [
      "Resolve artifacts via evidence pointers (code/data/figures/tables).",
      "Run minimal environment setup (pinned commit/hash, deterministic seed).",
      "Execute reproduction for the claim target metric(s).",
      "Run randomized subsample / parameter slice check (seeded).",
      "Execute negative controls + sanity checks; record thresholds.",
      "Upload results with artifact URL + content hash.",
    ];

    return {
      id: makeId("wo"),
      version: 1,
      paperId: paper.id,
      createdAt: new Date().toISOString(),
      status: "open",
      title: item.title,
      claim: item.claim,
      evidenceIds,
      evidenceSummary,
      seed,
      subsample,
      notebook: { title: notebookTitle, commands, steps },
      stakeELF: stakeBase,
      rewardELF: rewardBase,
      repReward: 15,
      repSlash: 8,
      attemptCount: 0,
    };
  });
}

export function claimWorkOrder(args: {
  profile: ValidatorProfileV1;
  store: WorkOrdersStoreV1;
  workOrderId: string;
}): { profile: ValidatorProfileV1; store: WorkOrdersStoreV1 } {
  const now = new Date().toISOString();
  const order = args.store.orders.find((o) => o.id === args.workOrderId);
  if (!order) throw new Error("Work order not found.");
  if (order.status !== "open") throw new Error("Work order is not open.");
  if (args.profile.tokensELF < order.stakeELF) throw new Error("Insufficient tokens to stake.");

  const profile: ValidatorProfileV1 = {
    ...args.profile,
    updatedAt: now,
    tokensELF: Math.max(0, Number((args.profile.tokensELF - order.stakeELF).toFixed(2))),
  };

  const updatedOrders: WorkOrderV1[] = args.store.orders.map((o) => {
    if (o.id !== order.id) return o;
    const next: WorkOrderV1 = {
      ...o,
      status: "claimed",
      claimedBy: args.profile.handle,
      claimedAt: now,
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    return next;
  });

  const ledger: LedgerEntryV1[] = [
    ...args.store.ledger,
    {
      id: makeId("led"),
      version: 1,
      at: now,
      type: "stake_lock",
      amountELF: -order.stakeELF,
      paperId: args.store.paperId,
      workOrderId: order.id,
      detail: `Stake locked by ${args.profile.handle}`,
    },
  ];

  return {
    profile,
    store: {
      ...args.store,
      updatedAt: now,
      orders: updatedOrders,
      ledger,
    },
  };
}

export function submitWorkOrder(args: {
  profile: ValidatorProfileV1;
  store: WorkOrdersStoreV1;
  workOrderId: string;
  result: "pass" | "fail";
  artifactUrl?: string;
  artifactHash?: string;
  notes?: string;
}): { profile: ValidatorProfileV1; store: WorkOrdersStoreV1 } {
  const now = new Date().toISOString();
  const order = args.store.orders.find((o) => o.id === args.workOrderId);
  if (!order) throw new Error("Work order not found.");
  if (order.status !== "claimed") throw new Error("Work order is not claimed.");
  if (order.claimedBy !== args.profile.handle) throw new Error("Work order is claimed by another validator.");

  const baseAttempt = {
    by: args.profile.handle,
    at: now,
    result: args.result,
    artifactUrl: (args.artifactUrl || "").trim() || undefined,
    artifactHash: (args.artifactHash || "").trim() || undefined,
    notes: (args.notes || "").trim() || undefined,
  };

  if (args.result === "pass") {
    const rate = order.audit?.rate ?? DEFAULT_AUDIT_RATE;
    const roll = auditRoll(order, order.attemptCount + 1);
    const requiresAudit = roll < rate;

    if (!requiresAudit) {
      const refund = order.stakeELF;
      const reward = order.rewardELF;

      const profile: ValidatorProfileV1 = {
        ...args.profile,
        updatedAt: now,
        reputation: Math.max(0, args.profile.reputation + order.repReward),
        tokensELF: Number((args.profile.tokensELF + refund + reward).toFixed(2)),
      };

      const updatedOrders: WorkOrderV1[] = args.store.orders.map((o) => {
        if (o.id !== order.id) return o;
        return {
          ...o,
          status: "passed",
          attemptCount: o.attemptCount + 1,
          lastAttempt: baseAttempt,
          audit: o.audit,
        };
      });

      const ledger: LedgerEntryV1[] = [
        ...args.store.ledger,
        {
          id: makeId("led"),
          version: 1,
          at: now,
          type: "stake_refund",
          amountELF: refund,
          paperId: args.store.paperId,
          workOrderId: order.id,
          detail: "Stake refunded (pass)",
        },
        {
          id: makeId("led"),
          version: 1,
          at: now,
          type: "reward",
          amountELF: reward,
          paperId: args.store.paperId,
          workOrderId: order.id,
          detail: `Reward minted to ${args.profile.handle} (pass)`,
        },
      ];

      return { profile, store: { ...args.store, updatedAt: now, orders: updatedOrders, ledger } };
    }

    const profile: ValidatorProfileV1 = { ...args.profile, updatedAt: now };
    const updatedOrders: WorkOrderV1[] = args.store.orders.map((o) => {
      if (o.id !== order.id) return o;
      return {
        ...o,
        status: "pass_pending_audit",
        attemptCount: o.attemptCount + 1,
        lastAttempt: baseAttempt,
        audit: makeAudit(o, now, rate),
      };
    });

    return { profile, store: { ...args.store, updatedAt: now, orders: updatedOrders } };
  }

  const profile: ValidatorProfileV1 = {
    ...args.profile,
    updatedAt: now,
    reputation: Math.max(0, args.profile.reputation - order.repSlash),
  };

  const updatedOrders: WorkOrderV1[] = args.store.orders.map((o) => {
    if (o.id !== order.id) return o;
    return {
      ...o,
      status: "open",
      attemptCount: o.attemptCount + 1,
      lastAttempt: baseAttempt,
      claimedBy: undefined,
      claimedAt: undefined,
      dueAt: undefined,
      audit: undefined,
    };
  });

  const ledger: LedgerEntryV1[] = [
    ...args.store.ledger,
    {
      id: makeId("led"),
      version: 1,
      at: now,
      type: "stake_slash",
      amountELF: 0,
      paperId: args.store.paperId,
      workOrderId: order.id,
      detail: "Stake slashed (fail) - rollback to OPEN",
    },
  ];

  return { profile, store: { ...args.store, updatedAt: now, orders: updatedOrders, ledger } };
}

export function claimAudit(args: {
  auditor: ValidatorProfileV1;
  store: WorkOrdersStoreV1;
  workOrderId: string;
}): { auditor: ValidatorProfileV1; store: WorkOrdersStoreV1 } {
  const now = new Date().toISOString();
  const order = args.store.orders.find((o) => o.id === args.workOrderId);
  if (!order) throw new Error("Work order not found.");
  if (order.status !== "pass_pending_audit") throw new Error("Work order is not awaiting audit.");
  if (!order.claimedBy) throw new Error("Missing submitter for audit.");
  if (order.claimedBy === args.auditor.handle) throw new Error("Submitter cannot audit their own result.");

  const current = order.audit?.required ? order.audit : makeAudit(order, now, DEFAULT_AUDIT_RATE);
  if (current.status !== "pending") throw new Error("Audit is already claimed or finalized.");

  const audit: WorkOrderAuditV1 = {
    ...current,
    status: "claimed",
    claimedBy: args.auditor.handle,
    claimedAt: now,
  };

  const auditor: ValidatorProfileV1 = { ...args.auditor, updatedAt: now };

  const updatedOrders: WorkOrderV1[] = args.store.orders.map((o) => (o.id === order.id ? { ...o, audit } : o));
  return { auditor, store: { ...args.store, updatedAt: now, orders: updatedOrders } };
}

export function submitAudit(args: {
  auditor: ValidatorProfileV1;
  submitter: ValidatorProfileV1;
  store: WorkOrdersStoreV1;
  workOrderId: string;
  decision: "confirm" | "reject";
  artifactUrl?: string;
  artifactHash?: string;
  notes?: string;
}): { auditor: ValidatorProfileV1; submitter: ValidatorProfileV1; store: WorkOrdersStoreV1 } {
  const now = new Date().toISOString();
  const order = args.store.orders.find((o) => o.id === args.workOrderId);
  if (!order) throw new Error("Work order not found.");
  if (order.status !== "pass_pending_audit") throw new Error("Work order is not awaiting audit.");
  if (!order.audit?.required) throw new Error("Audit is not required for this work order.");
  if (order.audit.status !== "claimed") throw new Error("Audit must be claimed before submission.");
  if (order.audit.claimedBy !== args.auditor.handle) throw new Error("Audit is claimed by another validator.");
  if (order.claimedBy !== args.submitter.handle) throw new Error("Submitter profile does not match work order.");

  const payload = {
    artifactUrl: (args.artifactUrl || "").trim() || undefined,
    artifactHash: (args.artifactHash || "").trim() || undefined,
    notes: (args.notes || "").trim() || undefined,
  };

  const auditorReward = order.audit.rewardELF;
  const auditorProfile: ValidatorProfileV1 = {
    ...args.auditor,
    updatedAt: now,
    reputation: Math.max(0, args.auditor.reputation + order.audit.repReward),
    tokensELF: Number((args.auditor.tokensELF + auditorReward).toFixed(2)),
  };

  const audit: WorkOrderAuditV1 = {
    ...order.audit,
    status: args.decision === "confirm" ? "confirmed" : "rejected",
    decidedAt: now,
    decision: args.decision,
    artifactUrl: payload.artifactUrl,
    artifactHash: payload.artifactHash,
    notes: payload.notes,
  };

  if (args.decision === "confirm") {
    const submitterProfile: ValidatorProfileV1 = {
      ...args.submitter,
      updatedAt: now,
      reputation: Math.max(0, args.submitter.reputation + order.repReward),
      tokensELF: Number((args.submitter.tokensELF + order.stakeELF + order.rewardELF).toFixed(2)),
    };

    const updatedOrders: WorkOrderV1[] = args.store.orders.map((o) => (o.id === order.id ? { ...o, status: "passed", audit } : o));

    const ledger: LedgerEntryV1[] = [
      ...args.store.ledger,
      {
        id: makeId("led"),
        version: 1,
        at: now,
        type: "stake_refund",
        amountELF: order.stakeELF,
        paperId: args.store.paperId,
        workOrderId: order.id,
        detail: `Stake refunded after audit (submitter: ${args.submitter.handle})`,
      },
      {
        id: makeId("led"),
        version: 1,
        at: now,
        type: "reward",
        amountELF: order.rewardELF,
        paperId: args.store.paperId,
        workOrderId: order.id,
        detail: `Reward released after audit (submitter: ${args.submitter.handle})`,
      },
      {
        id: makeId("led"),
        version: 1,
        at: now,
        type: "reward",
        amountELF: auditorReward,
        paperId: args.store.paperId,
        workOrderId: order.id,
        detail: `Audit reward minted to ${args.auditor.handle}`,
      },
    ];

    return {
      auditor: auditorProfile,
      submitter: submitterProfile,
      store: { ...args.store, updatedAt: now, orders: updatedOrders, ledger },
    };
  }

  const penalty = Math.max(order.repSlash, Math.round(order.repSlash * 1.5));
  const submitterProfile: ValidatorProfileV1 = {
    ...args.submitter,
    updatedAt: now,
    reputation: Math.max(0, args.submitter.reputation - penalty),
  };

  const updatedOrders: WorkOrderV1[] = args.store.orders.map((o) =>
    o.id === order.id
      ? {
          ...o,
          status: "open",
          claimedBy: undefined,
          claimedAt: undefined,
          dueAt: undefined,
          audit,
        }
      : o
  );

  const ledger: LedgerEntryV1[] = [
    ...args.store.ledger,
    {
      id: makeId("led"),
      version: 1,
      at: now,
      type: "stake_slash",
      amountELF: 0,
      paperId: args.store.paperId,
      workOrderId: order.id,
      detail: `Stake burned after audit reject (submitter: ${args.submitter.handle})`,
    },
    {
      id: makeId("led"),
      version: 1,
      at: now,
      type: "reward",
      amountELF: auditorReward,
      paperId: args.store.paperId,
      workOrderId: order.id,
      detail: `Audit reward minted to ${args.auditor.handle}`,
    },
  ];

  return {
    auditor: auditorProfile,
    submitter: submitterProfile,
    store: { ...args.store, updatedAt: now, orders: updatedOrders, ledger },
  };
}

export function forkWorkOrder(args: { order: WorkOrderV1; poolSize?: number; size?: number }): WorkOrderV1 {
  const now = new Date().toISOString();
  const poolSize =
    Number.isFinite(args.poolSize) && (args.poolSize as number) > 0 ? (args.poolSize as number) : args.order.subsample.poolSize;
  const size = Number.isFinite(args.size) && (args.size as number) > 0 ? (args.size as number) : args.order.subsample.size;
  const seed = hashStringToUint32(`${args.order.paperId}|${args.order.id}|fork|${now}`);
  const indices = pickSubsampleIndices(seed, poolSize, Math.min(16, size));

  return {
    ...args.order,
    id: makeId("wo"),
    createdAt: now,
    status: "open",
    seed,
    subsample: { method: "random", poolSize, size, indices },
    attemptCount: 0,
    claimedBy: undefined,
    claimedAt: undefined,
    dueAt: undefined,
    lastAttempt: undefined,
    audit: undefined,
  };
}
