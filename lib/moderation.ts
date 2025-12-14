import type { GovernanceReasonCode } from "@/lib/governance";

export type ActorSanctionKind = "rate_limit" | "temporary_ban";

export type ActorSanction = {
  id: string;
  kind: ActorSanctionKind;
  createdAt: string;
  until: string;
  actor: { name: string; key: string };
  issuedBy: { name: string };
  reasonCode: GovernanceReasonCode;
  note?: string;
};

type ActorSanctionStoreV1 = {
  version: 1;
  sanctions: unknown;
};

export function actorSanctionsKey() {
  return "omega_actor_sanctions_v1";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && (value as object).constructor === Object;
}

function normalizeSanctionKind(value: unknown): ActorSanctionKind | null {
  switch (value) {
    case "rate_limit":
    case "temporary_ban":
      return value;
    default:
      return null;
  }
}

function normalizeReasonCode(value: unknown): GovernanceReasonCode | null {
  switch (value) {
    case "off_topic":
    case "no_evidence_for_strong_claim":
    case "personal_attack":
    case "spam":
    case "duplicate":
    case "misleading_citation":
      return value;
    default:
      return null;
  }
}

export function actorKey(name: string) {
  return String(name || "").trim().toLowerCase();
}

export function normalizeActorSanction(value: unknown): ActorSanction | null {
  if (!isPlainObject(value)) return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const kind = normalizeSanctionKind(value.kind);
  const createdAt = typeof value.createdAt === "string" ? value.createdAt.trim() : "";
  const until = typeof value.until === "string" ? value.until.trim() : "";
  const reasonCode = normalizeReasonCode(value.reasonCode);

  const actorRaw = value.actor;
  const actorObj = isPlainObject(actorRaw) ? actorRaw : {};
  const actorName = typeof actorObj.name === "string" ? actorObj.name.trim() : "";
  const key = typeof actorObj.key === "string" ? actorObj.key.trim() : actorKey(actorName);

  const issuedByRaw = value.issuedBy;
  const issuedByObj = isPlainObject(issuedByRaw) ? issuedByRaw : {};
  const issuedByName = typeof issuedByObj.name === "string" ? issuedByObj.name.trim() : "";

  const note = typeof value.note === "string" ? value.note.trim() : undefined;

  if (!id || !kind || !createdAt || !until || !reasonCode || !actorName || !key || !issuedByName) return null;
  return {
    id,
    kind,
    createdAt,
    until,
    actor: { name: actorName, key },
    issuedBy: { name: issuedByName },
    reasonCode,
    note: note || undefined,
  };
}

export function normalizeActorSanctions(value: unknown): ActorSanction[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeActorSanction).filter(Boolean) as ActorSanction[];
}

export function loadActorSanctions() {
  if (typeof window === "undefined") return [] as ActorSanction[];
  try {
    const raw = window.localStorage.getItem(actorSanctionsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActorSanctionStoreV1;
    if (!parsed || parsed.version !== 1) return [];
    return normalizeActorSanctions(parsed.sanctions);
  } catch {
    return [];
  }
}

export function persistActorSanctions(sanctions: ActorSanction[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(actorSanctionsKey(), JSON.stringify({ version: 1, sanctions }));
  } catch {
    // ignore persistence failures (private mode, etc.)
  }
}

export function isSanctionActive(s: ActorSanction, nowMs = Date.now()) {
  const until = new Date(s.until).getTime();
  if (!Number.isFinite(until)) return false;
  return until > nowMs;
}

export function getActiveSanctionForActor(sanctions: ActorSanction[], name: string, nowMs = Date.now()) {
  const key = actorKey(name);
  if (!key) return null;
  const active = sanctions.filter((s) => s.actor.key === key && isSanctionActive(s, nowMs));
  if (!active.length) return null;
  active.sort((a, b) => {
    const aUntil = new Date(a.until).getTime();
    const bUntil = new Date(b.until).getTime();
    if (a.kind !== b.kind) return a.kind === "temporary_ban" ? -1 : 1; // ban > rate_limit
    return bUntil - aUntil;
  });
  return active[0] || null;
}

