import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { OmegaReviewArtifactV1, OmegaReviewPayloadV1, OmegaReviewProtocolId } from "@/lib/review/protocol/types";

type ArtifactStoreState = {
  byHash: Map<string, OmegaReviewArtifactV1>;
  diskScanned?: boolean;
};

function storeState(): ArtifactStoreState {
  const g = globalThis as typeof globalThis & { __omegaArtifacts?: ArtifactStoreState };
  if (!g.__omegaArtifacts) g.__omegaArtifacts = { byHash: new Map() };
  return g.__omegaArtifacts;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && (value as object).constructor === Object;
}

export function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Hex(text: string) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashPayload(payload: unknown) {
  const canonical = stableStringify(payload);
  return `sha256:${sha256Hex(canonical)}`;
}

function makeId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}`;
}

export function makeReviewArtifact(args: {
  protocol?: OmegaReviewProtocolId;
  payload: OmegaReviewPayloadV1;
  createdAt?: string;
}): OmegaReviewArtifactV1 {
  const createdAt = args.createdAt || new Date().toISOString();
  const protocol = args.protocol || "omega-review-protocol-v1";
  const hash = hashPayload({ version: 1, protocol, payload: args.payload });
  const id = `art-${hash.slice("sha256:".length, "sha256:".length + 12)}-${makeId("r")}`;
  return {
    version: 1,
    protocol,
    id,
    createdAt,
    hashAlg: "sha256",
    hash,
    payload: args.payload,
  };
}

function resolveArtifactDir() {
  const dir = (process.env.OMEGA_ARTIFACT_DIR || "").trim();
  if (dir) return path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  return path.join(process.cwd(), ".omega", "artifacts");
}

async function persistArtifact(artifact: OmegaReviewArtifactV1) {
  const outDir = resolveArtifactDir();
  await fs.mkdir(outDir, { recursive: true }).catch(() => {});
  const outPath = path.join(outDir, `${artifact.hash.replace("sha256:", "")}.json`);
  await fs.writeFile(outPath, JSON.stringify(artifact, null, 2), "utf8");
}

export function putArtifact(artifact: OmegaReviewArtifactV1) {
  const state = storeState();
  state.byHash.set(artifact.hash, artifact);
  void persistArtifact(artifact).catch(() => {});
}

async function loadArtifactFromDisk(hash: string) {
  const state = storeState();
  const existing = state.byHash.get(hash);
  if (existing) return existing;

  const outDir = resolveArtifactDir();
  const file = path.join(outDir, `${hash.replace("sha256:", "")}.json`);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as OmegaReviewArtifactV1;
    if (!parsed || parsed.hash !== hash) return null;
    state.byHash.set(hash, parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function scanDiskOnce() {
  const state = storeState();
  if (state.diskScanned) return;
  state.diskScanned = true;

  const outDir = resolveArtifactDir();
  let files: string[] = [];
  try {
    files = await fs.readdir(outDir);
  } catch {
    return;
  }

  const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json")).slice(0, 200);
  await Promise.all(
    jsonFiles.map(async (file) => {
      const full = path.join(outDir, file);
      try {
        const raw = await fs.readFile(full, "utf8");
        const parsed = JSON.parse(raw) as OmegaReviewArtifactV1;
        if (!parsed || typeof parsed.hash !== "string") return;
        state.byHash.set(parsed.hash, parsed);
      } catch {
        // ignore
      }
    })
  );
}

export async function getArtifact(hash: string) {
  const cached = storeState().byHash.get(hash);
  if (cached) return cached;
  await scanDiskOnce();
  return (await loadArtifactFromDisk(hash)) || null;
}

export async function listArtifacts() {
  await scanDiskOnce();
  return Array.from(storeState().byHash.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
