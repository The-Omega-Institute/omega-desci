export type AccountTier = "new" | "established" | "high_reputation" | "reviewer";

type ActorTiersStoreV1 = {
  version: 1;
  updatedAt: string;
  tiersByHandle: Record<string, AccountTier>;
};

export function actorTiersKey() {
  return "omega_actor_tiers_v1";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && (value as object).constructor === Object;
}

export function normalizeHandle(input: string) {
  return String(input || "").trim();
}

export function handleKey(handle: string) {
  return normalizeHandle(handle).toLowerCase();
}

export function normalizeAccountTier(value: unknown): AccountTier {
  switch (value) {
    case "new":
    case "established":
    case "high_reputation":
    case "reviewer":
      return value;
    default:
      return "new";
  }
}

export function formatAccountTier(tier: AccountTier) {
  switch (tier) {
    case "new":
      return "New account / 新账号";
    case "established":
      return "Established / 已建立";
    case "high_reputation":
      return "High reputation / 高信誉";
    case "reviewer":
      return "Reviewer / 审稿人";
  }
}

export function loadActorTiers() {
  if (typeof window === "undefined") return {} as Record<string, AccountTier>;
  try {
    const raw = window.localStorage.getItem(actorTiersKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<ActorTiersStoreV1>;
    if (!parsed || parsed.version !== 1) return {};
    const mapRaw = parsed.tiersByHandle;
    if (!isPlainObject(mapRaw)) return {};
    const out: Record<string, AccountTier> = {};
    for (const [k, v] of Object.entries(mapRaw)) {
      if (typeof k !== "string" || !k.trim()) continue;
      out[k] = normalizeAccountTier(v);
    }
    return out;
  } catch {
    return {};
  }
}

export function persistActorTiers(tiersByHandle: Record<string, AccountTier>) {
  if (typeof window === "undefined") return;
  try {
    const payload: ActorTiersStoreV1 = { version: 1, updatedAt: new Date().toISOString(), tiersByHandle };
    window.localStorage.setItem(actorTiersKey(), JSON.stringify(payload));
  } catch {
    // ignore persistence failures (private mode, etc.)
  }
}

