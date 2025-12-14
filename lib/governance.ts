export type GovernanceActorRole = "community" | "author" | "editor" | "curator" | "system";

export type GovernanceModerationAction =
  | "approve"
  | "soft_hide"
  | "remove"
  | "request_evidence"
  | "rate_limit"
  | "temporary_ban";

export type GovernanceReasonCode =
  | "off_topic"
  | "no_evidence_for_strong_claim"
  | "personal_attack"
  | "spam"
  | "duplicate"
  | "misleading_citation";

export type GovernanceTargetType =
  | "paper"
  | "actor"
  | "comment"
  | "review"
  | "external_review_artifact"
  | "work_order"
  | "submission"
  | "bounty";

export type GovernanceLogEntry = {
  id: string;
  createdAt: string;
  actor: { role: GovernanceActorRole; name: string };
  target: { type: GovernanceTargetType; id: string };
  action: string;
  moderationAction?: GovernanceModerationAction;
  reasonCode?: GovernanceReasonCode;
  reason?: string;
  meta?: Record<string, unknown>;
};

type GovernanceLogStoreV1 = {
  version: 1;
  entries: unknown;
};

export function governanceLogKey(paperId: string) {
  return `omega_governance_log_v1:${paperId}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && (value as object).constructor === Object;
}

function normalizeActorRole(value: unknown): GovernanceActorRole {
  switch (value) {
    case "community":
    case "author":
    case "editor":
    case "curator":
    case "system":
      return value;
    default:
      return "community";
  }
}

function normalizeTargetType(value: unknown): GovernanceTargetType {
  switch (value) {
    case "paper":
    case "actor":
    case "comment":
    case "review":
    case "external_review_artifact":
    case "work_order":
    case "submission":
    case "bounty":
      return value;
    default:
      return "paper";
  }
}

function normalizeModerationAction(value: unknown): GovernanceModerationAction | undefined {
  switch (value) {
    case "approve":
    case "soft_hide":
    case "remove":
    case "request_evidence":
    case "rate_limit":
    case "temporary_ban":
      return value;
    default:
      return undefined;
  }
}

function normalizeReasonCode(value: unknown): GovernanceReasonCode | undefined {
  switch (value) {
    case "off_topic":
    case "no_evidence_for_strong_claim":
    case "personal_attack":
    case "spam":
    case "duplicate":
    case "misleading_citation":
      return value;
    default:
      return undefined;
  }
}

export function formatGovernanceReason(code: GovernanceReasonCode) {
  switch (code) {
    case "off_topic":
      return "Off-topic / 跑题";
    case "no_evidence_for_strong_claim":
      return "No evidence for strong claim / 强主张无证据";
    case "personal_attack":
      return "Personal attack / 人身攻击";
    case "spam":
      return "Spam / 垃圾内容";
    case "duplicate":
      return "Duplicate / 重复";
    case "misleading_citation":
      return "Misleading citation / 误导性引用";
  }
}

export function formatGovernanceModerationAction(action: GovernanceModerationAction) {
  switch (action) {
    case "approve":
      return "Approve / 通过";
    case "soft_hide":
      return "Soft hide / 折叠";
    case "remove":
      return "Remove / 移除";
    case "request_evidence":
      return "Request evidence / 要求补证据";
    case "rate_limit":
      return "Rate limit / 限流";
    case "temporary_ban":
      return "Temporary ban / 临时封禁";
  }
}

export function normalizeGovernanceLogEntry(value: unknown): GovernanceLogEntry | null {
  if (!isPlainObject(value)) return null;

  const id = typeof value.id === "string" ? value.id : "";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : "";
  if (!id || !createdAt) return null;

  const actorRaw = value.actor;
  const actor = isPlainObject(actorRaw) ? actorRaw : {};
  const actorName = typeof actor.name === "string" ? actor.name.trim() : "";

  const targetRaw = value.target;
  const target = isPlainObject(targetRaw) ? targetRaw : {};
  const targetId = typeof target.id === "string" ? target.id.trim() : "";

  const action = typeof value.action === "string" ? value.action.trim() : "";
  if (!action || !actorName || !targetId) return null;

  const moderationAction = normalizeModerationAction(value.moderationAction);
  const reasonCode = normalizeReasonCode(value.reasonCode);
  const reason = typeof value.reason === "string" ? value.reason.trim() : undefined;
  const meta = isPlainObject(value.meta) ? (value.meta as Record<string, unknown>) : undefined;

  return {
    id,
    createdAt,
    actor: { role: normalizeActorRole(actor.role), name: actorName },
    target: { type: normalizeTargetType(target.type), id: targetId },
    action,
    moderationAction,
    reasonCode,
    reason: reason || undefined,
    meta,
  };
}

export function normalizeGovernanceLogEntries(value: unknown): GovernanceLogEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeGovernanceLogEntry).filter(Boolean) as GovernanceLogEntry[];
}

export function loadGovernanceLog(paperId: string): GovernanceLogEntry[] {
  if (!paperId) return [];
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(governanceLogKey(paperId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GovernanceLogStoreV1;
    if (!parsed || parsed.version !== 1) return [];
    const entries = normalizeGovernanceLogEntries(parsed.entries);
    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function persistGovernanceLog(paperId: string, entries: GovernanceLogEntry[]) {
  if (!paperId) return;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(governanceLogKey(paperId), JSON.stringify({ version: 1, entries }));
  } catch {
    // ignore persistence failures (private mode, etc.)
  }
}

export function createGovernanceLogEntry(args: Omit<GovernanceLogEntry, "id" | "createdAt"> & { id?: string; createdAt?: string }): GovernanceLogEntry {
  const createdAt = args.createdAt || new Date().toISOString();
  const id = args.id || (globalThis.crypto?.randomUUID?.() ? `gov-${globalThis.crypto.randomUUID()}` : `gov-${Date.now()}`);
  return { ...args, id, createdAt };
}

export function appendGovernanceLogEntry(existing: GovernanceLogEntry[], entry: GovernanceLogEntry, maxEntries = 600): GovernanceLogEntry[] {
  const next = [entry, ...(existing || [])];
  return next.slice(0, Math.max(50, Math.min(2000, maxEntries)));
}
