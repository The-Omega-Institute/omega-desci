import type { OmegaReviewTaskStatus } from "@/lib/review/protocol/types";

export type OmegaQueueJobStatus = Exclude<OmegaReviewTaskStatus, "manual">;
export type OmegaQueueJobType = "reproduction_ticket";
export type OmegaQueueSandboxMode = "simulated" | "docker";

export type OmegaQueueJobV1<Input = unknown, Output = unknown> = {
  version: 1;
  id: string;
  type: OmegaQueueJobType;
  sandbox: OmegaQueueSandboxMode;
  createdAt: string;
  status: OmegaQueueJobStatus;
  startedAt?: string;
  finishedAt?: string;
  input: Input;
  output?: Output;
  error?: string;
};

type QueueState = {
  running: boolean;
  jobs: Map<string, OmegaQueueJobV1>;
  order: string[];
};

function state(): QueueState {
  const g = globalThis as typeof globalThis & { __omegaQueue?: QueueState };
  if (!g.__omegaQueue) g.__omegaQueue = { running: false, jobs: new Map(), order: [] };
  return g.__omegaQueue;
}

function makeId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}`;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function hashStringToUint32(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function runJob(job: OmegaQueueJobV1) {
  if (job.type === "reproduction_ticket") {
    const seedSource = JSON.stringify(job.input);
    const seed = hashStringToUint32(seedSource);
    await delay(800 + (seed % 700));
    const score = (seed % 1000) / 1000;
    const verdict = score > 0.18 ? "pass" : "fail";
    return {
      verdict,
      score: Number(score.toFixed(3)),
      sandbox: job.sandbox,
      note: job.sandbox === "simulated" ? "Simulated execution (demo). Replace with sandboxed runner." : "Sandbox runner required.",
    };
  }
  return { ok: true };
}

async function kick() {
  const q = state();
  if (q.running) return;

  const nextId = q.order.find((id) => q.jobs.get(id)?.status === "queued") || null;
  if (!nextId) return;

  const job = q.jobs.get(nextId);
  if (!job) return;

  q.running = true;
  const now = new Date().toISOString();
  job.status = "running";
  job.startedAt = now;
  q.jobs.set(job.id, job);

  try {
    const output = await runJob(job);
    job.status = "succeeded";
    job.finishedAt = new Date().toISOString();
    job.output = output;
    job.error = undefined;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Queue job failed.";
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    job.error = message;
  } finally {
    q.jobs.set(job.id, job);
    q.running = false;
    setTimeout(() => void kick(), 0);
  }
}

export function enqueueJob<Input>(args: { type: OmegaQueueJobType; input: Input; sandbox?: OmegaQueueSandboxMode }) {
  const q = state();
  const sandbox: OmegaQueueSandboxMode = args.sandbox || (process.env.OMEGA_QUEUE_MODE === "docker" ? "docker" : "simulated");

  const job: OmegaQueueJobV1<Input> = {
    version: 1,
    id: makeId("job"),
    type: args.type,
    sandbox,
    createdAt: new Date().toISOString(),
    status: "queued",
    input: args.input,
  };

  q.jobs.set(job.id, job as OmegaQueueJobV1);
  q.order.unshift(job.id);
  setTimeout(() => void kick(), 0);
  return job;
}

export function getJob(id: string) {
  return state().jobs.get(id) || null;
}

export function listJobs() {
  const q = state();
  return q.order.map((id) => q.jobs.get(id)).filter(Boolean) as OmegaQueueJobV1[];
}

