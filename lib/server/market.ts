import { promises as fs } from "fs";
import path from "path";
import type { OmegaReviewArtifactV1 } from "@/lib/review/protocol/types";

export type MarketBountyStatus = "open" | "claimed" | "pass_pending_audit" | "passed";
export type MarketAuditStatus = "pending" | "claimed" | "confirmed" | "rejected";

export type MarketAuditV1 = {
  version: 1;
  status: MarketAuditStatus;
  rewardELF: number;
  claimedBy?: string;
  claimedAt?: string;
  decidedAt?: string;
  decision?: "confirm" | "reject";
  artifactUrl?: string;
  artifactHash?: string;
  notes?: string;
};

export type MarketBountyV1 = {
  version: 1;
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
  status: MarketBountyStatus;

  claimedBy?: string;
  claimedAt?: string;
  lastAttempt?: {
    by: string;
    at: string;
    result: "pass" | "fail";
    artifactUrl?: string;
    artifactHash?: string;
    notes?: string;
  };
  audit?: MarketAuditV1;
};

type MarketDiskV1 = {
  version: 1;
  updatedAt: string;
  bounties: MarketBountyV1[];
};

type MarketState = {
  loaded?: boolean;
  byId: Map<string, MarketBountyV1>;
};

function state(): MarketState {
  const g = globalThis as typeof globalThis & { __omegaMarket?: MarketState };
  if (!g.__omegaMarket) g.__omegaMarket = { byId: new Map() };
  return g.__omegaMarket;
}

function resolveMarketFile() {
  const env = (process.env.OMEGA_MARKET_FILE || "").trim();
  if (env) return path.isAbsolute(env) ? env : path.join(process.cwd(), env);
  return path.join(process.cwd(), ".omega", "market.json");
}

async function loadOnce() {
  const st = state();
  if (st.loaded) return;
  st.loaded = true;

  const file = resolveMarketFile();
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<MarketDiskV1>;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.bounties)) return;
    for (const b of parsed.bounties) {
      if (!b || (b as MarketBountyV1).version !== 1) continue;
      const bounty = b as MarketBountyV1;
      if (!bounty.id || !bounty.artifactHash || !bounty.paperId || !bounty.claim) continue;
      st.byId.set(bounty.id, bounty);
    }
  } catch {
    // ignore
  }
}

async function persist() {
  const file = resolveMarketFile();
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
  const payload: MarketDiskV1 = {
    version: 1,
    updatedAt: new Date().toISOString(),
    bounties: Array.from(state().byId.values()),
  };
  await fs.writeFile(file, JSON.stringify(payload, null, 2), "utf8").catch(() => {});
}

function auditReward(rewardELF: number) {
  return Math.max(10, Math.round(rewardELF * 0.35));
}

function makeAudit(rewardELF: number): MarketAuditV1 {
  return {
    version: 1,
    status: "pending",
    rewardELF: auditReward(rewardELF),
  };
}

export async function seedBountiesFromArtifact(artifact: OmegaReviewArtifactV1) {
  await loadOnce();

  const tasks = Array.isArray(artifact.payload.tasks) ? artifact.payload.tasks : [];
  const paper = artifact.payload.paper;

  const bountyTasks = tasks.filter((t) => (t as { kind?: string }).kind === "reproduction_ticket") as Array<
    { id?: string; detail?: string; claim?: string; rewardELF?: number; stakeELF?: number; controversyScore?: number; alignmentStatus?: string; evidenceIds?: string[] }
  >;

  let changed = false;
  for (const t of bountyTasks) {
    const taskId = (t.id || "").trim();
    const claim = (t.claim || "").trim();
    const rewardELF = typeof t.rewardELF === "number" ? t.rewardELF : null;
    const stakeELF = typeof t.stakeELF === "number" ? t.stakeELF : null;
    if (!taskId || !claim || rewardELF === null || stakeELF === null) continue;

    const id = `bty-${artifact.hash.replace("sha256:", "").slice(0, 12)}-${taskId}`;
    if (state().byId.has(id)) continue;

    const now = new Date().toISOString();
    const bounty: MarketBountyV1 = {
      version: 1,
      id,
      createdAt: now,
      updatedAt: now,
      artifactHash: artifact.hash,
      paperId: paper.id,
      paperTitle: paper.title,
      paperDoi: paper.doi,
      claim,
      detail: (t.detail || "Reproduction bounty").trim() || "Reproduction bounty",
      alignmentStatus: t.alignmentStatus,
      controversyScore: typeof t.controversyScore === "number" ? t.controversyScore : undefined,
      evidenceIds: Array.isArray(t.evidenceIds) ? t.evidenceIds : undefined,
      rewardELF,
      stakeELF,
      status: "open",
    };

    state().byId.set(id, bounty);
    changed = true;
  }

  if (changed) await persist();
}

export async function listBounties() {
  await loadOnce();
  return Array.from(state().byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getBounty(id: string) {
  await loadOnce();
  return state().byId.get(id) || null;
}

export async function claimBounty(args: { id: string; handle: string }) {
  await loadOnce();
  const handle = args.handle.trim();
  if (!handle) throw new Error("Missing handle.");
  const bounty = state().byId.get(args.id);
  if (!bounty) throw new Error("Bounty not found.");
  if (bounty.status !== "open") throw new Error("Bounty is not open.");

  const now = new Date().toISOString();
  const next: MarketBountyV1 = {
    ...bounty,
    updatedAt: now,
    status: "claimed",
    claimedBy: handle,
    claimedAt: now,
  };
  state().byId.set(bounty.id, next);
  await persist();
  return next;
}

export async function submitBounty(args: {
  id: string;
  handle: string;
  result: "pass" | "fail";
  artifactUrl?: string;
  artifactHash?: string;
  notes?: string;
}) {
  await loadOnce();
  const handle = args.handle.trim();
  if (!handle) throw new Error("Missing handle.");
  const bounty = state().byId.get(args.id);
  if (!bounty) throw new Error("Bounty not found.");
  if (bounty.status !== "claimed") throw new Error("Bounty is not claimed.");
  if (bounty.claimedBy !== handle) throw new Error("Bounty is claimed by another validator.");

  const now = new Date().toISOString();
  const attempt = {
    by: handle,
    at: now,
    result: args.result,
    artifactUrl: (args.artifactUrl || "").trim() || undefined,
    artifactHash: (args.artifactHash || "").trim() || undefined,
    notes: (args.notes || "").trim() || undefined,
  };

  if (args.result === "fail") {
    const next: MarketBountyV1 = {
      ...bounty,
      updatedAt: now,
      status: "open",
      lastAttempt: attempt,
      claimedBy: undefined,
      claimedAt: undefined,
      audit: undefined,
    };
    state().byId.set(bounty.id, next);
    await persist();
    return next;
  }

  const next: MarketBountyV1 = {
    ...bounty,
    updatedAt: now,
    status: "pass_pending_audit",
    lastAttempt: attempt,
    audit: makeAudit(bounty.rewardELF),
  };
  state().byId.set(bounty.id, next);
  await persist();
  return next;
}

export async function claimBountyAudit(args: { id: string; handle: string }) {
  await loadOnce();
  const handle = args.handle.trim();
  if (!handle) throw new Error("Missing handle.");
  const bounty = state().byId.get(args.id);
  if (!bounty) throw new Error("Bounty not found.");
  if (bounty.status !== "pass_pending_audit") throw new Error("Bounty is not awaiting audit.");
  if (bounty.claimedBy === handle) throw new Error("Submitter cannot audit their own result.");
  if (!bounty.audit || bounty.audit.status !== "pending") throw new Error("Audit is already claimed/finalized.");

  const now = new Date().toISOString();
  const next: MarketBountyV1 = {
    ...bounty,
    updatedAt: now,
    audit: {
      ...bounty.audit,
      status: "claimed",
      claimedBy: handle,
      claimedAt: now,
    },
  };
  state().byId.set(bounty.id, next);
  await persist();
  return next;
}

export async function submitBountyAudit(args: {
  id: string;
  handle: string;
  decision: "confirm" | "reject";
  artifactUrl?: string;
  artifactHash?: string;
  notes?: string;
}) {
  await loadOnce();
  const handle = args.handle.trim();
  if (!handle) throw new Error("Missing handle.");
  const bounty = state().byId.get(args.id);
  if (!bounty) throw new Error("Bounty not found.");
  if (bounty.status !== "pass_pending_audit") throw new Error("Bounty is not awaiting audit.");
  if (!bounty.audit || bounty.audit.status !== "claimed") throw new Error("Audit must be claimed first.");
  if (bounty.audit.claimedBy !== handle) throw new Error("Audit is claimed by another validator.");

  const now = new Date().toISOString();
  const audit: MarketAuditV1 = {
    ...bounty.audit,
    status: args.decision === "confirm" ? "confirmed" : "rejected",
    decidedAt: now,
    decision: args.decision,
    artifactUrl: (args.artifactUrl || "").trim() || undefined,
    artifactHash: (args.artifactHash || "").trim() || undefined,
    notes: (args.notes || "").trim() || undefined,
  };

  if (args.decision === "confirm") {
    const next: MarketBountyV1 = {
      ...bounty,
      updatedAt: now,
      status: "passed",
      audit,
    };
    state().byId.set(bounty.id, next);
    await persist();
    return next;
  }

  const next: MarketBountyV1 = {
    ...bounty,
    updatedAt: now,
    status: "open",
    claimedBy: undefined,
    claimedAt: undefined,
    audit,
  };
  state().byId.set(bounty.id, next);
  await persist();
  return next;
}

