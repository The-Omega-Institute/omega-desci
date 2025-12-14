"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Comment,
  CommentAuthorRole,
  CommentKind,
  CommentReply,
  CommentStatus,
  ContributorRole,
  ExternalReviewArtifact,
  ExternalReviewArtifactStatus,
  ExternalReviewCuratorRole,
  ExternalReviewEvidenceAttachment,
  ExternalReviewEvidenceAttachmentKind,
  ExternalReviewSourceAccess,
  ExternalReviewSourceType,
  Paper,
  Review,
} from "@/lib/mockData";
import type { GovernanceLogEntry, GovernanceModerationAction, GovernanceReasonCode } from "@/lib/governance";
import {
  appendGovernanceLogEntry,
  createGovernanceLogEntry,
  formatGovernanceModerationAction,
  formatGovernanceReason,
  loadGovernanceLog,
  persistGovernanceLog,
} from "@/lib/governance";
import type { AccountTier } from "@/lib/identity";
import { formatAccountTier, handleKey, loadActorTiers, persistActorTiers } from "@/lib/identity";
import type { ActorSanction } from "@/lib/moderation";
import { actorKey, getActiveSanctionForActor, loadActorSanctions, persistActorSanctions } from "@/lib/moderation";
import type { ClaimEvidence, EvidencePointer } from "@/lib/review/evidence";
import { 
  SheetContent, 
  Tabs, TabsList, TabsTrigger, TabsContent,
  Button, Badge, ScrollArea,
  TooltipProvider, Tooltip, TooltipTrigger, TooltipContent
} from "@/components/ui/shadcn";
import { EpistemicReviewPanel } from "@/components/review/EpistemicReviewPanel";
import { AuditReportPanel } from "@/components/review/AuditReportPanel";
import { SteelmanDefensePanel } from "@/components/review/SteelmanDefensePanel";
import { VerificationWorkOrdersPanel } from "@/components/review/VerificationWorkOrdersPanel";
import { ExternalLink, ShieldCheck, GitBranch, Terminal, FileText, Copy } from "lucide-react";

interface PaperDrawerProps {
  paper: Paper | null;
}

type AssumptionLedgerEntry = {
  assumption: string;
  whyNeeded: string;
  falsify: string;
};

type PriorWorkEntry = {
  citation: string;
  inherits: string;
  conflicts: string;
  differs: string;
};

const DEFAULT_EXTERNAL_REVIEW_ATTESTATION = [
  "I attest this External Review Artifact is accurate, properly attributed, and permission-compliant. If excerpts are included, they are quoted verbatim and within license/authorization. Any sensitive information in attachments is redacted.",
  "我声明本 External Review Artifact 信息准确、归因清晰，并遵守许可/授权要求；如包含摘录均为原文且在许可范围内；附件中的敏感信息已打码。",
].join("\n");

function parseGovernanceReasonCode(input: string): GovernanceReasonCode | null {
  switch ((input || "").trim()) {
    case "off_topic":
      return "off_topic";
    case "no_evidence_for_strong_claim":
      return "no_evidence_for_strong_claim";
    case "personal_attack":
      return "personal_attack";
    case "spam":
      return "spam";
    case "duplicate":
      return "duplicate";
    case "misleading_citation":
      return "misleading_citation";
    default:
      return null;
  }
}

function promptModerationReason(args: { title: string; defaultCode?: GovernanceReasonCode; noteLabel?: string }) {
  const list = [
    `off_topic — ${formatGovernanceReason("off_topic")}`,
    `no_evidence_for_strong_claim — ${formatGovernanceReason("no_evidence_for_strong_claim")}`,
    `personal_attack — ${formatGovernanceReason("personal_attack")}`,
    `spam — ${formatGovernanceReason("spam")}`,
    `duplicate — ${formatGovernanceReason("duplicate")}`,
    `misleading_citation — ${formatGovernanceReason("misleading_citation")}`,
  ].join("\n");

  const codeInput = (window.prompt(`${args.title}\n\nReason code / 理由代码（必填）:\n${list}\n\nType code:`, args.defaultCode || "") || "").trim();
  const reasonCode = parseGovernanceReasonCode(codeInput);
  if (!reasonCode) return null;

  const notePrompt = args.noteLabel || "Optional details / 可选补充说明（锚点/主张编号/一句话解释）:";
  const note = (window.prompt(notePrompt) || "").trim() || undefined;
  return { reasonCode, note };
}

function normalizeTargetRef(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const claim = raw.toUpperCase();
  if (/^C\d+$/.test(claim)) return claim;

  const compact = raw.replace(/\s+/g, "");
  if (!compact || compact.length > 80) return null;

  if (/^[#§][A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(compact)) return compact;
  if (/^(para|p|sec|section|eq|fig|table):[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/i.test(compact)) return compact;

  return null;
}

function normalizeCommentKind(value: unknown): CommentKind {
  switch (value) {
    case "question":
    case "suggestion":
    case "reference":
    case "concern":
    case "counterexample":
      return value;
    // legacy kinds (v0 demo)
    case "clarification":
      return "question";
    case "discussion":
      return "suggestion";
    default:
      return "question";
  }
}

function normalizeCommentStatus(value: unknown): CommentStatus {
  switch (value) {
    case "open":
    case "resolved":
    case "incorporated":
      return value;
    default:
      return "open";
  }
}

function normalizeCommentVisibility(value: unknown) {
  switch (value) {
    case "queued":
    case "published":
      return value;
    default:
      return "published";
  }
}

function normalizeCommentAuthorRole(value: unknown): CommentAuthorRole {
  switch (value) {
    case "community":
    case "author":
    case "editor":
      return value;
    default:
      return "community";
  }
}

function normalizeCommentReply(value: unknown): CommentReply | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id : "";
  const author = typeof obj.author === "string" ? obj.author : "Anonymous";
  const createdAt = typeof obj.createdAt === "string" ? obj.createdAt : "";
  const body = typeof obj.body === "string" ? obj.body : "";
  const authorRole = obj.authorRole != null ? normalizeCommentAuthorRole(obj.authorRole) : undefined;
  if (!id) return null;
  return { id, author, authorRole, createdAt, body };
}

function normalizeComment(value: unknown): Comment | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id : "";
  const author = typeof obj.author === "string" ? obj.author : "Anonymous";
  const createdAt = typeof obj.createdAt === "string" ? obj.createdAt : "";
  const body = typeof obj.body === "string" ? obj.body : "";
  const kind = normalizeCommentKind(obj.kind);
  const authorRole = obj.authorRole != null ? normalizeCommentAuthorRole(obj.authorRole) : undefined;
  const rawTarget = typeof obj.targetRef === "string" ? obj.targetRef : typeof obj.ref === "string" ? obj.ref : "";
  const targetRef = rawTarget.trim() || undefined;
  const visibility = obj.visibility != null ? normalizeCommentVisibility(obj.visibility) : undefined;
  const removed = typeof obj.removed === "boolean" ? obj.removed : undefined;
  const mergedIntoId = typeof obj.mergedIntoId === "string" ? obj.mergedIntoId.trim() : undefined;
  const status = obj.status != null ? normalizeCommentStatus(obj.status) : undefined;
  const softHidden = typeof obj.softHidden === "boolean" ? obj.softHidden : undefined;
  const replies = Array.isArray(obj.replies)
    ? (obj.replies.map(normalizeCommentReply).filter(Boolean) as CommentReply[])
    : undefined;
  if (!id) return null;
  return {
    id,
    author,
    authorRole,
    createdAt,
    kind,
    body,
    targetRef,
    visibility,
    removed,
    mergedIntoId: mergedIntoId || undefined,
    status,
    softHidden,
    replies,
  };
}

function normalizeComments(value: unknown): Comment[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeComment).filter(Boolean) as Comment[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && (value as object).constructor === Object;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
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

function fnv1a32Hex(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function sha256Hex(text: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle?.digest) return null;
  try {
    const data = new TextEncoder().encode(text);
    const buf = await subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

function normalizeReviewTimestamp(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00.000Z`;
  return raw;
}

function normalizeReview(value: unknown): Review | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id : "";
  if (!id) return null;

  const origin = obj.origin === "imported" ? "imported" : "community";

  const author = typeof obj.author === "string" ? obj.author : "Anonymous Reviewer";
  const anonymous = typeof obj.anonymous === "boolean" ? obj.anonymous : false;
  const verified = origin === "imported" ? false : typeof obj.verified === "boolean" ? obj.verified : false;
  const createdAt = normalizeReviewTimestamp(obj.createdAt);
  const hash = typeof obj.hash === "string" ? obj.hash : undefined;
  const coi = (typeof obj.coi === "string" ? obj.coi : "None").trim() || "None";

  const source = (() => {
    const raw = obj.source;
    if (!raw || typeof raw !== "object") return undefined;
    const s = raw as Record<string, unknown>;
    const url = typeof s.url === "string" ? s.url.trim() : "";
    if (!url) return undefined;
    const platform = typeof s.platform === "string" ? s.platform.trim() : undefined;
    const originalAuthor = typeof s.originalAuthor === "string" ? s.originalAuthor.trim() : undefined;
    const originalCreatedAt = typeof s.originalCreatedAt === "string" ? s.originalCreatedAt.trim() : undefined;
    const license = typeof s.license === "string" ? s.license.trim() : undefined;
    const permission = s.permission === "licensed" ? "licensed" : s.permission === "authorized" ? "authorized" : "link_only";
    const systemName = typeof s.systemName === "string" ? s.systemName.trim() : undefined;
    const systemCreator = typeof s.systemCreator === "string" ? s.systemCreator.trim() : undefined;
    return {
      url,
      platform: platform || undefined,
      originalAuthor: originalAuthor || undefined,
      originalCreatedAt: originalCreatedAt || undefined,
      license: license || undefined,
      permission,
      systemName: systemName || undefined,
      systemCreator: systemCreator || undefined,
    } satisfies NonNullable<Review["source"]>;
  })();

  const curation = (() => {
    const raw = obj.curation;
    if (!raw || typeof raw !== "object") return undefined;
    const c = raw as Record<string, unknown>;
    const curator = typeof c.curator === "string" ? c.curator.trim() : "";
    const curatedAt = typeof c.curatedAt === "string" ? c.curatedAt.trim() : "";
    const mappedClaims = Array.isArray(c.mappedClaims)
      ? (c.mappedClaims as unknown[])
          .filter((v) => typeof v === "string")
          .map((v) => String(v).trim())
          .filter(Boolean)
      : undefined;
    if (!curator && !curatedAt && !mappedClaims?.length) return undefined;
    return {
      curator: curator || undefined,
      curatedAt: curatedAt || undefined,
      mappedClaims: mappedClaims?.length ? mappedClaims : undefined,
    } satisfies NonNullable<Review["curation"]>;
  })();

  const addressed = (() => {
    const raw = obj.addressed;
    if (!raw || typeof raw !== "object") return undefined;
    const a = raw as Record<string, unknown>;
    const addressedAt = typeof a.addressedAt === "string" ? a.addressedAt.trim() : "";
    const addressedBy = typeof a.addressedBy === "string" ? a.addressedBy.trim() : "";
    const note = typeof a.note === "string" ? a.note.trim() : undefined;
    if (!addressedAt || !addressedBy) return undefined;
    return { addressedAt, addressedBy, note: note || undefined } satisfies NonNullable<Review["addressed"]>;
  })();

  const summary = (typeof obj.summary === "string" ? obj.summary : "Legacy review (migrated).").trim();
  const strengths = Array.isArray(obj.strengths) ? (obj.strengths as unknown[]).filter((v) => typeof v === "string").map((v) => String(v).trim()).filter(Boolean) : [];
  const concerns = Array.isArray(obj.concerns) ? (obj.concerns as unknown[]).filter((v) => typeof v === "string").map((v) => String(v).trim()).filter(Boolean) : [];

  const falsifiabilityAssessment =
    (typeof obj.falsifiabilityAssessment === "string" ? obj.falsifiabilityAssessment : "Not provided.").trim();
  const technicalCorrectnessAssessment =
    (typeof obj.technicalCorrectnessAssessment === "string" ? obj.technicalCorrectnessAssessment : "Not provided.").trim();
  const verificationReadiness =
    (typeof obj.verificationReadiness === "string" ? obj.verificationReadiness : "Not provided.").trim();
  const requestedChanges = Array.isArray(obj.requestedChanges)
    ? (obj.requestedChanges as unknown[]).filter((v) => typeof v === "string").map((v) => String(v).trim()).filter(Boolean)
    : [];
  const recommendation = (typeof obj.recommendation === "string" ? obj.recommendation : "Not provided.").trim();

  return {
    id,
    author: anonymous ? "Anonymous Reviewer" : author,
    anonymous,
    verified: anonymous ? false : verified,
    createdAt,
    hash,
    coi,
    addressed,
    origin,
    source,
    curation,
    summary,
    strengths,
    concerns,
    falsifiabilityAssessment,
    technicalCorrectnessAssessment,
    verificationReadiness,
    requestedChanges: requestedChanges.length ? requestedChanges : ["None"],
    recommendation,
  };
}

function normalizeReviews(value: unknown): Review[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeReview).filter(Boolean) as Review[];
}

function normalizeExternalReviewArtifactStatus(value: unknown): ExternalReviewArtifactStatus {
  switch (value) {
    case "pending":
    case "approved":
    case "soft_hidden":
    case "removed":
      return value;
    // legacy statuses
    case "rejected":
      return "soft_hidden";
    case "withdrawn":
      return "removed";
    default:
      return "pending";
  }
}

function normalizeExternalReviewSourceType(value: unknown): ExternalReviewSourceType {
  switch (value) {
    case "ai_system":
    case "human":
    case "mixed":
      return value;
    default:
      return "human";
  }
}

function normalizeExternalReviewSourceAccess(value: unknown): ExternalReviewSourceAccess {
  switch (value) {
    case "public_url":
    case "token_gated":
    case "screenshot_only":
    case "export":
      return value;
    default:
      return "public_url";
  }
}

function normalizeExternalReviewCuratorRoles(value: unknown): ExternalReviewCuratorRole[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<ExternalReviewCuratorRole>();
  for (const v of value) {
    if (v === "curation" || v === "normalization" || v === "translation" || v === "claim-mapping" || v === "citation-check") {
      seen.add(v);
    }
  }
  return Array.from(seen.values());
}

function normalizeExternalReviewEvidenceAttachmentKind(value: unknown): ExternalReviewEvidenceAttachmentKind {
  switch (value) {
    case "screenshot":
    case "export":
    case "link":
    case "other":
      return value;
    default:
      return "other";
  }
}

function normalizeExternalReviewEvidenceAttachments(value: unknown): ExternalReviewEvidenceAttachment[] {
  if (!Array.isArray(value)) return [];
  const out: ExternalReviewEvidenceAttachment[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id.trim() : "";
    const kind = normalizeExternalReviewEvidenceAttachmentKind(obj.kind);
    const label = typeof obj.label === "string" ? obj.label.trim() : "";
    if (!label) continue;
    const url = typeof obj.url === "string" ? obj.url.trim() : undefined;
    const note = typeof obj.note === "string" ? obj.note.trim() : undefined;
    const sha256 = typeof obj.sha256 === "string" ? obj.sha256.trim() : undefined;
    out.push({
      id: id || `att-${out.length + 1}`,
      kind,
      label,
      url: url || undefined,
      note: note || undefined,
      sha256: sha256 || undefined,
    });
  }
  return out;
}

function normalizeExternalReviewArtifact(value: unknown, paperId: string): ExternalReviewArtifact | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id.trim() : "";
  if (!id) return null;

  const rawPaperId = typeof obj.paperId === "string" ? obj.paperId.trim() : paperId;
  if (!rawPaperId) return null;

  const paperVersionId = typeof obj.paperVersionId === "string" ? obj.paperVersionId.trim() : undefined;
  const paperDoi = typeof obj.paperDoi === "string" ? obj.paperDoi.trim() : undefined;

  const createdAt = normalizeReviewTimestamp(obj.createdAt);
  const hash = typeof obj.hash === "string" ? obj.hash.trim() : undefined;
  const status = normalizeExternalReviewArtifactStatus(obj.status);
  const statusReason = typeof obj.statusReason === "string" ? obj.statusReason.trim() : undefined;

  const sourceRaw = obj.source;
  if (!sourceRaw || typeof sourceRaw !== "object") return null;
  const sourceObj = sourceRaw as Record<string, unknown>;

  const explicitType = typeof sourceObj.type === "string" ? sourceObj.type.trim() : "";
  const systemName = typeof sourceObj.systemName === "string" ? sourceObj.systemName.trim() : undefined;
  const url = typeof sourceObj.url === "string" ? sourceObj.url.trim() : "";
  const explicitAccess = typeof sourceObj.access === "string" ? sourceObj.access.trim() : "";

  const legacySystemCreator = typeof (sourceObj as Record<string, unknown>).systemCreator === "string" ? String((sourceObj as Record<string, unknown>).systemCreator).trim() : "";
  const systemCreators = Array.isArray(sourceObj.systemCreators)
    ? (sourceObj.systemCreators as unknown[])
        .filter((v) => typeof v === "string")
        .map((v) => String(v).trim())
        .filter(Boolean)
    : legacySystemCreator
      ? [legacySystemCreator]
      : [];

  const inferredType =
    systemName || systemCreators.length ? "ai_system" : "human";
  const type = explicitType ? normalizeExternalReviewSourceType(explicitType) : inferredType;

  const inferredAccess = url ? "public_url" : "screenshot_only";
  const access = explicitAccess ? normalizeExternalReviewSourceAccess(explicitAccess) : inferredAccess;

  const platform = typeof sourceObj.platform === "string" ? sourceObj.platform.trim() : undefined;
  const originalAuthor = typeof sourceObj.originalAuthor === "string" ? sourceObj.originalAuthor.trim() : undefined;
  const originalCreatedAt = typeof sourceObj.originalCreatedAt === "string" ? sourceObj.originalCreatedAt.trim() : undefined;
  const license = typeof sourceObj.license === "string" ? sourceObj.license.trim() : undefined;
  const permission =
    sourceObj.permission === "licensed" ? "licensed" : sourceObj.permission === "authorized" ? "authorized" : "link_only";
  const disclaimer = typeof sourceObj.disclaimer === "string" ? sourceObj.disclaimer.trim() : undefined;

  const curatorRaw = obj.curator;
  if (!curatorRaw || typeof curatorRaw !== "object") return null;
  const curatorObj = curatorRaw as Record<string, unknown>;
  const userId =
    typeof curatorObj.userId === "string"
      ? curatorObj.userId.trim()
      : typeof curatorObj.handle === "string"
        ? curatorObj.handle.trim()
        : "";
  const curatedAt = normalizeReviewTimestamp(curatorObj.curatedAt);
  const coi = (typeof curatorObj.coi === "string" ? curatorObj.coi : "None").trim() || "None";
  const mappedClaims = Array.isArray(curatorObj.mappedClaims)
    ? (curatorObj.mappedClaims as unknown[])
        .filter((v) => typeof v === "string")
        .map((v) => String(v).trim().toUpperCase())
        .filter((v) => /^C\d+$/.test(v))
    : undefined;

  const mappedTargetsRaw = Array.isArray(curatorObj.mappedTargets) ? (curatorObj.mappedTargets as unknown[]) : [];
  const mappedTargets = (() => {
    const normalized = mappedTargetsRaw
      .filter((v) => typeof v === "string")
      .map((v) => normalizeTargetRef(String(v)))
      .filter(Boolean) as string[];
    const merged = [...normalized, ...(mappedClaims || [])]
      .map((v) => String(v).trim())
      .filter(Boolean);
    const uniq = Array.from(new Set(merged));
    return uniq.length ? uniq : undefined;
  })();

  const rolesRaw = normalizeExternalReviewCuratorRoles(curatorObj.roles);
  const roles =
    rolesRaw.length > 0
      ? rolesRaw
      : (() => {
          const inferred: ExternalReviewCuratorRole[] = ["curation", "normalization"];
          if (mappedTargets?.length || mappedClaims?.length) inferred.push("claim-mapping");
          return inferred;
        })();
  const attestation = typeof curatorObj.attestation === "string" ? curatorObj.attestation.trim() : "";
  const signature = typeof curatorObj.signature === "string" ? curatorObj.signature.trim() : undefined;

  const evidenceAttachments = normalizeExternalReviewEvidenceAttachments(obj.evidenceAttachments);

  const withdrawalRaw = obj.withdrawal;
  const withdrawal =
    withdrawalRaw && typeof withdrawalRaw === "object"
      ? (() => {
          const w = withdrawalRaw as Record<string, unknown>;
          const withdrawnAt = typeof w.withdrawnAt === "string" ? w.withdrawnAt.trim() : "";
          const withdrawnBy = typeof w.withdrawnBy === "string" ? w.withdrawnBy.trim() : "";
          const reason = typeof w.reason === "string" ? w.reason.trim() : undefined;
          if (!withdrawnAt || !withdrawnBy) return undefined;
          return { withdrawnAt, withdrawnBy, reason } satisfies ExternalReviewArtifact["withdrawal"];
        })()
      : undefined;

  const moderationRaw = obj.moderation;
  const moderation =
    moderationRaw && typeof moderationRaw === "object"
      ? (() => {
          const m = moderationRaw as Record<string, unknown>;
          const reviewedAt = typeof m.reviewedAt === "string" ? m.reviewedAt.trim() : undefined;
          const reviewedBy = typeof m.reviewedBy === "string" ? m.reviewedBy.trim() : undefined;
          const note = typeof m.note === "string" ? m.note.trim() : undefined;
          if (!reviewedAt && !reviewedBy && !note) return undefined;
          return { reviewedAt, reviewedBy, note } satisfies ExternalReviewArtifact["moderation"];
        })()
      : undefined;

  const validationRaw = obj.validation;
  const validation =
    validationRaw && typeof validationRaw === "object"
      ? (() => {
          const v = validationRaw as Record<string, unknown>;

          const helpfulVotes =
            Array.isArray(v.helpfulVotes) && v.helpfulVotes.length
              ? (v.helpfulVotes as unknown[])
                  .map((entry) => {
                    if (!entry || typeof entry !== "object") return null;
                    const vote = entry as Record<string, unknown>;
                    const by = typeof vote.by === "string" ? vote.by.trim() : "";
                    const at = typeof vote.at === "string" ? vote.at.trim() : "";
                    if (!by || !at) return null;
                    return { by, at };
                  })
                  .filter(Boolean)
              : undefined;

          const addressedRaw = v.addressed;
          const addressed =
            addressedRaw && typeof addressedRaw === "object"
              ? (() => {
                  const a = addressedRaw as Record<string, unknown>;
                  const addressedAt = typeof a.addressedAt === "string" ? a.addressedAt.trim() : "";
                  const addressedBy = typeof a.addressedBy === "string" ? a.addressedBy.trim() : "";
                  const note = typeof a.note === "string" ? a.note.trim() : undefined;
                  if (!addressedAt || !addressedBy) return undefined;
                  return { addressedAt, addressedBy, note };
                })()
              : undefined;

          const highSignalRaw = v.highSignal;
          const highSignal =
            highSignalRaw && typeof highSignalRaw === "object"
              ? (() => {
                  const h = highSignalRaw as Record<string, unknown>;
                  const markedAt = typeof h.markedAt === "string" ? h.markedAt.trim() : "";
                  const markedBy = typeof h.markedBy === "string" ? h.markedBy.trim() : "";
                  const note = typeof h.note === "string" ? h.note.trim() : undefined;
                  if (!markedAt || !markedBy) return undefined;
                  return { markedAt, markedBy, note };
                })()
              : undefined;

          if (!helpfulVotes && !addressed && !highSignal) return undefined;
          return { helpfulVotes, addressed, highSignal } satisfies NonNullable<ExternalReviewArtifact["validation"]>;
        })()
      : undefined;

  const contentRaw = obj.content;
  if (!contentRaw || typeof contentRaw !== "object") return null;
  const contentObj = contentRaw as Record<string, unknown>;
  const summary = (typeof contentObj.summary === "string" ? contentObj.summary : "").trim();
  if (!summary) return null;

  const strengths = Array.isArray(contentObj.strengths)
    ? (contentObj.strengths as unknown[]).filter((v) => typeof v === "string").map((v) => String(v).trim()).filter(Boolean)
    : [];
  const weaknesses = Array.isArray(contentObj.weaknesses)
    ? (contentObj.weaknesses as unknown[]).filter((v) => typeof v === "string").map((v) => String(v).trim()).filter(Boolean)
    : Array.isArray((contentObj as Record<string, unknown>).concerns)
      ? ((contentObj as Record<string, unknown>).concerns as unknown[])
          .filter((v) => typeof v === "string")
          .map((v) => String(v).trim())
          .filter(Boolean)
      : [];

  const questions = Array.isArray(contentObj.questions)
    ? (contentObj.questions as unknown[]).filter((v) => typeof v === "string").map((v) => String(v).trim()).filter(Boolean)
    : Array.isArray((contentObj as Record<string, unknown>).requestedChanges)
      ? ((contentObj as Record<string, unknown>).requestedChanges as unknown[])
          .filter((v) => typeof v === "string")
          .map((v) => String(v).trim())
          .filter(Boolean)
      : [];

  const detailedCommentsRaw = typeof contentObj.detailedComments === "string" ? contentObj.detailedComments.trim() : "";
  const legacyFalsifiability = typeof (contentObj as Record<string, unknown>).falsifiabilityAssessment === "string" ? String((contentObj as Record<string, unknown>).falsifiabilityAssessment).trim() : "";
  const legacyTechnical = typeof (contentObj as Record<string, unknown>).technicalCorrectnessAssessment === "string" ? String((contentObj as Record<string, unknown>).technicalCorrectnessAssessment).trim() : "";
  const legacyReadiness = typeof (contentObj as Record<string, unknown>).verificationReadiness === "string" ? String((contentObj as Record<string, unknown>).verificationReadiness).trim() : "";
  const detailedComments =
    detailedCommentsRaw ||
    [legacyFalsifiability ? `Falsifiability assessment:\n${legacyFalsifiability}` : "", legacyTechnical ? `Technical correctness:\n${legacyTechnical}` : "", legacyReadiness ? `Verification readiness:\n${legacyReadiness}` : ""]
      .filter(Boolean)
      .join("\n\n") ||
    "Not provided.";

  const overallAssessmentRaw =
    typeof contentObj.overallAssessment === "string"
      ? contentObj.overallAssessment
      : typeof (contentObj as Record<string, unknown>).recommendation === "string"
        ? String((contentObj as Record<string, unknown>).recommendation)
        : "";
  const overallAssessment = overallAssessmentRaw.trim() || "Not provided.";

  return {
    id,
    paperId: rawPaperId,
    paperVersionId: paperVersionId || undefined,
    paperDoi: paperDoi || undefined,
    createdAt,
    hash,
    status,
    statusReason: statusReason || undefined,
    source: {
      systemName: systemName || undefined,
      type,
      url: url || undefined,
      access,
      platform: platform || undefined,
      originalAuthor: originalAuthor || undefined,
      originalCreatedAt: originalCreatedAt || undefined,
      license: license || undefined,
      permission,
      systemCreators: systemCreators.length ? systemCreators : undefined,
      disclaimer: disclaimer || undefined,
    },
    curator: {
      userId: userId || "You",
      roles,
      attestation: attestation || "Legacy import (attestation not captured).",
      signature: signature || undefined,
      curatedAt,
      coi,
      mappedClaims: mappedClaims?.length ? mappedClaims : undefined,
      mappedTargets: mappedTargets?.length ? mappedTargets : undefined,
    },
    evidenceAttachments: evidenceAttachments.length ? evidenceAttachments : undefined,
    validation,
    withdrawal,
    moderation,
    content: {
      summary,
      strengths,
      weaknesses,
      questions,
      detailedComments,
      overallAssessment,
    },
  };
}

function normalizeExternalReviewArtifacts(value: unknown, paperId: string): ExternalReviewArtifact[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => normalizeExternalReviewArtifact(v, paperId)).filter(Boolean) as ExternalReviewArtifact[];
}

function importedReviewToExternalArtifact(review: Review, paperId: string): ExternalReviewArtifact | null {
  const url = (review.source?.url || "").trim();
  if (!url) return null;

  const permission = review.source?.permission === "licensed" ? "licensed" : review.source?.permission === "authorized" ? "authorized" : "link_only";
  const curatorUserId = (review.curation?.curator || "").trim() || "Unknown Curator";
  const curatedAt = (review.curation?.curatedAt || review.createdAt || new Date().toISOString()).trim();
  const mappedClaims = (review.curation?.mappedClaims || []).filter((c) => /^C\d+$/i.test(String(c || "").trim().toUpperCase())).map((c) => String(c).trim().toUpperCase());
  const roles: ExternalReviewCuratorRole[] = ["curation", "normalization"];
  if (mappedClaims.length) roles.push("claim-mapping");

  const questions = (Array.isArray(review.requestedChanges) ? review.requestedChanges : [])
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .filter((v) => !/^none$/i.test(v));

  return {
    id: `era-${review.id}`,
    paperId,
    createdAt: normalizeReviewTimestamp(review.createdAt),
    hash: undefined,
    status: "pending",
    source: {
      systemName: review.source?.systemName,
      type: review.source?.systemName ? "ai_system" : "human",
      url,
      access: "public_url",
      platform: review.source?.platform,
      originalAuthor: review.source?.originalAuthor || review.author,
      originalCreatedAt: review.source?.originalCreatedAt,
      license: review.source?.license,
      permission,
      systemCreators: review.source?.systemCreator ? [review.source.systemCreator] : undefined,
    },
    curator: {
      userId: curatorUserId,
      roles,
      attestation: "Migrated from legacy imported review (attestation not captured).",
      signature: curatorUserId,
      curatedAt: normalizeReviewTimestamp(curatedAt),
      coi: (review.coi || "None").trim() || "None",
      mappedClaims: mappedClaims.length ? mappedClaims : undefined,
      mappedTargets: mappedClaims.length ? mappedClaims : undefined,
    },
    content: {
      summary: review.summary,
      strengths: Array.isArray(review.strengths) ? review.strengths : [],
      weaknesses: Array.isArray(review.concerns) ? review.concerns : [],
      questions,
      detailedComments:
        [
          review.falsifiabilityAssessment ? `Falsifiability assessment:\n${review.falsifiabilityAssessment}` : "",
          review.technicalCorrectnessAssessment ? `Technical correctness:\n${review.technicalCorrectnessAssessment}` : "",
          review.verificationReadiness ? `Verification readiness:\n${review.verificationReadiness}` : "",
        ]
          .filter(Boolean)
          .join("\n\n") || "Not provided.",
      overallAssessment: review.recommendation || "Not provided.",
    },
  };
}

function splitBullets(input: string) {
  return input
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-*+]\s+/, "").trim())
    .filter(Boolean);
}

function formatTimestamp(value: string) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return value;
  return d.toISOString().replace(".000Z", "Z");
}

async function computeReviewHash(review: Review) {
  const payload = {
    version: 2,
    id: review.id,
    createdAt: review.createdAt,
    author: review.author,
    anonymous: Boolean(review.anonymous),
    verified: Boolean(review.verified),
    coi: review.coi,
    origin: review.origin || "community",
    source: review.source || null,
    curation: review.curation || null,
    summary: review.summary,
    strengths: Array.isArray(review.strengths) ? review.strengths : [],
    concerns: Array.isArray(review.concerns) ? review.concerns : [],
    falsifiabilityAssessment: review.falsifiabilityAssessment,
    technicalCorrectnessAssessment: review.technicalCorrectnessAssessment,
    verificationReadiness: review.verificationReadiness,
    requestedChanges: Array.isArray(review.requestedChanges) ? review.requestedChanges : [],
    recommendation: review.recommendation,
  };
  const canonical = stableStringify(payload);
  const sha = await sha256Hex(canonical);
  if (sha) return `sha256:${sha}`;
  return `fnv1a32:${fnv1a32Hex(canonical)}`;
}

async function computeExternalArtifactHash(artifact: ExternalReviewArtifact) {
  const payload = {
    version: 2,
    paper: {
      id: artifact.paperId,
      doi: artifact.paperDoi || null,
      versionId: artifact.paperVersionId || null,
    },
    source: artifact.source,
    curator: {
      userId: artifact.curator.userId,
      roles: artifact.curator.roles || [],
      attestation: artifact.curator.attestation,
      signature: artifact.curator.signature || null,
      coi: artifact.curator.coi,
      mappedClaims: artifact.curator.mappedClaims || [],
      mappedTargets: artifact.curator.mappedTargets || [],
    },
    evidenceAttachments: artifact.evidenceAttachments || [],
    content: artifact.content,
  };
  const canonical = stableStringify(payload);
  const sha = await sha256Hex(canonical);
  if (sha) return `sha256:${sha}`;
  return `fnv1a32:${fnv1a32Hex(canonical)}`;
}

export function PaperDrawer({ paper }: PaperDrawerProps) {
  const router = useRouter();
  const paperId = paper?.id || "";
  const [evidencePointers, setEvidencePointers] = useState<EvidencePointer[]>([]);
  const [claimEvidence, setClaimEvidence] = useState<ClaimEvidence[]>([]);
  const [assumptionLedger, setAssumptionLedger] = useState<AssumptionLedgerEntry[]>([]);
  const [priorWork, setPriorWork] = useState<PriorWorkEntry[]>([]);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [copiedCodeHash, setCopiedCodeHash] = useState(false);
  const [reviewerName, setReviewerName] = useState("You");
  const [reviewAnonymous, setReviewAnonymous] = useState(false);
  const [reviewVerified, setReviewVerified] = useState(false);
  const [reviewCoi, setReviewCoi] = useState("None");
  const [reviewSummary, setReviewSummary] = useState("");
  const [reviewStrengths, setReviewStrengths] = useState("");
  const [reviewConcerns, setReviewConcerns] = useState("");
  const [reviewFalsifiability, setReviewFalsifiability] = useState("");
  const [reviewTechnical, setReviewTechnical] = useState("");
  const [reviewReadiness, setReviewReadiness] = useState("");
  const [reviewRequestedChanges, setReviewRequestedChanges] = useState("");
  const [reviewRecommendation, setReviewRecommendation] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [localReviews, setLocalReviews] = useState<Review[]>([]);
  const [reviewHashById, setReviewHashById] = useState<Record<string, string>>({});
  const [reviewMode, setReviewMode] = useState<"write" | "import">("write");
  const [externalArtifacts, setExternalArtifacts] = useState<ExternalReviewArtifact[]>([]);
  const [externalArtifactHashById, setExternalArtifactHashById] = useState<Record<string, string>>({});
  const [artifactActorRole, setArtifactActorRole] = useState<"community" | "curator" | "author" | "editor">("curator");
  const [artifactActorName, setArtifactActorName] = useState("You");
  const [importSourceUrl, setImportSourceUrl] = useState("");
  const [importSourceAccess, setImportSourceAccess] = useState<ExternalReviewSourceAccess>("public_url");
  const [importSourceType, setImportSourceType] = useState<ExternalReviewSourceType>("human");
  const [importSourcePlatform, setImportSourcePlatform] = useState("blog");
  const [importOriginalAuthor, setImportOriginalAuthor] = useState("");
  const [importOriginalCreatedAt, setImportOriginalCreatedAt] = useState("");
  const [importPermission, setImportPermission] = useState<"link_only" | "licensed" | "authorized">("link_only");
  const [importLicense, setImportLicense] = useState("");
  const [importSystemName, setImportSystemName] = useState("");
  const [importSystemCreators, setImportSystemCreators] = useState("");
  const [importSourceDisclaimer, setImportSourceDisclaimer] = useState("");
  const [importCurator, setImportCurator] = useState("You");
  const [importCuratorRoles, setImportCuratorRoles] = useState<ExternalReviewCuratorRole[]>(["curation", "normalization"]);
  const [importCuratorSignature, setImportCuratorSignature] = useState("");
  const [importMappedClaims, setImportMappedClaims] = useState("");
  const [importAttest, setImportAttest] = useState(false);
  const [importEvidenceAttachments, setImportEvidenceAttachments] = useState("");
  const [importDetailedComments, setImportDetailedComments] = useState("");
  const [commentKind, setCommentKind] = useState<CommentKind>("question");
  const [commentTargetRef, setCommentTargetRef] = useState("");
  const [commentActorRole, setCommentActorRole] = useState<CommentAuthorRole>("community");
  const [commentActorName, setCommentActorName] = useState("You");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [commentReplyOpenById, setCommentReplyOpenById] = useState<Record<string, boolean>>({});
  const [commentReplyDraftById, setCommentReplyDraftById] = useState<Record<string, string>>({});
  const [commentExpandedById, setCommentExpandedById] = useState<Record<string, boolean>>({});
  const [commentReplyErrorById, setCommentReplyErrorById] = useState<Record<string, string>>({});
  const [governanceLog, setGovernanceLog] = useState<GovernanceLogEntry[]>([]);
  const [actorSanctions, setActorSanctions] = useState<ActorSanction[]>([]);
  const [actorTiers, setActorTiers] = useState<Record<string, AccountTier>>({});

  const tierFor = useCallback(
    (handle: string): AccountTier => {
      const k = handleKey(handle);
      return (k && actorTiers[k]) || "new";
    },
    [actorTiers]
  );

  const setTierFor = useCallback((handle: string, tier: AccountTier) => {
    const k = handleKey(handle);
    if (!k) return;
    setActorTiers((prev) => ({ ...prev, [k]: tier }));
  }, []);

  const sourceUrl = useMemo(() => {
    if (!paper) return null;
    if (paper.dataUrl) return paper.dataUrl;
    if (paper.doi && paper.doi.startsWith("10.")) return `https://doi.org/${paper.doi}`;
    return null;
  }, [paper]);

  const commentAuthorOptions = useMemo(() => {
    if (!paper) return [] as string[];
    const raw = [
      ...(paper.responsibleStewards || []),
      ...(paper.authors || []).map((a) => a.name),
    ]
      .map((n) => String(n || "").trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of raw) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  }, [paper]);

  const persistLocalReviews = useCallback(
    (reviews: Review[]) => {
      if (!paperId) return;
      try {
        localStorage.setItem(`omega_reviews_v1:${paperId}`, JSON.stringify({ version: 2, reviews }));
      } catch {
        // ignore persistence failures (private mode, etc.)
      }
    },
    [paperId]
  );

  const commitLocalReviews = useCallback(
    (updater: (prev: Review[]) => Review[]) => {
      setLocalReviews((prev) => {
        const next = updater(prev);
        persistLocalReviews(next);
        return next;
      });
    },
    [persistLocalReviews]
  );

  const updateReviewById = useCallback(
    (reviewId: string, updater: (review: Review) => Review) => {
      commitLocalReviews((prev) => {
        const idx = prev.findIndex((r) => r.id === reviewId);
        if (idx !== -1) {
          const next = prev.slice();
          next[idx] = updater(prev[idx]);
          return next;
        }

        const base = paper?.reviews?.find((r) => r.id === reviewId);
        if (!base) return prev;
        return [updater({ ...base }), ...prev];
      });
    },
    [commitLocalReviews, paper?.reviews]
  );

  const persistExternalArtifacts = useCallback(
    (artifacts: ExternalReviewArtifact[]) => {
      if (!paperId) return;
      try {
        localStorage.setItem(`omega_external_review_artifacts_v1:${paperId}`, JSON.stringify({ version: 1, artifacts }));
      } catch {
        // ignore persistence failures (private mode, etc.)
      }
    },
    [paperId]
  );

  const appendGovernance = useCallback(
    (entry: Omit<GovernanceLogEntry, "id" | "createdAt"> & { id?: string; createdAt?: string }) => {
      if (!paperId) return;
      const full = createGovernanceLogEntry(entry);
      setGovernanceLog((prev) => {
        const next = appendGovernanceLogEntry(prev, full);
        persistGovernanceLog(paperId, next);
        return next;
      });
    },
    [paperId]
  );

  const commitActorSanctions = useCallback((updater: (prev: ActorSanction[]) => ActorSanction[]) => {
    setActorSanctions((prev) => {
      const next = updater(prev);
      persistActorSanctions(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (commentActorRole === "editor") {
      if (commentActorName !== "Omega Editor") setCommentActorName("Omega Editor");
      return;
    }
    if (commentActorRole === "author") {
      if (!commentAuthorOptions.length) return;
      if (!commentAuthorOptions.includes(commentActorName)) setCommentActorName(commentAuthorOptions[0]);
      return;
    }
    if (!commentActorName.trim()) setCommentActorName("You");
  }, [commentActorName, commentActorRole, commentAuthorOptions]);

  useEffect(() => {
    if (!paperId) return;
    setTab("overview");
    setSelectedVersion(paper?.versions?.[0]?.version ?? null);
    setReviewerName("You");
    setReviewAnonymous(false);
    setReviewVerified(false);
    setReviewCoi("None");
    setReviewSummary("");
    setReviewStrengths("");
    setReviewConcerns("");
    setReviewFalsifiability("");
    setReviewTechnical("");
    setReviewReadiness("");
    setReviewRequestedChanges("");
    setReviewRecommendation("");
    setReviewError(null);
    setReviewHashById({});
    setReviewMode("write");
    setExternalArtifacts([]);
    setExternalArtifactHashById({});
    setArtifactActorRole("curator");
    setArtifactActorName("You");
    setImportSourceUrl("");
    setImportSourceAccess("public_url");
    setImportSourceType("human");
    setImportSourcePlatform("blog");
    setImportOriginalAuthor("");
    setImportOriginalCreatedAt("");
    setImportPermission("link_only");
    setImportLicense("");
    setImportSystemName("");
    setImportSystemCreators("");
    setImportSourceDisclaimer("");
    setImportCurator("You");
    setImportCuratorRoles(["curation", "normalization"]);
    setImportCuratorSignature("");
    setImportMappedClaims("");
    setImportAttest(false);
    setImportEvidenceAttachments("");
    setImportDetailedComments("");
    setCommentKind("question");
    setCommentTargetRef("");
    setCommentDraft("");
    setCommentError(null);
    setCommentReplyOpenById({});
    setCommentReplyDraftById({});
    setCommentExpandedById({});
    setCommentReplyErrorById({});
    setCardError(null);
    setCopiedCodeHash(false);
  }, [paperId, paper?.versions]);

  useEffect(() => {
    if (!copiedCodeHash) return;
    const t = window.setTimeout(() => setCopiedCodeHash(false), 1200);
    return () => window.clearTimeout(t);
  }, [copiedCodeHash]);

  useEffect(() => {
    if (!paperId) {
      setGovernanceLog([]);
      return;
    }
    setGovernanceLog(loadGovernanceLog(paperId));
  }, [paperId]);

  useEffect(() => {
    setActorSanctions(loadActorSanctions());
  }, []);

  useEffect(() => {
    setActorTiers(loadActorTiers());
  }, []);

  useEffect(() => {
    persistActorTiers(actorTiers);
  }, [actorTiers]);

  useEffect(() => {
    if (!paperId) return;
    try {
      const raw = localStorage.getItem(`omega_evidence_v1:${paperId}`);
      if (!raw) {
        setEvidencePointers([]);
        setClaimEvidence([]);
        setAssumptionLedger([]);
        setPriorWork([]);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<{
        version: number;
        evidencePointers: unknown;
        claimEvidence: unknown;
        assumptionLedger: unknown;
        priorWork: unknown;
      }>;
      if (parsed.version !== 1) {
        setEvidencePointers([]);
        setClaimEvidence([]);
        setAssumptionLedger([]);
        setPriorWork([]);
        return;
      }
      setEvidencePointers(Array.isArray(parsed.evidencePointers) ? (parsed.evidencePointers as EvidencePointer[]) : []);
      setClaimEvidence(Array.isArray(parsed.claimEvidence) ? (parsed.claimEvidence as ClaimEvidence[]) : []);
      setAssumptionLedger(Array.isArray(parsed.assumptionLedger) ? (parsed.assumptionLedger as AssumptionLedgerEntry[]) : []);
      setPriorWork(Array.isArray(parsed.priorWork) ? (parsed.priorWork as PriorWorkEntry[]) : []);
    } catch {
      setEvidencePointers([]);
      setClaimEvidence([]);
      setAssumptionLedger([]);
      setPriorWork([]);
    }
  }, [paperId]);

  useEffect(() => {
    if (!paperId) return;
    try {
      let artifacts: ExternalReviewArtifact[] = [];
      const rawArtifacts = localStorage.getItem(`omega_external_review_artifacts_v1:${paperId}`);
      if (rawArtifacts) {
        const parsedArtifacts = JSON.parse(rawArtifacts) as unknown;
        if (parsedArtifacts && typeof parsedArtifacts === "object") {
          const aobj = parsedArtifacts as Partial<{ version: number; artifacts: unknown }>;
          if (aobj.version === 1) artifacts = normalizeExternalReviewArtifacts(aobj.artifacts, paperId);
        }
      }

      let reviews: Review[] = [];
      const raw = localStorage.getItem(`omega_reviews_v1:${paperId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object") {
          const obj = parsed as Partial<{ version: number; reviews: unknown }>;
          if (obj.version === 1 || obj.version === 2) reviews = normalizeReviews(obj.reviews);
        }
      }

      const importedReviews = reviews.filter((r) => r.origin === "imported" && (r.source?.url || "").trim().length > 0);
      if (importedReviews.length > 0) {
        const existingUrls = new Set(artifacts.map((a) => (a.source.url || "").trim()).filter(Boolean));
        const migrated = importedReviews
          .map((r) => importedReviewToExternalArtifact(r, paperId))
          .filter(Boolean) as ExternalReviewArtifact[];
        const add = migrated.filter((a) => {
          const u = (a.source.url || "").trim();
          return u && !existingUrls.has(u);
        });
        if (add.length > 0) {
          artifacts = [...add, ...artifacts];
          persistExternalArtifacts(artifacts);
        }

        const remainingReviews = reviews.filter((r) => r.origin !== "imported");
        if (remainingReviews.length !== reviews.length) persistLocalReviews(remainingReviews);
        reviews = remainingReviews;
      } else {
        reviews = reviews.filter((r) => r.origin !== "imported");
      }

      setLocalReviews(reviews);
      setExternalArtifacts(artifacts);
    } catch {
      setLocalReviews([]);
      setExternalArtifacts([]);
    }
  }, [paperId, persistExternalArtifacts, persistLocalReviews]);

  useEffect(() => {
    if (!paperId) return;
    let cancelled = false;

    const combined = [...localReviews, ...((paper?.reviews || []) as Review[])];
    const missing = combined.filter((r) => !(r.hash || reviewHashById[r.id]));
    if (missing.length === 0) return;

    void (async () => {
      const computed = await Promise.all(
        missing.map(async (r) => {
          const hash = r.hash || (await computeReviewHash(r));
          return { id: r.id, hash };
        })
      );

      if (cancelled) return;

      setReviewHashById((prev) => {
        let changed = false;
        const next: Record<string, string> = { ...prev };
        for (const entry of computed) {
          if (next[entry.id]) continue;
          next[entry.id] = entry.hash;
          changed = true;
        }
        return changed ? next : prev;
      });

      const localNeedsUpdate = localReviews.some((r) => !r.hash);
      if (!localNeedsUpdate) return;

      const nextLocal = await Promise.all(
        localReviews.map(async (r) => (r.hash ? r : { ...r, hash: (reviewHashById[r.id] || (await computeReviewHash(r))).trim() }))
      );
      if (cancelled) return;

      setLocalReviews(nextLocal);
      persistLocalReviews(nextLocal);
    })();

    return () => {
      cancelled = true;
    };
  }, [paperId, paper?.reviews, localReviews, reviewHashById, persistLocalReviews]);

  useEffect(() => {
    if (!paperId) return;
    let cancelled = false;

    const missing = externalArtifacts.filter((a) => !(a.hash || externalArtifactHashById[a.id]));
    if (missing.length === 0) return;

    void (async () => {
      const computed = await Promise.all(
        missing.map(async (a) => {
          const hash = a.hash || (await computeExternalArtifactHash(a));
          return { id: a.id, hash };
        })
      );

      if (cancelled) return;

      setExternalArtifactHashById((prev) => {
        let changed = false;
        const next: Record<string, string> = { ...prev };
        for (const entry of computed) {
          if (next[entry.id]) continue;
          next[entry.id] = entry.hash;
          changed = true;
        }
        return changed ? next : prev;
      });

      const needsUpdate = externalArtifacts.some((a) => !a.hash);
      if (!needsUpdate) return;

      const nextArtifacts = await Promise.all(
        externalArtifacts.map(async (a) => (a.hash ? a : { ...a, hash: (externalArtifactHashById[a.id] || (await computeExternalArtifactHash(a))).trim() }))
      );
      if (cancelled) return;

      setExternalArtifacts(nextArtifacts);
      persistExternalArtifacts(nextArtifacts);
    })();

    return () => {
      cancelled = true;
    };
  }, [externalArtifactHashById, externalArtifacts, paperId, persistExternalArtifacts]);

  useEffect(() => {
    if (!paperId) return;
    try {
      const raw = localStorage.getItem(`omega_comments_v1:${paperId}`);
      if (!raw) {
        setLocalComments([]);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") {
        setLocalComments([]);
        return;
      }
      const obj = parsed as Partial<{ version: number; comments: unknown }>;
      if (obj.version !== 1 && obj.version !== 2) {
        setLocalComments([]);
        return;
      }
      setLocalComments(normalizeComments(obj.comments));
    } catch {
      setLocalComments([]);
    }
  }, [paperId]);

  const generateReviewCard = async () => {
    if (!paper || cardBusy) return;
    setCardBusy(true);
    setCardError(null);
    try {
      const res = await fetch("/api/review/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper,
          evidencePointers,
          claimEvidence,
          engine: "auto",
          enqueueReproQueue: false,
        }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { artifact?: { hash?: string }; error?: string };
      if (!res.ok) throw new Error(data?.error || `Engine error (${res.status})`);
      const hash = String(data?.artifact?.hash || "").replace(/^sha256:/, "");
      if (!hash) throw new Error("Engine did not return an artifact hash.");
      router.push(`/card/${encodeURIComponent(hash)}`);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : "Failed to generate review card.");
    } finally {
      setCardBusy(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = text;
        el.setAttribute("readonly", "true");
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        return true;
      } catch {
        return false;
      }
    }
  };

  const persistLocalComments = (comments: Comment[]) => {
    if (!paperId) return;
    try {
      localStorage.setItem(`omega_comments_v1:${paperId}`, JSON.stringify({ version: 1, comments }));
    } catch {
      // ignore persistence failures (private mode, etc.)
    }
  };

  const commitLocalComments = (updater: (prev: Comment[]) => Comment[]) => {
    setLocalComments((prev) => {
      const next = updater(prev);
      persistLocalComments(next);
      return next;
    });
  };

  const updateCommentById = (commentId: string, updater: (comment: Comment) => Comment) => {
    commitLocalComments((prev) => {
      const idx = prev.findIndex((c) => c.id === commentId);
      if (idx !== -1) {
        const next = prev.slice();
        next[idx] = updater(prev[idx]);
        return next;
      }

      const base = paper?.comments?.find((c) => c.id === commentId);
      if (!base) return prev;
      const next = [updater({ ...base, replies: base.replies ? base.replies.slice() : [] }), ...prev];
      return next;
    });
  };

  const copyCodeHash = async () => {
    const value = paper?.codeHash || paper?.codeUrl;
    if (!value) return;
    const ok = await copyText(value);
    if (ok) setCopiedCodeHash(true);
  };

  const postReview = async () => {
    const authorName = reviewerName.trim() || "You";
    const anonymous = reviewAnonymous;
    const author = anonymous ? "Anonymous Reviewer" : authorName;

    if (tierFor(authorName) !== "reviewer") {
      setReviewError("Reviewer permission required (Plan §9.2). Set your account tier to Reviewer in the UI (demo).");
      return;
    }

    const sanction = getActiveSanctionForActor(actorSanctions, authorName);
    if (sanction) {
      const until = formatTimestamp(sanction.until);
      setReviewError(
        sanction.kind === "temporary_ban"
          ? `Temporarily banned until ${until} (${formatGovernanceReason(sanction.reasonCode)}).`
          : `Rate limited until ${until} (${formatGovernanceReason(sanction.reasonCode)}).`
      );
      return;
    }

    const coi = reviewCoi.trim();
    if (!coi) {
      setReviewError("Conflict of interest statement is required (write “None” if none).");
      return;
    }

    const summary = reviewSummary.trim();
    if (!summary) {
      setReviewError("Summary of contribution is required.");
      return;
    }

    const strengths = splitBullets(reviewStrengths);
    if (strengths.length === 0) {
      setReviewError("Major strengths are required (one per line).");
      return;
    }

    const concerns = splitBullets(reviewConcerns);
    if (concerns.length === 0) {
      setReviewError("Major concerns are required (one per line).");
      return;
    }

    const falsifiabilityAssessment = reviewFalsifiability.trim();
    if (!falsifiabilityAssessment) {
      setReviewError("Falsifiability assessment is required.");
      return;
    }

    const technicalCorrectnessAssessment = reviewTechnical.trim();
    if (!technicalCorrectnessAssessment) {
      setReviewError("Technical correctness assessment is required.");
      return;
    }

    const verificationReadiness = reviewReadiness.trim();
    if (!verificationReadiness) {
      setReviewError("Verification readiness is required.");
      return;
    }

    const requestedChanges = splitBullets(reviewRequestedChanges);
    if (requestedChanges.length === 0) {
      setReviewError("Requested changes are required (write “None” if none).");
      return;
    }

    const recommendation = reviewRecommendation.trim();
    if (!recommendation) {
      setReviewError("Recommendation is required (avoid Accept/Reject; use “Eligible for Level 2 after …”).");
      return;
    }

    const now = new Date();
    const createdAt = now.toISOString();

    const base: Review = {
      id: `local-${now.getTime()}`,
      author,
      anonymous,
      verified: anonymous ? false : reviewVerified,
      createdAt,
      hash: undefined,
      coi,
      origin: "community",
      summary,
      strengths,
      concerns,
      falsifiabilityAssessment,
      technicalCorrectnessAssessment,
      verificationReadiness,
      requestedChanges,
      recommendation,
    };

    const hash = await computeReviewHash(base);
    const next: Review = { ...base, hash };

    const nextReviews = [next, ...localReviews];
    setLocalReviews(nextReviews);
    setReviewHashById((prev) => ({ ...prev, [next.id]: hash }));
    persistLocalReviews(nextReviews);

    appendGovernance({
      actor: { role: "community", name: author },
      target: { type: "review", id: next.id },
      action: "review.create",
      reason: "Posted a structured review (audit record).",
      meta: { anonymous: Boolean(next.anonymous), verified: Boolean(next.verified), hash },
    });

    setReviewAnonymous(false);
    setReviewVerified(false);
    setReviewCoi("None");
    setReviewSummary("");
    setReviewStrengths("");
    setReviewConcerns("");
    setReviewFalsifiability("");
    setReviewTechnical("");
    setReviewReadiness("");
    setReviewRequestedChanges("");
    setReviewRecommendation("");
    setReviewError(null);
  };

  const postExternalArtifact = async () => {
    const normalizeUrl = (input: string) => {
      const raw = (input || "").trim();
      if (!raw) return "";
      try {
        const url = new URL(raw);
        if (url.protocol !== "http:" && url.protocol !== "https:") return raw;
        url.hash = "";
        return url.toString().replace(/\/$/, "");
      } catch {
        return raw;
      }
    };

    const access = importSourceAccess;
    const sourceUrl = normalizeUrl(importSourceUrl);
    const needsUrl = access === "public_url" || access === "token_gated";
    if (needsUrl && !sourceUrl) {
      setReviewError("Source URL is required when source access is Public URL / Token gated.");
      return;
    }
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      setReviewError("Source URL must start with http(s)://");
      return;
    }

    const curatorUserId = importCurator.trim() || "You";

    const sanction = getActiveSanctionForActor(actorSanctions, curatorUserId);
    if (sanction) {
      const until = formatTimestamp(sanction.until);
      setReviewError(
        sanction.kind === "temporary_ban"
          ? `Temporarily banned until ${until} (${formatGovernanceReason(sanction.reasonCode)}).`
          : `Rate limited until ${until} (${formatGovernanceReason(sanction.reasonCode)}).`
      );
      return;
    }

    const curatorSignature = importCuratorSignature.trim();
    if (!importAttest) {
      setReviewError("Curator attestation is required (this is an audit record, not copy-paste).");
      return;
    }
    if (!curatorSignature) {
      setReviewError("Curator signature is required when attesting (type your name/handle).");
      return;
    }

    // Anti-cheat (MVP): throttle new curators (client-only demo).
    try {
      const storeKey = "omega_curation_import_rate_v1";
      const nowMs = Date.now();
      const curatorKey = curatorUserId.trim().toLowerCase();
      const raw = localStorage.getItem(storeKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      const store =
        parsed && typeof parsed === "object"
          ? (parsed as { version?: unknown; byCurator?: unknown })
          : { version: 1, byCurator: {} };

      const byCurator =
        store.byCurator && typeof store.byCurator === "object" ? (store.byCurator as Record<string, unknown>) : {};
      const recordRaw = byCurator[curatorKey];
      const record =
        recordRaw && typeof recordRaw === "object"
          ? (recordRaw as { total?: unknown; events?: unknown })
          : { total: 0, events: [] as number[] };

      const total = Number.isFinite(record.total as number) ? Number(record.total) : 0;
      const eventsRaw = Array.isArray(record.events) ? (record.events as unknown[]) : [];
      const events = eventsRaw.map((v) => Number(v)).filter((n) => Number.isFinite(n));

      const windowMs = 10 * 60 * 1000;
      const recent = events.filter((t) => nowMs - t < windowMs);
      const isNew = total < 3;
      const limit = isNew ? 1 : 4;

      if (recent.length >= limit) {
        appendGovernance({
          actor: { role: "system", name: "Omega Anti-spam" },
          target: { type: "actor", id: curatorUserId },
          action: "actor.rate_limit",
          moderationAction: "rate_limit",
          reasonCode: "spam",
          reason: isNew ? "New-curator import throttle (demo anti-spam)." : "Burst import throttle (demo anti-spam).",
          meta: { windowMs, limit, recent: recent.length },
        });
        setReviewError(isNew ? "Rate limited: new curators can import at most 1 artifact per 10 minutes (anti-spam)." : "Rate limited: too many imports too quickly.");
        return;
      }
    } catch {
      // ignore rate limiter errors
    }

    const systemName = importSystemName.trim() || undefined;
    const sourceType = importSourceType;
    if (sourceType === "ai_system" && !systemName) {
      setReviewError("Source system name is required when source type is ai_system.");
      return;
    }

    const reviewGenerator = (() => {
      const raw = importOriginalAuthor.trim();
      if (raw) return raw;
      if (systemName) return systemName;
      return "Unknown Review Generator";
    })();
    const originalCreatedAt = importOriginalCreatedAt.trim() || undefined;
    const platform = importSourcePlatform.trim() || "other";
    const permission = importPermission;
    const license = importLicense.trim() || undefined;
    if (permission === "licensed" && !license) {
      setReviewError("License is required when permission is set to Licensed.");
      return;
    }

    const systemCreators = importSystemCreators
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (systemName && systemCreators.length === 0) {
      setReviewError("System creators are required when a source system name is provided (write “Unknown” if unknown).");
      return;
    }

    const disclaimer = importSourceDisclaimer.trim() || undefined;

    const versionId = (selectedVersion || paper?.versions?.[0]?.version || "").trim() || undefined;
    const doi = (paper?.doi || "").trim() || undefined;

    const sourceMergeKey = (() => {
      if (sourceUrl) return `url:${sourceUrl}`;
      return `nonurl:${access}|${platform.toLowerCase()}|${(systemName || "").toLowerCase()}|${reviewGenerator.toLowerCase()}|${(originalCreatedAt || "").toLowerCase()}`;
    })();

    const existingSourceVersionDup = externalArtifacts.some((a) => {
      const existingVersion = (a.paperVersionId || "").trim();
      if ((existingVersion || "") !== (versionId || "")) return false;

      const existingUrl = (a.source.url || "").trim();
      const existingKey = existingUrl
        ? `url:${existingUrl}`
        : `nonurl:${a.source.access}|${String(a.source.platform || "").toLowerCase()}|${String(a.source.systemName || "").toLowerCase()}|${String(a.source.originalAuthor || "").toLowerCase()}|${String(a.source.originalCreatedAt || "").toLowerCase()}`;
      return existingKey === sourceMergeKey;
    });
    if (existingSourceVersionDup) {
      setReviewError("Duplicate import: same source + same paper version already exists (dedupe/merge; duplicates earn 0 points).");
      return;
    }

    const mappedTargets = Array.from(
      new Set(
        importMappedClaims
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => normalizeTargetRef(s))
          .filter(Boolean) as string[]
      )
    );
    const mappedClaims = mappedTargets.filter((s) => /^C\d+$/.test(s));

    const roles = Array.from(new Set(importCuratorRoles));
    if (!roles.includes("curation")) roles.unshift("curation");
    if (mappedTargets.length > 0 && !roles.includes("claim-mapping")) roles.push("claim-mapping");

    const coi = (reviewCoi || "None").trim() || "None";
    if (!coi) {
      setReviewError("Conflict of interest statement is required (write “None” if none).");
      return;
    }

    const summary = reviewSummary.trim();
    if (!summary) {
      setReviewError("Summary is required.");
      return;
    }

    const strengths = splitBullets(reviewStrengths);
    const weaknesses = splitBullets(reviewConcerns);
    const questions = splitBullets(reviewRequestedChanges).filter((v) => !/^none$/i.test(v));
    const overallAssessment = reviewRecommendation.trim();
    if (!overallAssessment) {
      setReviewError("Overall assessment is required.");
      return;
    }

    const detailedParts: string[] = [];
    const detailedExtra = importDetailedComments.trim();
    if (detailedExtra) detailedParts.push(detailedExtra);
    const f = reviewFalsifiability.trim();
    const t = reviewTechnical.trim();
    const r = reviewReadiness.trim();
    if (f) detailedParts.push(`Falsifiability assessment:\n${f}`);
    if (t) detailedParts.push(`Technical correctness:\n${t}`);
    if (r) detailedParts.push(`Verification readiness:\n${r}`);
    const detailedComments = detailedParts.join("\n\n").trim() || "Not provided.";

    if (strengths.length === 0 && weaknesses.length === 0 && questions.length === 0 && !detailedExtra) {
      setReviewError("Provide at least one strength/weakness/question, or add detailed comments.");
      return;
    }

    // Anti-cheat (MVP): similarity detection for non-URL imports (prevents repeated snapshot reposting).
    if (!sourceUrl) {
      const tokenize = (text: string) => {
        const tokens = (text || "").toLowerCase().match(/[a-z0-9][a-z0-9._:-]{2,}/g) || [];
        return new Set(tokens);
      };
      const jaccard = (a: Set<string>, b: Set<string>) => {
        if (!a.size || !b.size) return 0;
        let inter = 0;
        for (const t of a) if (b.has(t)) inter++;
        const uni = a.size + b.size - inter;
        return uni ? inter / uni : 0;
      };
      const pack = (obj: ExternalReviewArtifact) =>
        [
          obj.source.systemName || "",
          obj.source.originalAuthor || "",
          obj.content.summary || "",
          (obj.content.strengths || []).join(" "),
          (obj.content.weaknesses || []).join(" "),
          (obj.content.questions || []).join(" "),
          obj.content.detailedComments || "",
          obj.content.overallAssessment || "",
        ].join("\n");

      const newPacked = [
        systemName || "",
        reviewGenerator,
        summary,
        strengths.join(" "),
        weaknesses.join(" "),
        questions.join(" "),
        detailedComments,
        overallAssessment,
      ].join("\n");
      const newTokens = tokenize(newPacked);

      if (newTokens.size >= 20) {
        for (const existing of externalArtifacts) {
          const existingVersion = (existing.paperVersionId || "").trim();
          if ((existingVersion || "") !== (versionId || "")) continue;
          if ((existing.source.url || "").trim()) continue;
          const sim = jaccard(newTokens, tokenize(pack(existing)));
          if (sim >= 0.92) {
            setReviewError("Similarity dedupe: a very similar non-URL snapshot review already exists for this paper version (merge; duplicates earn 0 points).");
            return;
          }
        }
      }
    }

    const attachments = (() => {
      const rawLines = (importEvidenceAttachments || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const out: ExternalReviewEvidenceAttachment[] = [];
      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        const parts = line
          .split("|")
          .map((p) => p.trim())
          .filter(Boolean);
        const id = `att-${Date.now()}-${i}`;
        let kind: ExternalReviewEvidenceAttachmentKind = "link";
        let label = `Attachment ${i + 1}`;
        let urlOrNote = "";

        if (parts.length === 1) {
          urlOrNote = parts[0];
          if (!/^https?:\/\//i.test(urlOrNote)) kind = "other";
        } else if (parts.length === 2) {
          label = parts[0] || label;
          urlOrNote = parts[1];
          kind = /^https?:\/\//i.test(urlOrNote) ? "link" : "other";
        } else {
          kind = normalizeExternalReviewEvidenceAttachmentKind(parts[0]);
          label = parts[1] || label;
          urlOrNote = parts.slice(2).join(" | ");
        }

        const normalizedUrl = /^https?:\/\//i.test(urlOrNote) ? normalizeUrl(urlOrNote) : "";
        out.push({
          id,
          kind,
          label,
          url: normalizedUrl || undefined,
          note: normalizedUrl ? undefined : (urlOrNote || undefined),
        });
      }
      return out;
    })();

    if ((access === "screenshot_only" || access === "export") && attachments.length === 0) {
      setReviewError("Evidence attachments are required when source access is screenshot_only/export (redact sensitive info).");
      return;
    }

    const now = new Date();
    const createdAt = now.toISOString();

    const base: ExternalReviewArtifact = {
      id: `era-${now.getTime()}`,
      paperId,
      paperVersionId: versionId,
      paperDoi: doi,
      createdAt,
      hash: undefined,
      status: "pending",
      source: {
        systemName: systemName || undefined,
        type: sourceType,
        url: sourceUrl || undefined,
        access,
        platform,
        originalAuthor: reviewGenerator,
        originalCreatedAt,
        license,
        permission,
        systemCreators: systemCreators.length ? systemCreators : undefined,
        disclaimer,
      },
      curator: {
        userId: curatorUserId,
        roles,
        attestation: DEFAULT_EXTERNAL_REVIEW_ATTESTATION,
        signature: curatorSignature,
        curatedAt: createdAt,
        coi,
        mappedClaims: mappedClaims.length ? mappedClaims : undefined,
        mappedTargets: mappedTargets.length ? mappedTargets : undefined,
      },
      evidenceAttachments: attachments.length ? attachments : undefined,
      content: {
        summary,
        strengths,
        weaknesses,
        questions,
        detailedComments,
        overallAssessment,
      },
    };

    const hash = await computeExternalArtifactHash(base);

    const existingHashDup = externalArtifacts.some((a) => {
      const h = (a.hash || externalArtifactHashById[a.id] || "").trim();
      return h && h === hash;
    });
    if (existingHashDup) {
      setReviewError("An external review artifact with the same hash already exists for this paper (dedup).");
      return;
    }
    const next: ExternalReviewArtifact = { ...base, hash };

    const nextArtifacts = [next, ...externalArtifacts];
    setExternalArtifacts(nextArtifacts);
    setExternalArtifactHashById((prev) => ({ ...prev, [next.id]: hash }));
    persistExternalArtifacts(nextArtifacts);

    appendGovernance({
      actor: { role: "curator", name: curatorUserId },
      target: { type: "external_review_artifact", id: next.id },
      action: "external_review_artifact.import",
      reason: "Imported an external review as a first-class artifact (curation).",
      meta: {
        paperVersionId: versionId || null,
        sourceAccess: access,
        sourceType,
        sourceUrl: sourceUrl || null,
        platform,
        hasEvidenceAttachments: attachments.length > 0,
        mappedTargetsCount: mappedTargets.length,
      },
    });

    // Record import event for anti-spam rate limiting (client-only demo).
    try {
      const storeKey = "omega_curation_import_rate_v1";
      const nowMs = Date.now();
      const curatorKey = curatorUserId.trim().toLowerCase();
      const raw = localStorage.getItem(storeKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      const store =
        parsed && typeof parsed === "object"
          ? (parsed as { version?: unknown; byCurator?: unknown })
          : { version: 1, byCurator: {} };

      const byCurator =
        store.byCurator && typeof store.byCurator === "object" ? (store.byCurator as Record<string, unknown>) : {};
      const recordRaw = byCurator[curatorKey];
      const record =
        recordRaw && typeof recordRaw === "object"
          ? (recordRaw as { total?: unknown; events?: unknown })
          : { total: 0, events: [] as number[] };

      const total = Number.isFinite(record.total as number) ? Number(record.total) : 0;
      const eventsRaw = Array.isArray(record.events) ? (record.events as unknown[]) : [];
      const events = eventsRaw.map((v) => Number(v)).filter((n) => Number.isFinite(n));
      events.push(nowMs);
      const nextRecord = { total: total + 1, events: events.slice(-64) };
      byCurator[curatorKey] = nextRecord;
      localStorage.setItem(storeKey, JSON.stringify({ version: 1, byCurator }));
    } catch {
      // ignore
    }

    setImportSourceUrl("");
    setImportSourceAccess("public_url");
    setImportSourceType("human");
    setImportSourcePlatform("blog");
    setImportOriginalAuthor("");
    setImportOriginalCreatedAt("");
    setImportPermission("link_only");
    setImportLicense("");
    setImportSystemName("");
    setImportSystemCreators("");
    setImportSourceDisclaimer("");
    setImportCurator("You");
    setImportCuratorRoles(["curation", "normalization"]);
    setImportCuratorSignature("");
    setImportMappedClaims("");
    setImportAttest(false);
    setImportEvidenceAttachments("");
    setImportDetailedComments("");

    setReviewCoi("None");
    setReviewSummary("");
    setReviewStrengths("");
    setReviewConcerns("");
    setReviewFalsifiability("");
    setReviewTechnical("");
    setReviewReadiness("");
    setReviewRequestedChanges("");
    setReviewRecommendation("");
    setReviewError(null);
  };

  const updateExternalArtifactById = useCallback(
    (artifactId: string, updater: (artifact: ExternalReviewArtifact) => ExternalReviewArtifact) => {
      setExternalArtifacts((prev) => {
        const next = prev.map((a) => (a.id === artifactId ? updater(a) : a));
        persistExternalArtifacts(next);
        return next;
      });
    },
    [persistExternalArtifacts]
  );

  const withdrawExternalArtifact = useCallback(
    (artifactId: string) => {
      if (artifactActorRole !== "curator") return;
      const actor = artifactActorName.trim() || "You";

      const current = externalArtifacts.find((a) => a.id === artifactId);
      if (!current) return;
      if (current.status === "removed") return;
      if (actor.toLowerCase() !== current.curator.userId.toLowerCase()) return;

      const reason = (window.prompt("Withdraw reason (required):") || "").trim();
      if (!reason) return;

      updateExternalArtifactById(artifactId, (a) => {
        if (a.status === "removed") return a;
        if (actor.toLowerCase() !== a.curator.userId.toLowerCase()) return a;
        const withdrawnAt = new Date().toISOString();
        return {
          ...a,
          status: "removed",
          statusReason: reason,
          withdrawal: { withdrawnAt, withdrawnBy: actor, reason },
        };
      });

      appendGovernance({
        actor: { role: "curator", name: actor },
        target: { type: "external_review_artifact", id: artifactId },
        action: "external_review_artifact.withdraw",
        reason,
        meta: { fromStatus: current.status, toStatus: "removed" },
      });
    },
    [appendGovernance, artifactActorName, artifactActorRole, externalArtifacts, updateExternalArtifactById]
  );

  const moderateExternalArtifact = useCallback(
    (artifactId: string, nextStatus: ExternalReviewArtifactStatus) => {
      if (artifactActorRole !== "editor") return;
      const actor = artifactActorName.trim() || "Omega Editor";
      const current = externalArtifacts.find((a) => a.id === artifactId);
      if (!current) return;

      if (nextStatus === "pending") {
        const note = (window.prompt("Editor note (required):") || "").trim();
        if (!note) return;
        updateExternalArtifactById(artifactId, (a) => {
          const reviewedAt = new Date().toISOString();
          return {
            ...a,
            status: nextStatus,
            statusReason: note,
            moderation: { reviewedAt, reviewedBy: actor, note },
          };
        });
        appendGovernance({
          actor: { role: "editor", name: actor },
          target: { type: "external_review_artifact", id: artifactId },
          action: "external_review_artifact.status.set",
          reason: note,
          meta: { fromStatus: current.status, toStatus: nextStatus },
        });
        return;
      }

      const moderationAction: GovernanceModerationAction =
        nextStatus === "approved" ? "approve" : nextStatus === "soft_hidden" ? "soft_hide" : "remove";

      let reasonCode: GovernanceReasonCode | undefined;
      let note: string | undefined;
      let statusReason = "Approved";

      if (moderationAction === "approve") {
        note = (window.prompt("Approval note (optional):") || "").trim() || undefined;
        statusReason = note ? `Approved — ${note}` : "Approved";
      } else {
        const picked = promptModerationReason({
          title: `${formatGovernanceModerationAction(moderationAction)} — select reason code / 选择理由代码`,
          defaultCode: moderationAction === "soft_hide" ? "off_topic" : "spam",
        });
        if (!picked) return;
        reasonCode = picked.reasonCode;
        note = picked.note;
        statusReason = `${formatGovernanceReason(picked.reasonCode)}${picked.note ? ` — ${picked.note}` : ""}`;
      }

      updateExternalArtifactById(artifactId, (a) => {
        const reviewedAt = new Date().toISOString();
        const clearedWithdrawal = nextStatus !== "removed" ? { withdrawal: undefined } : {};
        return {
          ...a,
          ...clearedWithdrawal,
          status: nextStatus,
          statusReason,
          moderation: { reviewedAt, reviewedBy: actor, note },
        };
      });

      appendGovernance({
        actor: { role: "editor", name: actor },
        target: { type: "external_review_artifact", id: artifactId },
        action: "external_review_artifact.status.set",
        moderationAction,
        reasonCode,
        reason: note,
        meta: { fromStatus: current.status, toStatus: nextStatus },
      });
    },
    [appendGovernance, artifactActorName, artifactActorRole, externalArtifacts, updateExternalArtifactById]
  );

  const toggleExternalArtifactHelpfulVote = useCallback(
    (artifactId: string) => {
      if (artifactActorRole !== "community") return;
      const actor = (artifactActorName.trim() || "You").trim();
      if (!actor) return;

      const current = externalArtifacts.find((a) => a.id === artifactId);
      if (!current) return;
      const prevVotes = (current.validation?.helpfulVotes || []).filter((v) => v && typeof v.by === "string" && typeof v.at === "string");
      const hadVote = prevVotes.some((v) => v.by.toLowerCase() === actor.toLowerCase());

      updateExternalArtifactById(artifactId, (a) => {
        const now = new Date().toISOString();
        const prevVotes = (a.validation?.helpfulVotes || []).filter((v) => v && typeof v.by === "string" && typeof v.at === "string");
        const has = prevVotes.some((v) => v.by.toLowerCase() === actor.toLowerCase());
        const nextVotes = has
          ? prevVotes.filter((v) => v.by.toLowerCase() !== actor.toLowerCase())
          : [...prevVotes, { by: actor, at: now }];

        const nextValidation = {
          ...(a.validation || {}),
          helpfulVotes: nextVotes.length ? nextVotes : undefined,
        };

        if (!nextValidation.helpfulVotes && !nextValidation.addressed && !nextValidation.highSignal) {
          return { ...a, validation: undefined };
        }
        return { ...a, validation: nextValidation };
      });

      appendGovernance({
        actor: { role: "community", name: actor },
        target: { type: "external_review_artifact", id: artifactId },
        action: "external_review_artifact.vote.helpful",
        reason: hadVote ? "Unmarked helpful." : "Marked helpful.",
        meta: { added: !hadVote },
      });
    },
    [appendGovernance, artifactActorName, artifactActorRole, externalArtifacts, updateExternalArtifactById]
  );

  const toggleExternalArtifactAddressed = useCallback(
    (artifactId: string) => {
      if (artifactActorRole !== "author") return;
      const actor = (artifactActorName.trim() || "Author").trim();
      if (!actor) return;

      const current = externalArtifacts.find((a) => a.id === artifactId);
      if (!current) return;
      const had = Boolean(current.validation?.addressed);
      const note = !had ? (window.prompt("Addressed note (optional):") || "").trim() || undefined : undefined;

      updateExternalArtifactById(artifactId, (a) => {
        const now = new Date().toISOString();
        const nextValidation: NonNullable<ExternalReviewArtifact["validation"]> = { ...(a.validation || {}) };

        if (nextValidation.addressed) {
          nextValidation.addressed = undefined;
        } else {
          nextValidation.addressed = { addressedAt: now, addressedBy: actor, note };
        }

        if (!nextValidation.helpfulVotes && !nextValidation.addressed && !nextValidation.highSignal) {
          return { ...a, validation: undefined };
        }
        return { ...a, validation: nextValidation };
      });

      appendGovernance({
        actor: { role: "author", name: actor },
        target: { type: "external_review_artifact", id: artifactId },
        action: "external_review_artifact.addressed.toggle",
        reason: note || (had ? "Unmarked addressed." : "Marked addressed."),
        meta: { nowAddressed: !had },
      });
    },
    [appendGovernance, artifactActorName, artifactActorRole, externalArtifacts, updateExternalArtifactById]
  );

  const toggleExternalArtifactHighSignal = useCallback(
    (artifactId: string) => {
      if (artifactActorRole !== "editor") return;
      const actor = (artifactActorName.trim() || "Omega Editor").trim();
      if (!actor) return;

      const current = externalArtifacts.find((a) => a.id === artifactId);
      if (!current) return;
      const had = Boolean(current.validation?.highSignal);

      const note = had
        ? (window.prompt("Unmark high-signal note (optional):") || "").trim() || undefined
        : (window.prompt("High-signal note (required):") || "").trim();
      if (!had && !note) return;

      updateExternalArtifactById(artifactId, (a) => {
        const now = new Date().toISOString();
        const nextValidation: NonNullable<ExternalReviewArtifact["validation"]> = { ...(a.validation || {}) };

        if (nextValidation.highSignal) {
          nextValidation.highSignal = undefined;
        } else {
          nextValidation.highSignal = { markedAt: now, markedBy: actor, note: typeof note === "string" ? note : undefined };
        }

        if (!nextValidation.helpfulVotes && !nextValidation.addressed && !nextValidation.highSignal) {
          return { ...a, validation: undefined };
        }
        return { ...a, validation: nextValidation };
      });

      appendGovernance({
        actor: { role: "editor", name: actor },
        target: { type: "external_review_artifact", id: artifactId },
        action: "external_review_artifact.high_signal.toggle",
        reason: typeof note === "string" ? note : had ? "Unmarked high-signal." : "Marked high-signal.",
        meta: { nowHighSignal: !had },
      });
    },
    [appendGovernance, artifactActorName, artifactActorRole, externalArtifacts, updateExternalArtifactById]
  );

  const toggleReviewAddressed = useCallback(
    (reviewId: string) => {
      if (artifactActorRole !== "author") return;
      const actor = (artifactActorName.trim() || "Author").trim();
      if (!actor) return;

      const current = localReviews.find((r) => r.id === reviewId) || paper?.reviews?.find((r) => r.id === reviewId);
      if (!current) return;

      const had = Boolean(current.addressed);
      const note = !had ? (window.prompt("Addressed note (optional):") || "").trim() || undefined : undefined;

      updateReviewById(reviewId, (r) => {
        if (had) return { ...r, addressed: undefined };
        return { ...r, addressed: { addressedAt: new Date().toISOString(), addressedBy: actor, note } };
      });

      appendGovernance({
        actor: { role: "author", name: actor },
        target: { type: "review", id: reviewId },
        action: "review.addressed.toggle",
        reason: note || (had ? "Unmarked addressed." : "Marked addressed."),
        meta: { nowAddressed: !had },
      });
    },
    [appendGovernance, artifactActorName, artifactActorRole, localReviews, paper?.reviews, updateReviewById]
  );

  const issueActorSanction = useCallback(
    (args: { targetName: string; kind: "rate_limit" | "temporary_ban"; issuedBy: string }) => {
      const targetName = args.targetName.trim();
      if (!targetName) return;

      const title =
        args.kind === "temporary_ban"
          ? "Temporary ban / 临时封禁 — select reason code / 选择理由代码"
          : "Rate limit / 限流 — select reason code / 选择理由代码";
      const picked = promptModerationReason({ title, defaultCode: "spam" });
      if (!picked) return;

      const durationInput =
        args.kind === "temporary_ban"
          ? (window.prompt("Ban duration (hours, default 24):") || "").trim()
          : (window.prompt("Rate limit duration (minutes, default 10):") || "").trim();
      const duration = durationInput ? Number(durationInput) : args.kind === "temporary_ban" ? 24 : 10;
      if (!Number.isFinite(duration) || duration <= 0) return;

      const now = new Date();
      const createdAt = now.toISOString();
      const ms = args.kind === "temporary_ban" ? duration * 60 * 60 * 1000 : duration * 60 * 1000;
      const until = new Date(now.getTime() + ms).toISOString();

      const sanction: ActorSanction = {
        id: `san-${now.getTime()}`,
        kind: args.kind,
        createdAt,
        until,
        actor: { name: targetName, key: actorKey(targetName) },
        issuedBy: { name: args.issuedBy.trim() || "Omega Editor" },
        reasonCode: picked.reasonCode,
        note: picked.note,
      };

      commitActorSanctions((prev) => [sanction, ...prev].slice(0, 400));

      appendGovernance({
        actor: { role: "editor", name: sanction.issuedBy.name },
        target: { type: "actor", id: sanction.actor.name },
        action: args.kind === "temporary_ban" ? "actor.temporary_ban" : "actor.rate_limit",
        moderationAction: args.kind as GovernanceModerationAction,
        reasonCode: picked.reasonCode,
        reason: picked.note,
        meta: { until: sanction.until },
      });
    },
    [appendGovernance, commitActorSanctions]
  );

  const requestEvidenceForComment = useCallback(
    (comment: Comment) => {
      const tier = tierFor(commentActorName);
      const can =
        commentActorRole === "author" ||
        commentActorRole === "editor" ||
        (commentActorRole === "community" && (tier === "high_reputation" || tier === "reviewer"));
      if (!can) return;
      const visibility = comment.visibility || "published";
      if (visibility === "queued") return;
      if (comment.removed || comment.mergedIntoId) return;
      const actor = (commentActorRole === "editor" ? "Omega Editor" : commentActorName).trim() || "You";

      const picked = promptModerationReason({
        title: "Request evidence / 要求补证据 — select reason code / 选择理由代码",
        defaultCode: "no_evidence_for_strong_claim",
        noteLabel: "What evidence is missing? / 缺什么证据？(optional / 可选):",
      });
      if (!picked) return;

      const targetDefault = (comment.targetRef || "").trim();
      const targetRaw = (window.prompt("Target ref (optional, e.g., C1, #p3, §2.1):", targetDefault) || "").trim();
      const normalizedTarget = targetRaw ? normalizeTargetRef(targetRaw) || targetRaw : undefined;

      appendGovernance({
        actor: { role: commentActorRole, name: actor },
        target: { type: "comment", id: comment.id },
        action: "comment.request_evidence",
        moderationAction: "request_evidence",
        reasonCode: picked.reasonCode,
        reason: picked.note,
        meta: { targetRef: normalizedTarget || comment.targetRef || null },
      });
    },
    [appendGovernance, commentActorName, commentActorRole, tierFor]
  );

  const requestEvidenceForExternalArtifact = useCallback(
    (artifactId: string) => {
      if (artifactActorRole !== "editor") return;
      const actor = (artifactActorName.trim() || "Omega Editor").trim();
      if (!actor) return;

      const artifact = externalArtifacts.find((a) => a.id === artifactId);
      if (!artifact) return;

      const picked = promptModerationReason({
        title: "Request evidence / 要求补证据 — select reason code / 选择理由代码",
        defaultCode: "no_evidence_for_strong_claim",
        noteLabel: "What evidence is missing? / 缺什么证据？(optional / 可选):",
      });
      if (!picked) return;

      const targetRaw = (window.prompt("Target ref (optional, e.g., C1, #p3, §2.1):", "") || "").trim();
      const normalizedTarget = targetRaw ? normalizeTargetRef(targetRaw) || targetRaw : undefined;

      appendGovernance({
        actor: { role: "editor", name: actor },
        target: { type: "external_review_artifact", id: artifact.id },
        action: "external_review_artifact.request_evidence",
        moderationAction: "request_evidence",
        reasonCode: picked.reasonCode,
        reason: picked.note,
        meta: { paperVersionId: artifact.paperVersionId || null, targetRef: normalizedTarget || null },
      });
    },
    [appendGovernance, artifactActorName, artifactActorRole, externalArtifacts]
  );

  const approveQueuedComment = useCallback(
    (commentId: string) => {
      if (commentActorRole !== "editor") return;
      const actor = (commentActorName || "Omega Editor").trim() || "Omega Editor";

      const current = localComments.find((c) => c.id === commentId) || paper?.comments?.find((c) => c.id === commentId);
      if (!current) return;
      const visibility = current.visibility || "published";
      if (visibility !== "queued") return;
      if (current.removed) return;

      const note = (window.prompt("Approval note (optional):") || "").trim() || undefined;
      updateCommentById(commentId, (c) => ({ ...c, visibility: "published" }));

      appendGovernance({
        actor: { role: "editor", name: actor },
        target: { type: "comment", id: commentId },
        action: "comment.approve",
        moderationAction: "approve",
        reason: note,
        meta: { fromVisibility: "queued", toVisibility: "published" },
      });
    },
    [appendGovernance, commentActorName, commentActorRole, localComments, paper?.comments, updateCommentById]
  );

  const removeComment = useCallback(
    (commentId: string) => {
      if (commentActorRole !== "editor") return;
      const actor = (commentActorName || "Omega Editor").trim() || "Omega Editor";

      const current = localComments.find((c) => c.id === commentId) || paper?.comments?.find((c) => c.id === commentId);
      if (!current) return;
      if (current.removed) return;

      const picked = promptModerationReason({
        title: "Remove / 移除 — select reason code / 选择理由代码",
        defaultCode: "spam",
        noteLabel: "Optional details / 可选补充说明（锚点/主张编号/一句话解释）:",
      });
      if (!picked) return;

      updateCommentById(commentId, (c) => ({ ...c, removed: true, softHidden: true }));

      appendGovernance({
        actor: { role: "editor", name: actor },
        target: { type: "comment", id: commentId },
        action: "comment.remove",
        moderationAction: "remove",
        reasonCode: picked.reasonCode,
        reason: picked.note,
      });
    },
    [appendGovernance, commentActorName, commentActorRole, localComments, paper?.comments, updateCommentById]
  );

  const mergeDuplicateComment = useCallback(
    (duplicateId: string) => {
      const tier = tierFor(commentActorName);
      const can = commentActorRole === "community" && (tier === "high_reputation" || tier === "reviewer");
      if (!can) return;

      const actor = (commentActorName || "You").trim() || "You";
      const current = localComments.find((c) => c.id === duplicateId) || paper?.comments?.find((c) => c.id === duplicateId);
      if (!current) return;
      if (current.removed) return;

      const canonicalId = (window.prompt("Merge duplicate into (target comment id):", "") || "").trim();
      if (!canonicalId || canonicalId === duplicateId) return;

      const exists =
        localComments.some((c) => c.id === canonicalId) || Boolean(paper?.comments?.some((c) => c.id === canonicalId));
      if (!exists) return;

      updateCommentById(duplicateId, (c) => ({ ...c, mergedIntoId: canonicalId, softHidden: true }));

      appendGovernance({
        actor: { role: "community", name: actor },
        target: { type: "comment", id: duplicateId },
        action: "comment.merge_duplicate",
        moderationAction: "soft_hide",
        reasonCode: "duplicate",
        reason: `Merged into ${canonicalId}.`,
        meta: { mergedIntoId: canonicalId },
      });
    },
    [appendGovernance, commentActorName, commentActorRole, localComments, paper?.comments, tierFor, updateCommentById]
  );

  const postComment = async () => {
    const draft = commentDraft.trim();
    if (!draft) {
      setCommentError("Comment cannot be empty.");
      return;
    }

    const needsTargetRef = commentKind === "suggestion" || commentKind === "concern" || commentKind === "counterexample";
    const targetRef = commentTargetRef.trim();
    if (needsTargetRef && !targetRef) {
      setCommentError("Suggestion / Concern / Counterexample comments must cite a target (e.g., C1 or a paragraph anchor).");
      return;
    }

    const now = new Date();
    const createdAt = now.toISOString().slice(0, 10);
    const author = (commentActorRole === "editor" ? "Omega Editor" : commentActorName).trim() || "You";

    const sanction = getActiveSanctionForActor(actorSanctions, author);
    if (sanction) {
      const until = formatTimestamp(sanction.until);
      setCommentError(
        sanction.kind === "temporary_ban"
          ? `Temporarily banned until ${until} (${formatGovernanceReason(sanction.reasonCode)}).`
          : `Rate limited until ${until} (${formatGovernanceReason(sanction.reasonCode)}).`
      );
      return;
    }

    const visibility =
      commentActorRole === "community" && tierFor(author) === "new"
        ? ("queued" as const)
        : ("published" as const);

    const next: Comment = {
      id: `local-${now.getTime()}`,
      author,
      authorRole: commentActorRole,
      createdAt,
      kind: commentKind,
      body: draft,
      targetRef: targetRef || undefined,
      visibility,
      status: "open",
    };

    const nextComments = [next, ...localComments];
    setLocalComments(nextComments);
    persistLocalComments(nextComments);

    appendGovernance({
      actor: { role: commentActorRole, name: author },
      target: { type: "comment", id: next.id },
      action: "comment.create",
      reason: "Posted a typed comment (discussion channel).",
      meta: { kind: commentKind, targetRef: targetRef || null, visibility },
    });

    setCommentDraft("");
    setCommentTargetRef("");
    setCommentKind("question");
    setCommentError(null);
  };

  const toggleReply = (commentId: string) => {
    const current = localComments.find((c) => c.id === commentId) || paper?.comments?.find((c) => c.id === commentId);
    if (!current) return;
    const visibility = current.visibility || "published";
    if (current.removed || current.mergedIntoId || visibility === "queued") return;

    setCommentReplyOpenById((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
    setCommentReplyErrorById((prev) => ({ ...prev, [commentId]: "" }));
  };

  const postReply = (commentId: string) => {
    const current = localComments.find((c) => c.id === commentId) || paper?.comments?.find((c) => c.id === commentId);
    if (!current) return;
    const visibility = current.visibility || "published";
    if (current.removed || current.mergedIntoId || visibility === "queued") {
      setCommentReplyErrorById((prev) => ({ ...prev, [commentId]: "Replies are disabled for queued/removed/merged comments." }));
      return;
    }

    const draft = (commentReplyDraftById[commentId] || "").trim();
    if (!draft) {
      setCommentReplyErrorById((prev) => ({ ...prev, [commentId]: "Reply cannot be empty." }));
      return;
    }

    const now = new Date();
    const createdAt = now.toISOString().slice(0, 10);
    const author = (commentActorRole === "editor" ? "Omega Editor" : commentActorName).trim() || "You";

    const sanction = getActiveSanctionForActor(actorSanctions, author);
    if (sanction) {
      const until = formatTimestamp(sanction.until);
      setCommentReplyErrorById((prev) => ({
        ...prev,
        [commentId]:
          sanction.kind === "temporary_ban"
            ? `Temporarily banned until ${until} (${formatGovernanceReason(sanction.reasonCode)}).`
            : `Rate limited until ${until} (${formatGovernanceReason(sanction.reasonCode)}).`,
      }));
      return;
    }

    const reply: CommentReply = {
      id: `reply-${now.getTime()}`,
      author,
      authorRole: commentActorRole,
      createdAt,
      body: draft,
    };

    updateCommentById(commentId, (comment) => ({
      ...comment,
      replies: [...(comment.replies || []), reply],
    }));

    appendGovernance({
      actor: { role: commentActorRole, name: author },
      target: { type: "comment", id: commentId },
      action: "comment.reply",
      reason: "Replied to a comment.",
    });

    setCommentReplyDraftById((prev) => ({ ...prev, [commentId]: "" }));
    setCommentReplyErrorById((prev) => ({ ...prev, [commentId]: "" }));
    setCommentReplyOpenById((prev) => ({ ...prev, [commentId]: false }));
  };

  const setCommentStatus = (commentId: string, status: CommentStatus) => {
    const current = localComments.find((c) => c.id === commentId) || paper?.comments?.find((c) => c.id === commentId);
    if (!current) return;
    if (commentActorRole !== "author" && commentActorRole !== "editor") return;
    const visibility = current.visibility || "published";
    if (visibility === "queued") return;
    if (current.removed || current.mergedIntoId) return;
    const from = current.status || "open";
    if (from === status) return;
    updateCommentById(commentId, (comment) => ({ ...comment, status }));

    const actor = (commentActorRole === "editor" ? "Omega Editor" : commentActorName).trim() || "You";
    const reason = status === "open" ? "Reopened." : status === "resolved" ? "Marked resolved." : "Marked incorporated.";
    appendGovernance({
      actor: { role: commentActorRole, name: actor },
      target: { type: "comment", id: commentId },
      action: "comment.status.set",
      reason,
      meta: { fromStatus: from, toStatus: status },
    });
  };

  const setCommentSoftHidden = (commentId: string, softHidden: boolean, opts?: { defaultReasonCode?: GovernanceReasonCode }) => {
    const current = localComments.find((c) => c.id === commentId) || paper?.comments?.find((c) => c.id === commentId);
    if (!current) return;
    const visibility = current.visibility || "published";
    if (visibility === "queued") return;
    if (current.removed) return;
    const from = Boolean(current.softHidden);
    if (from === softHidden) return;

    const actor = (commentActorRole === "editor" ? "Omega Editor" : commentActorName).trim() || "You";
    const tier = commentActorRole === "community" ? tierFor(actor) : null;
    const can =
      commentActorRole === "author" ||
      commentActorRole === "editor" ||
      (commentActorRole === "community" && (tier === "high_reputation" || tier === "reviewer"));
    if (!can) return;
    const picked = softHidden
      ? promptModerationReason({
          title: "Soft hide / 折叠 — select reason code / 选择理由代码",
          defaultCode: opts?.defaultReasonCode || "off_topic",
        })
      : null;
    if (softHidden && !picked) return;
    const reason = softHidden ? picked!.note : "Unfolded.";

    updateCommentById(commentId, (comment) => ({ ...comment, softHidden }));
    if (!softHidden) setCommentExpandedById((prev) => ({ ...prev, [commentId]: true }));

    appendGovernance({
      actor: { role: commentActorRole, name: actor },
      target: { type: "comment", id: commentId },
      action: softHidden ? "comment.soft_hide" : "comment.unhide",
      moderationAction: softHidden ? "soft_hide" : undefined,
      reasonCode: softHidden ? picked!.reasonCode : undefined,
      reason,
      meta: { fromSoftHidden: from, toSoftHidden: softHidden },
    });
  };

  const toggleCommentExpanded = (commentId: string) => {
    setCommentExpandedById((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const citeComment = async (comment: Comment) => {
    if (!paper) return;
    const roleSuffix = comment.authorRole === "author" ? " (Author)" : comment.authorRole === "editor" ? " (Editor)" : "";
    const target = comment.targetRef ? ` @${comment.targetRef}` : "";
    const status = comment.status && comment.status !== "open" ? `, ${comment.status}` : "";
    const flags: string[] = [];
    const visibility = comment.visibility || "published";
    if (visibility === "queued") flags.push("queued");
    if (comment.removed) flags.push("removed");
    if (comment.mergedIntoId) flags.push(`duplicate_of:${comment.mergedIntoId}`);
    const flagSuffix = flags.length ? `, ${flags.join(",")}` : "";
    const citation = [
      `Omega Institute Comment (${comment.createdAt}).`,
      `"${paper.title}".`,
      `Comment by ${comment.author}${roleSuffix} [${comment.kind}${status}${flagSuffix}${target}].`,
      `DOI: ${paper.doi}.`,
    ].join(" ");

    await copyText(citation);
  };

  const citeReview = async (review: Review) => {
    if (!paper) return;
    const existingHash = (review.hash || reviewHashById[review.id] || "").trim();
    const hash = existingHash || (await computeReviewHash(review));
    if (!existingHash) setReviewHashById((prev) => ({ ...prev, [review.id]: hash }));

    const who = review.anonymous ? "Anonymous Reviewer" : review.author;
    const verifiedSuffix = review.verified && !review.anonymous ? " (Verified)" : "";
    const coi = (review.coi || "None").trim() || "None";

    const citation = [
      `Omega Institute Open Review (${formatTimestamp(review.createdAt)}).`,
      `"${paper.title}".`,
      `Review hash: ${hash}.`,
      `Reviewer: ${who}${verifiedSuffix}.`,
      `COI: ${coi}.`,
      `DOI: ${paper.doi}.`,
    ].join(" ");

    await copyText(citation);
  };

  const citeExternalArtifact = async (artifact: ExternalReviewArtifact) => {
    if (!paper) return;
    const existingHash = (artifact.hash || externalArtifactHashById[artifact.id] || "").trim();
    const hash = existingHash || (await computeExternalArtifactHash(artifact));
    if (!existingHash) setExternalArtifactHashById((prev) => ({ ...prev, [artifact.id]: hash }));

    const generator = (artifact.source.originalAuthor || artifact.source.systemName || "Unknown").trim();
    const curator = (artifact.curator.userId || "Unknown").trim();
    const system = artifact.source.systemName ? ` AI system: ${artifact.source.systemName}.` : "";
    const systemCreators = artifact.source.systemCreators?.length ? ` System creators: ${artifact.source.systemCreators.join(", ")}.` : "";
    const sourceUrl = artifact.source.url ? `Source: ${artifact.source.url}.` : `Source access: ${artifact.source.access}.`;

    const citation = [
      `Omega Institute External Review Artifact (${formatTimestamp(artifact.createdAt)}).`,
      `"${paper.title}".`,
      `Artifact hash: ${hash}.`,
      `Status: ${artifact.status}.`,
      `Review generator: ${generator}.`,
      `Curator: ${curator}.`,
      sourceUrl,
      system.trim(),
      systemCreators.trim(),
      artifact.paperVersionId ? `Paper version: ${artifact.paperVersionId}.` : "",
      `DOI: ${paper.doi}.`,
    ]
      .filter(Boolean)
      .join(" ");

    await copyText(citation);
  };

  const evidenceRequestCountByTargetId = useMemo(() => {
    const out: Record<string, number> = {};
    for (const entry of governanceLog) {
      if (entry.moderationAction !== "request_evidence") continue;
      out[entry.target.id] = (out[entry.target.id] || 0) + 1;
    }
    return out;
  }, [governanceLog]);

  if (!paper) return null;

  const commentViewer = (commentActorRole === "editor" ? "Omega Editor" : commentActorName).trim() || "You";
  const viewerTier = commentActorRole === "community" ? tierFor(commentViewer) : null;
  const canAssistModeration = commentActorRole === "community" && (viewerTier === "high_reputation" || viewerTier === "reviewer");
  const canRequestEvidence = commentActorRole === "author" || commentActorRole === "editor" || canAssistModeration;
  const canModerateComments = commentActorRole === "author" || commentActorRole === "editor";
  const localCommentIds = new Set(localComments.map((c) => c.id));
  const mergedComments = [...localComments, ...(paper.comments || []).filter((c) => !localCommentIds.has(c.id))];
  const queuedCommentCount = mergedComments.filter((c) => (c.visibility || "published") === "queued" && !c.removed).length;
  const visibleComments = mergedComments.filter((c) => {
    const visibility = c.visibility || "published";
    if (visibility !== "queued") return true;
    if (c.removed) return true;
    if (commentActorRole === "editor") return true;
    return c.author === commentViewer;
  });
  const localReviewIds = new Set(localReviews.map((r) => r.id));
  const mergedReviews = [...localReviews, ...(paper.reviews || []).filter((r) => !localReviewIds.has(r.id))];

  const contributorRoleOrder: ContributorRole[] = ["Conceptualization", "Methodology", "Software", "Validation", "Writing", "Visualization"];
  const contributorRows = contributorRoleOrder
    .map((role) => {
      const names = paper.contributorRoles?.[role] || [];
      const list = Array.isArray(names) ? names.filter(Boolean) : [];
      return { role, contributors: list };
    })
    .filter((row) => row.contributors.length > 0);

  return (
    <SheetContent className="w-full sm:max-w-2xl lg:max-w-3xl border-l border-zinc-800 bg-zinc-950 p-0 flex flex-col h-full">
      {/* Header Area */}
      <div className="p-6 pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 mb-4 text-xs font-mono text-emerald-500">
          <Terminal className="w-4 h-4" />
          <span>ARCHIVE_READ_ONLY_MODE</span>
        </div>
        <h2 className="text-2xl font-bold font-serif text-white mb-2">{paper.title}</h2>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
           <span>
             By {paper.authors.map(a => a.name).join(", ")}
           </span>
           <span className="text-zinc-600">|</span>
           <span className="font-mono">{paper.doi}</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8">
          
          {/* Abstract */}
          <div className="prose prose-invert max-w-none">
            <p className="text-zinc-300 leading-relaxed text-sm">
              {paper.abstract}
            </p>
            <p className="text-xs text-zinc-500 mt-2 italic border-l-2 border-emerald-900 pl-2">
              Archive record. Community review may be ongoing.
            </p>
          </div>

          {/* Trust Layer Block */}
          <div className="border border-zinc-800 bg-zinc-900/20 p-4 space-y-4">
             <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-2">
               <ShieldCheck className="w-4 h-4" /> Trust Layer
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                   <span className="block text-zinc-500 text-xs mb-1">Source</span>
                   <div className="flex items-center gap-2 text-zinc-300">
                      <Badge variant="outline" className="font-mono text-xs">{paper.importedFrom}</Badge>
                      {sourceUrl ? (
                        <a href={sourceUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-3 h-3 text-zinc-600 hover:text-white" />
                        </a>
                      ) : (
                        <ExternalLink className="w-3 h-3 text-zinc-600" />
                      )}
                   </div>
                </div>
                <div>
                   <span className="block text-zinc-500 text-xs mb-1">Falsifiability Path</span>
                   <p className="text-zinc-300 text-xs font-mono border-l border-zinc-700 pl-2">
                     {paper.falsifiabilityPath}
                   </p>
                </div>
             </div>

             {/* Bounty Status */}
             <div className="bg-zinc-950 border border-zinc-800 p-3 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-xs text-zinc-500 uppercase">Replication Status</span>
                  {paper.replicationBounty?.active ? (
                    <span className="text-indigo-400 font-bold flex items-center gap-2">
                       Active Bounty: {paper.replicationBounty.amountELF} ELF
                    </span>
                  ) : (
                    <span className="text-zinc-400">No active bounty</span>
                  )}
                 </div>
                 <div className="flex items-center gap-2">
                   <Link href={`/conclusion?paper=${encodeURIComponent(paper.id)}`}>
                     <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:border-emerald-500 hover:text-emerald-500">
                       Conclusion
                     </Button>
                   </Link>
                   <Button
                     size="sm"
                     variant="outline"
                     className="border-zinc-700 text-zinc-300 hover:border-emerald-500 hover:text-emerald-500"
                     onClick={() => void generateReviewCard()}
                    disabled={cardBusy}
                   >
                     {cardBusy ? "Generating..." : "Review Card"}
                   </Button>
                   {paper.replicationBounty?.active && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-indigo-500 text-indigo-500 hover:bg-indigo-950"
                        onClick={() => setTab("verify")}
                      >
                        Start Replication
                      </Button>
                   )}
                 </div>
              </div>
             {cardError ? (
               <div className="mt-3 border border-red-900/40 bg-red-950/20 p-3 text-sm text-red-300">
                 {cardError}
               </div>
             ) : null}
          </div>

          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="w-full justify-start bg-transparent border-b border-zinc-800 rounded-none p-0 h-auto">
              <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">Overview</TabsTrigger>
              <TabsTrigger value="audit" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">Audit</TabsTrigger>
              <TabsTrigger value="epistemic" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">Epistemic</TabsTrigger>
              <TabsTrigger value="defense" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">Defense</TabsTrigger>
              <TabsTrigger value="verify" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">Verify</TabsTrigger>
              <TabsTrigger value="versions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">History</TabsTrigger>
              <TabsTrigger value="comments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">
                Comments{" "}
                <Badge className="ml-2 h-4 px-1 text-[10px]" variant="secondary">
                  {(paper.comments?.length || 0) + localComments.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="reviews" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">
                Reviews{" "}
                <Badge className="ml-2 h-4 px-1 text-[10px]" variant="secondary">
                  {paper.openReviewsCount + localReviews.length}
                </Badge>
                {externalArtifacts.length ? (
                  <Badge className="ml-1 h-4 px-1 text-[10px]" variant="muted">
                    EXT {externalArtifacts.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="governance" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">
                Governance{" "}
                <Badge className="ml-2 h-4 px-1 text-[10px]" variant="muted">
                  {governanceLog.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="files" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent pb-3 pt-2">Files & Code</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-6 space-y-6">
              <div className="space-y-6">
                <div className="border border-zinc-800 bg-zinc-900/20 p-4">
                  <h4 className="text-sm font-semibold text-zinc-300 mb-3">Authors & Accountability</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Authors</div>
                      <div className="text-zinc-300">{paper.authors.map((a) => a.name).join(", ")}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 mb-1">Responsible Steward</div>
                      <div className="text-zinc-300">
                        {paper.responsibleStewards?.length ? paper.responsibleStewards.join(", ") : <span className="text-zinc-600 italic">Not provided</span>}
                      </div>
                      <div className="text-[11px] text-zinc-600 mt-1">
                        Ensures there is an accountable party for corrections and appeals (tool-neutral; not a judgment of AI contributions).
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-zinc-400 mb-3">Contributor Roles (CRediT-style)</h4>
                  {paper.contributorRoles && contributorRows.length ? (
                    <div className="border border-zinc-800">
                      <div className="grid grid-cols-3 bg-zinc-900/50 p-2 text-xs font-mono text-zinc-500 border-b border-zinc-800">
                        <div>ROLE</div>
                        <div className="col-span-2">CONTRIBUTORS</div>
                      </div>
                      {contributorRows.map((row) => (
                        <div key={row.role} className="grid grid-cols-3 p-2 text-xs text-zinc-300 border-b border-zinc-800/50 last:border-0">
                          <div className="font-semibold text-zinc-400">{row.role}</div>
                          <div className="col-span-2">{row.contributors.join(", ")}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-600 italic">
                      No contributor role mapping provided for this record.
                    </div>
                  )}
                </div>

                {paper.nonHumanContributors?.length ? (
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-400 mb-3">Non-human Contributors</h4>
                    <div className="space-y-3">
                      {paper.nonHumanContributors.map((c, idx) => (
                        <div key={`${c.name}-${idx}`} className="border border-zinc-800 bg-black/20 p-3">
                          <div className="text-sm font-semibold text-zinc-200">{c.name}</div>
                          <div className="text-xs text-zinc-500 mt-1 space-y-1">
                            {c.versionOrId ? <div>Version/ID: {c.versionOrId}</div> : null}
                            {c.scope ? <div>Scope: {c.scope}</div> : null}
                            {c.promptStrategy ? <div>Prompt/Params: {c.promptStrategy}</div> : null}
                            {c.validationSummary ? <div>Validation: {c.validationSummary}</div> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
             </TabsContent>

             <TabsContent value="audit" className="pt-6">
               <AuditReportPanel
                 paper={paper}
                 evidencePointers={evidencePointers}
                 claimEvidence={claimEvidence}
                 assumptionLedger={assumptionLedger}
                 priorWork={priorWork}
               />
             </TabsContent>

             <TabsContent value="epistemic" className="pt-6">
               <EpistemicReviewPanel paper={paper} evidencePointers={evidencePointers} claimEvidence={claimEvidence} />
             </TabsContent>

             <TabsContent value="defense" className="pt-6">
               <SteelmanDefensePanel paper={paper} evidencePointers={evidencePointers} />
             </TabsContent>

             <TabsContent value="verify" className="pt-6">
               <VerificationWorkOrdersPanel paper={paper} evidencePointers={evidencePointers} claimEvidence={claimEvidence} />
             </TabsContent>

              <TabsContent value="versions" className="pt-6">
                <div className="relative border-l border-zinc-800 ml-3 space-y-6 pb-2">
                  {paper.versions.map((v, i) => {
                    const active = selectedVersion === v.version;
                    return (
                      <div
                        key={i}
                        className={
                          "pl-6 relative border border-transparent p-2 -ml-2 " +
                          (active ? "bg-emerald-500/5 border-emerald-500/20" : "")
                        }
                      >
                        <div
                          className={
                            "absolute -left-[5px] top-3 w-2.5 h-2.5 bg-zinc-950 border rounded-none transform rotate-45 " +
                            (active ? "border-emerald-500" : "border-zinc-700")
                          }
                        />
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-sm font-bold text-emerald-400 block">{v.version}</span>
                            <span className="text-xs text-zinc-500 font-mono">{v.date}</span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={"h-6 text-xs " + (active ? "text-emerald-400" : "")}
                            onClick={() => setSelectedVersion(v.version)}
                          >
                            View
                          </Button>
                        </div>
                        <p className="text-sm text-zinc-300 mt-1">{v.note}</p>
                      </div>
                    );
                  })}
               </div>
              </TabsContent>

            <TabsContent value="comments" className="pt-6 space-y-6">
              <div className="border border-zinc-800 bg-zinc-900/30 p-4">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <h4 className="text-sm font-semibold text-zinc-300">Comments (discussion)</h4>
                  {commentActorRole === "editor" && queuedCommentCount > 0 ? (
                    <Badge variant="amber" className="h-5 px-2 text-[10px] font-mono">
                      QUEUE {queuedCommentCount}
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-zinc-600">
                  Purpose: questions, suggestions, references, concerns, counterexamples (not used as hard evidence for Level upgrades). / 目的：提问、建议、引用文献、疑虑、反例（不作为 Level 升级的硬依据）。
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-6 gap-3 items-start">
                  <div className="md:col-span-2 space-y-2">
                    <div className="text-xs font-mono text-zinc-500">POST_AS</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={commentActorRole}
                        onChange={(e) => {
                          const role = e.target.value as CommentAuthorRole;
                          setCommentActorRole(role);
                          if (role === "editor") setCommentActorName("Omega Editor");
                          else if (role === "author") setCommentActorName(commentAuthorOptions[0] || "Author");
                          else setCommentActorName("You");
                        }}
                        className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="community">Community</option>
                        <option value="author">Author</option>
                        <option value="editor">Editor</option>
                      </select>

                      {commentActorRole === "author" ? (
                        <select
                          value={commentActorName}
                          onChange={(e) => setCommentActorName(e.target.value)}
                          className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                        >
                          {(commentAuthorOptions.length ? commentAuthorOptions : ["Author"]).map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={commentActorRole === "editor" ? "Omega Editor" : commentActorName}
                          onChange={(e) => setCommentActorName(e.target.value)}
                          disabled={commentActorRole === "editor"}
                          className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                          placeholder="Display name"
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={commentActorRole === "community" ? tierFor(commentActorName) : "established"}
                        onChange={(e) => setTierFor(commentActorName, e.target.value as AccountTier)}
                        disabled={commentActorRole !== "community" || !commentActorName.trim()}
                        className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                      >
                        <option value="new">{formatAccountTier("new")}</option>
                        <option value="established">{formatAccountTier("established")}</option>
                        <option value="high_reputation">{formatAccountTier("high_reputation")}</option>
                        <option value="reviewer">{formatAccountTier("reviewer")}</option>
                      </select>
                      <div className="text-[11px] text-zinc-600 flex items-center">
                        ACCOUNT_TIER (community only)
                      </div>
                    </div>
                    <div className="text-[11px] text-zinc-600">
                      New account comments are queued; established accounts publish instantly; high-rep can help mark spam/merge duplicates; reviewer can publish structured reviews. / 新账号评论进入队列；已建立账号实时发布；高信誉可协助标记垃圾/合并重复；审稿人可发布结构化评审。
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <div className="text-xs font-mono text-zinc-500">TYPE (required)</div>
                    <select
                      value={commentKind}
                      onChange={(e) => setCommentKind(e.target.value as CommentKind)}
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="question">Question</option>
                      <option value="suggestion">Suggestion</option>
                      <option value="reference">Reference</option>
                      <option value="concern">Concern</option>
                      <option value="counterexample">Counterexample</option>
                    </select>
                    <div className="text-[11px] text-zinc-600">
                      Suggestions should cite a claim (C1) or a paragraph anchor. / 建议类评论应引用主张编号（C1）或段落锚点。
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <div className="text-xs font-mono text-zinc-500">
                      TARGET_REF{" "}
                      {commentKind === "suggestion" || commentKind === "concern" || commentKind === "counterexample" ? "(required)" : "(recommended)"}
                    </div>
                    <input
                      value={commentTargetRef}
                      onChange={(e) => setCommentTargetRef(e.target.value)}
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                      placeholder="e.g., C1, C2, #p3, §2.1"
                    />
                    <div className="text-[11px] text-zinc-600">
                      Allowed: C1-style claim ids or any paragraph/section anchor. / 允许：C1 主张编号或任意段落/小节锚点。
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="text-xs font-mono text-zinc-500">COMMENT</div>
                  <textarea
                    className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[96px] focus:outline-none focus:border-emerald-500"
                    placeholder="Write a question, suggestion, reference, concern, or counterexample..."
                    value={commentDraft}
                    onChange={(e) => {
                      setCommentDraft(e.target.value);
                      if (commentError) setCommentError(null);
                    }}
                  />
                </div>

                {commentError ? <div className="mt-3 text-xs text-red-300 font-mono">{commentError}</div> : null}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mt-3">
                    <div className="text-xs text-zinc-600">
                      Moderation stance: control noise, not dissent. / 治理立场：控制噪音，不控制反对意见。
                      High-quality comments can be marked Resolved/Incorporated; low-quality (non-violating) comments are soft-hidden (folded), not deleted. / 高质量评论可标记为 Resolved / Incorporated；低质量但不违规的评论会被折叠（soft hide），而不是删除。
                    </div>
                    <Button type="button" size="sm" variant="outline" className="border-zinc-700" onClick={() => void postComment()} disabled={!commentDraft.trim()}>
                      Post Comment
                    </Button>
                  </div>
              </div>

              {visibleComments.length > 0 ? (
                visibleComments.map((comment) => {
                  const status: CommentStatus = comment.status || "open";
                  const softHidden = Boolean(comment.softHidden);
                  const expanded = commentExpandedById[comment.id] || !softHidden;
                  const needsTargetRef = comment.kind === "suggestion" || comment.kind === "concern" || comment.kind === "counterexample";
                  const missingTargetRef = needsTargetRef && !comment.targetRef;
                  const evidenceRequests = evidenceRequestCountByTargetId[comment.id] || 0;
                  const sanction = getActiveSanctionForActor(actorSanctions, comment.author);
                  const visibility = comment.visibility || "published";
                  const queued = visibility === "queued";
                  const removed = Boolean(comment.removed);
                  const mergedIntoId = (comment.mergedIntoId || "").trim() || null;

                  return (
                    <div key={comment.id} className="border border-zinc-800 bg-zinc-950 p-4">
                      <div className="flex justify-between items-center mb-2 gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-zinc-200 text-sm">{comment.author}</span>
                          <Badge variant="muted" className="h-5 px-2 text-[10px] font-mono">
                            {comment.kind.toUpperCase()}
                          </Badge>
                          {comment.authorRole === "author" ? (
                            <Badge variant="emerald" className="h-5 px-2 text-[10px] font-mono">
                              AUTHOR
                            </Badge>
                          ) : comment.authorRole === "editor" ? (
                            <Badge variant="outline" className="h-5 px-2 text-[10px] font-mono border-zinc-700 text-zinc-300">
                              EDITOR
                            </Badge>
                          ) : null}
                          {status === "resolved" ? (
                            <Badge variant="outline" className="h-5 px-2 text-[10px] font-mono border-emerald-900 text-emerald-400">
                              RESOLVED
                            </Badge>
                          ) : status === "incorporated" ? (
                            <Badge variant="emerald" className="h-5 px-2 text-[10px] font-mono">
                              INCORPORATED
                            </Badge>
                          ) : null}
                          {softHidden ? (
                            <Badge variant="muted" className="h-5 px-2 text-[10px] font-mono">
                              SOFT_HIDDEN
                            </Badge>
                          ) : null}
                          {queued ? (
                            <Badge variant="amber" className="h-5 px-2 text-[10px] font-mono">
                              QUEUED
                            </Badge>
                          ) : null}
                          {removed ? (
                            <Badge variant="destructive" className="h-5 px-2 text-[10px] font-mono">
                              REMOVED
                            </Badge>
                          ) : null}
                          {mergedIntoId ? (
                            <Badge variant="muted" className="h-5 px-2 text-[10px] font-mono">
                              DUPLICATE_OF {mergedIntoId}
                            </Badge>
                          ) : null}
                          {evidenceRequests > 0 ? (
                            <Badge variant="amber" className="h-5 px-2 text-[10px] font-mono">
                              REQ_EVIDENCE {evidenceRequests}
                            </Badge>
                          ) : null}
                          {sanction ? (
                            <Badge variant={sanction.kind === "temporary_ban" ? "destructive" : "amber"} className="h-5 px-2 text-[10px] font-mono">
                              {sanction.kind === "temporary_ban" ? "TEMP_BAN" : "RATE_LIMIT"}
                            </Badge>
                          ) : null}
                          {comment.targetRef ? (
                            <Badge variant="outline" className="h-5 px-2 text-[10px] font-mono border-zinc-700 text-zinc-400">
                              @{comment.targetRef}
                            </Badge>
                          ) : null}
                        </div>
                        <span className="text-xs text-zinc-600 font-mono">{comment.createdAt}</span>
                      </div>

                      {missingTargetRef && !removed && !mergedIntoId ? (
                        <div className="text-xs text-amber-400 font-mono mb-2">
                          TARGET_REF_MISSING (recommend citing C1 or a paragraph anchor) / 缺少引用（建议引用 C1 或段落锚点）
                        </div>
                      ) : null}

                      {removed ? (
                        <div className="text-xs text-zinc-600 italic">
                          Removed by moderation. Metadata is retained for auditability. See Governance tab for action + reason. / 已移除：为可审计保留元数据，请在 Governance 查看“动作 + 理由”。
                        </div>
                      ) : mergedIntoId ? (
                        <div className="text-xs text-zinc-600 italic">
                          Marked as duplicate and merged into <span className="font-mono text-zinc-400">{mergedIntoId}</span>. / 已合并为重复，并归并到{" "}
                          <span className="font-mono text-zinc-400">{mergedIntoId}</span>。
                        </div>
                      ) : softHidden && !expanded ? (
                        <div className="text-xs text-zinc-600 italic">
                          Folded (soft hide). Kept for transparency, collapsed to protect discussion quality. / 已折叠（soft hide）：为保持透明而保留，但为保护讨论质量而收起。
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {queued ? (
                            <div className="text-xs text-amber-300 font-mono">
                              QUEUED_FOR_MODERATION (visible to you + editors only) / 已进队列（仅你与编辑可见）
                            </div>
                          ) : null}
                          <div className="text-sm text-zinc-300 whitespace-pre-line">{comment.body}</div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {softHidden && !removed && !mergedIntoId ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-zinc-500 hover:text-white"
                            onClick={() => toggleCommentExpanded(comment.id)}
                          >
                            {expanded ? "Collapse" : "Expand"}
                          </Button>
                        ) : null}

                        {!queued && !removed && !mergedIntoId ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-zinc-500 hover:text-white"
                            onClick={() => toggleReply(comment.id)}
                          >
                            Reply
                          </Button>
                        ) : null}

                        {queued && commentActorRole === "editor" && !removed ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-zinc-500 hover:text-emerald-400"
                              onClick={() => approveQueuedComment(comment.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-zinc-500 hover:text-red-300"
                              onClick={() => removeComment(comment.id)}
                            >
                              Remove
                            </Button>
                          </>
                        ) : null}

                        {canAssistModeration && !queued && !removed && !mergedIntoId ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-zinc-500 hover:text-amber-300"
                              onClick={() => setCommentSoftHidden(comment.id, true, { defaultReasonCode: "spam" })}
                            >
                              Mark Spam
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-zinc-500 hover:text-white"
                              onClick={() => mergeDuplicateComment(comment.id)}
                            >
                              Merge Duplicate
                            </Button>
                          </>
                        ) : null}

                        {canRequestEvidence && !queued && !removed && !mergedIntoId ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-zinc-500 hover:text-amber-300"
                            onClick={() => requestEvidenceForComment(comment)}
                          >
                            Request Evidence
                          </Button>
                        ) : null}

                        {canModerateComments && !queued && !removed && !mergedIntoId ? (
                          <>
                            {status === "open" ? (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] text-zinc-500 hover:text-emerald-400"
                                  onClick={() => setCommentStatus(comment.id, "resolved")}
                                >
                                  Mark Resolved
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] text-zinc-500 hover:text-emerald-400"
                                  onClick={() => setCommentStatus(comment.id, "incorporated")}
                                >
                                  Mark Incorporated
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] text-zinc-500 hover:text-white"
                                onClick={() => setCommentStatus(comment.id, "open")}
                              >
                                Reopen
                              </Button>
                            )}

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-zinc-500 hover:text-white"
                              onClick={() => setCommentSoftHidden(comment.id, !softHidden)}
                            >
                              {softHidden ? "Unfold" : "Soft Hide"}
                            </Button>

                            {commentActorRole === "editor" ? (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] text-zinc-500 hover:text-red-300"
                                  onClick={() => removeComment(comment.id)}
                                >
                                  Remove
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] text-zinc-500 hover:text-amber-300"
                                  onClick={() => issueActorSanction({ targetName: comment.author, kind: "rate_limit", issuedBy: commentActorName || "Omega Editor" })}
                                >
                                  Rate Limit
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] text-zinc-500 hover:text-red-300"
                                  onClick={() => issueActorSanction({ targetName: comment.author, kind: "temporary_ban", issuedBy: commentActorName || "Omega Editor" })}
                                >
                                  Temp Ban
                                </Button>
                              </>
                            ) : null}
                          </>
                        ) : null}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-zinc-500 hover:text-white"
                          onClick={() => void citeComment(comment)}
                        >
                          Cite
                        </Button>
                      </div>

                      {!queued && !removed && !mergedIntoId && expanded && comment.replies?.length ? (
                        <div className="mt-3 border-t border-zinc-800 pt-3 space-y-3">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="border border-zinc-800 bg-black/20 p-3">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                  <div className="text-xs font-bold text-zinc-200">{reply.author}</div>
                                  {reply.authorRole === "author" ? (
                                    <Badge variant="emerald" className="h-5 px-2 text-[10px] font-mono">
                                      AUTHOR
                                    </Badge>
                                  ) : reply.authorRole === "editor" ? (
                                    <Badge variant="outline" className="h-5 px-2 text-[10px] font-mono border-zinc-700 text-zinc-300">
                                      EDITOR
                                    </Badge>
                                  ) : null}
                                </div>
                                <div className="text-xs text-zinc-600 font-mono">{reply.createdAt}</div>
                              </div>
                              <div className="text-sm text-zinc-300 whitespace-pre-line">{reply.body}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {!queued && !removed && !mergedIntoId && commentReplyOpenById[comment.id] ? (
                        <div className="mt-3 border-t border-zinc-800 pt-3">
                          <div className="text-xs font-mono text-zinc-500 mb-2">REPLY</div>
                          <textarea
                            className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[72px] focus:outline-none focus:border-emerald-500"
                            placeholder="Write a reply (authors replying will be tagged automatically when posting as Author)..."
                            value={commentReplyDraftById[comment.id] || ""}
                            onChange={(e) => {
                              setCommentReplyDraftById((prev) => ({ ...prev, [comment.id]: e.target.value }));
                              if (commentReplyErrorById[comment.id]) {
                                setCommentReplyErrorById((prev) => ({ ...prev, [comment.id]: "" }));
                              }
                            }}
                          />
                          {commentReplyErrorById[comment.id] ? (
                            <div className="mt-2 text-xs text-red-300 font-mono">{commentReplyErrorById[comment.id]}</div>
                          ) : null}
                          <div className="flex justify-end mt-2 gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-zinc-700"
                              onClick={() => postReply(comment.id)}
                              disabled={!((commentReplyDraftById[comment.id] || "").trim())}
                            >
                              Post Reply
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-zinc-600 italic">No comments yet. Ask the first question.</div>
              )}
            </TabsContent>

            <TabsContent value="reviews" className="pt-6 space-y-6">
              {/* Review Template Composer (Plan §6.3) */}
              <div className="bg-zinc-900/30 border border-zinc-800 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-zinc-300">{reviewMode === "import" ? "Import External Review (Curation)" : "Post a Review"}</h4>
                    <div className="text-[11px] text-zinc-600">
                      {reviewMode === "import"
                        ? "Link-over-copy by default. Attribute source + original reviewer + AI system creator (if applicable)."
                        : "Structured, citeable reviews can support Level upgrades."}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={reviewMode === "write" ? "emerald" : "outline"}
                      className={reviewMode === "write" ? "" : "border-zinc-700"}
                      onClick={() => {
                        setReviewMode("write");
                        if (reviewError) setReviewError(null);
                      }}
                    >
                      Write
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={reviewMode === "import" ? "emerald" : "outline"}
                      className={reviewMode === "import" ? "" : "border-zinc-700"}
                      onClick={() => {
                        setReviewMode("import");
                        if (reviewError) setReviewError(null);
                      }}
                    >
                      Import
                    </Button>
                    <Badge variant="muted" className="font-mono text-[10px]">
                      {reviewMode === "import" ? "CURATION_IMPORT_V1" : "REVIEW_TEMPLATE_V1"}
                    </Badge>
                  </div>
                </div>

                <div className="text-xs text-zinc-600">
                  Reviews are structured, citeable objects (hash + timestamp) and can support Level upgrades. Avoid Accept/Reject; use “Eligible for Level 2 after …”.
                  / 评审是结构化、可引用对象（哈希 + 时间戳），可用于 Level 升级；不建议 Accept/Reject，建议用“Eligible for Level 2 after …”。
                </div>

                {reviewMode === "import" ? (
                  <div className="text-xs text-zinc-600">
                    Curation boundary: link-over-copy by default; quote only when licensed/authorized; imports are de-duped by source URL + hash to reduce spam.
                    / 策展边界：默认只存链接；摘录需许可证/授权；按来源 URL + 哈希 去重以降低刷量风险。
                  </div>
                ) : null}

                {reviewMode === "import" ? (
                  <div className="space-y-4 border border-zinc-800 bg-black/20 p-3">
                    <div className="text-xs font-mono text-emerald-500">CURATION_METADATA</div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-600">CURATOR</div>
                        <input
                          className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                          placeholder="Your name / handle"
                          value={importCurator}
                          onChange={(e) => {
                            setImportCurator(e.target.value);
                            if (reviewError) setReviewError(null);
                          }}
                        />
                        <div className="text-[11px] text-zinc-600">Curator earns curation credit (structuring + claim mapping).</div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-600">COI_STATEMENT</div>
                        <input
                          className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                          placeholder="None"
                          value={reviewCoi}
                          onChange={(e) => {
                            setReviewCoi(e.target.value);
                            if (reviewError) setReviewError(null);
                          }}
                        />
                        <div className="text-[11px] text-zinc-600">Write “None” if no conflicts.</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-600">SOURCE_URL</div>
                        <input
                          className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                          placeholder="https://..."
                          value={importSourceUrl}
                          onChange={(e) => {
                            setImportSourceUrl(e.target.value);
                            if (reviewError) setReviewError(null);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-600">PLATFORM</div>
                        <select
                          className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                          value={importSourcePlatform}
                          onChange={(e) => {
                            setImportSourcePlatform(e.target.value);
                            if (reviewError) setReviewError(null);
                          }}
                        >
                          <option value="blog">Blog</option>
                          <option value="pubpeer">PubPeer</option>
                          <option value="github">GitHub</option>
                          <option value="social">Social</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-600">SOURCE_ACCESS</div>
                        <select
                          className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                          value={importSourceAccess}
                          onChange={(e) => {
                            setImportSourceAccess(e.target.value as ExternalReviewSourceAccess);
                            if (reviewError) setReviewError(null);
                          }}
                        >
                          <option value="public_url">public_url</option>
                          <option value="token_gated">token_gated</option>
                          <option value="screenshot_only">screenshot_only</option>
                          <option value="export">export</option>
                        </select>
                        <div className="text-[11px] text-zinc-600">When set to screenshot_only/export, add evidence attachments (redacted).</div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-600">SOURCE_TYPE</div>
                        <select
                          className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                          value={importSourceType}
                          onChange={(e) => {
                            setImportSourceType(e.target.value as ExternalReviewSourceType);
                            if (reviewError) setReviewError(null);
                          }}
                        >
                          <option value="human">human</option>
                          <option value="ai_system">ai_system</option>
                          <option value="mixed">mixed</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-600">REVIEW_GENERATOR</div>
                        <input
                          className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                          placeholder="Human handle or system name (or Unknown)"
                          value={importOriginalAuthor}
                          onChange={(e) => {
                            setImportOriginalAuthor(e.target.value);
                            if (reviewError) setReviewError(null);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-600">ORIGINAL_TIMESTAMP (optional)</div>
                        <input
                          className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                          placeholder="YYYY-MM-DD / ISO"
                          value={importOriginalCreatedAt}
                          onChange={(e) => {
                            setImportOriginalCreatedAt(e.target.value);
                            if (reviewError) setReviewError(null);
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-600">PERMISSION</div>
                        <select
                          className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                          value={importPermission}
                          onChange={(e) => {
                            setImportPermission(e.target.value as "link_only" | "licensed" | "authorized");
                            if (reviewError) setReviewError(null);
                          }}
                        >
                          <option value="link_only">Link only (default)</option>
                          <option value="licensed">Licensed (e.g., CC-BY)</option>
                          <option value="authorized">Explicit permission</option>
                        </select>
                        <div className="text-[11px] text-zinc-600">Default policy: link-over-copy. Do not paste full text.</div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-600">LICENSE (required if Licensed)</div>
                        <input
                          className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                          placeholder="CC-BY-4.0 / CC0 / ..."
                          value={importLicense}
                          onChange={(e) => {
                            setImportLicense(e.target.value);
                            if (reviewError) setReviewError(null);
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-600">AI_SYSTEM_NAME (optional)</div>
                        <input
                          className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                          placeholder="e.g., Agentic Reviewer"
                          value={importSystemName}
                          onChange={(e) => {
                            setImportSystemName(e.target.value);
                            if (reviewError) setReviewError(null);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-600">SYSTEM_CREATORS (comma-separated; required if system name)</div>
                        <input
                          className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                          placeholder="Person / org maintaining the system (or Unknown)"
                          value={importSystemCreators}
                          onChange={(e) => {
                            setImportSystemCreators(e.target.value);
                            if (reviewError) setReviewError(null);
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-zinc-600">SOURCE_DISCLAIMER (optional)</div>
                      <textarea
                        className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[70px] focus:outline-none focus:border-emerald-500"
                        placeholder="Short summary of the original system’s disclaimer / caveats (if any)."
                        value={importSourceDisclaimer}
                        onChange={(e) => {
                          setImportSourceDisclaimer(e.target.value);
                          if (reviewError) setReviewError(null);
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-zinc-600">CURATOR_ROLES</div>
                      <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-not-allowed select-none opacity-70">
                          <input type="checkbox" className="accent-emerald-500" checked disabled />
                          curation
                        </label>
                        {(["normalization", "translation", "claim-mapping", "citation-check"] as ExternalReviewCuratorRole[]).map((role) => (
                          <label key={role} className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="accent-emerald-500"
                              checked={importCuratorRoles.includes(role)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setImportCuratorRoles((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.add(role);
                                  else next.delete(role);
                                  next.add("curation");
                                  return Array.from(next.values());
                                });
                                if (reviewError) setReviewError(null);
                              }}
                            />
                            {role}
                          </label>
                        ))}
                      </div>
                      <div className="text-[11px] text-zinc-600">Select what you actually did during curation (claim mapping is recommended).</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-600">CURATOR_SIGNATURE (required when attesting)</div>
                        <input
                          className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                          placeholder="Type your name/handle to sign"
                          value={importCuratorSignature}
                          onChange={(e) => {
                            setImportCuratorSignature(e.target.value);
                            if (reviewError) setReviewError(null);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-600">EVIDENCE_ATTACHMENTS (required if screenshot_only/export)</div>
                        <textarea
                          className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[70px] focus:outline-none focus:border-emerald-500"
                          placeholder="screenshot | redacted screenshot #1 | https://...\nexport | reviewer-export.json | https://...\nlink | context | https://...\nother | note | redacted screenshot stored offline"
                          value={importEvidenceAttachments}
                          onChange={(e) => {
                            setImportEvidenceAttachments(e.target.value);
                            if (reviewError) setReviewError(null);
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-zinc-600">MAPPED_TARGETS (claims or anchors; optional)</div>
                      <input
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                        placeholder="C1, #p3, §2.1"
                        value={importMappedClaims}
                        onChange={(e) => {
                          setImportMappedClaims(e.target.value);
                          if (reviewError) setReviewError(null);
                        }}
                      />
                      <div className="text-[11px] text-zinc-600">
                        Map the critique to claim ids or paragraph anchors so discussion can converge (unlocks claim-mapping bonus).
                      </div>
                    </div>

                    <div className="border border-zinc-800 bg-black/30 p-3 space-y-1">
                      <div className="text-[10px] font-mono text-zinc-500">CREDIT_PREVIEW</div>
                      <div className="text-[11px] text-zinc-600">
                        Review generator: <span className="text-zinc-400">{importOriginalAuthor.trim() || (importSourceType === "ai_system" ? importSystemName.trim() : "") || "Unknown"}</span>
                      </div>
                      <div className="text-[11px] text-zinc-600">
                        Curator: <span className="text-zinc-400">{importCurator.trim() || "You"}</span>
                      </div>
                      <div className="text-[11px] text-zinc-600">
                        System creators:{" "}
                        <span className="text-zinc-400">
                          {importSystemName.trim()
                            ? importSystemCreators.trim() || "(missing — add to credit the system builder)"
                            : "N/A"}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-700">Key point: system creators get tooling credit, not this review’s author credit.</div>
                      <div className="text-[11px] text-zinc-700">
                        Reward/credit settles in layers: base only after approval; bonuses require normalization + mapping + community validation (helpful + addressed + high-signal).
                      </div>
                    </div>

                    <label className="flex items-start gap-2 text-xs text-zinc-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="accent-emerald-500 mt-0.5"
                        checked={importAttest}
                        onChange={(e) => {
                          setImportAttest(e.target.checked);
                          if (reviewError) setReviewError(null);
                      }}
                    />
                      <span className="whitespace-pre-line">{DEFAULT_EXTERNAL_REVIEW_ATTESTATION}</span>
                    </label>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-zinc-600">REVIEWER</div>
                      <input
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                        placeholder="Your name / handle"
                        value={reviewerName}
                        onChange={(e) => setReviewerName(e.target.value)}
                        disabled={reviewAnonymous}
                      />
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="accent-emerald-500"
                            checked={reviewAnonymous}
                            onChange={(e) => {
                              setReviewAnonymous(e.target.checked);
                              if (e.target.checked) setReviewVerified(false);
                            }}
                          />
                          Post anonymously
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="accent-emerald-500"
                            checked={reviewVerified}
                            onChange={(e) => setReviewVerified(e.target.checked)}
                            disabled={reviewAnonymous}
                          />
                          Identity verified
                        </label>
                      </div>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                        <div className="space-y-1">
                          <div className="text-[10px] font-mono text-zinc-600">ACCOUNT_TIER (demo)</div>
                          <select
                            value={tierFor(reviewerName.trim() || "You")}
                            onChange={(e) => setTierFor(reviewerName.trim() || "You", e.target.value as AccountTier)}
                            className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                          >
                            <option value="new">{formatAccountTier("new")}</option>
                            <option value="established">{formatAccountTier("established")}</option>
                            <option value="high_reputation">{formatAccountTier("high_reputation")}</option>
                            <option value="reviewer">{formatAccountTier("reviewer")}</option>
                          </select>
                        </div>
                        <div className="text-[11px] text-zinc-600 sm:pt-5">
                          Only <span className="text-zinc-300">Reviewer</span> tier can post structured reviews (Plan §9.2). Anonymous posting still uses your handle for permission (demo).
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-zinc-600">COI_STATEMENT</div>
                      <input
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                        placeholder="None"
                        value={reviewCoi}
                        onChange={(e) => setReviewCoi(e.target.value)}
                      />
                      <div className="text-[11px] text-zinc-600">Write “None” if no conflicts.</div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-zinc-600">{reviewMode === "import" ? "SUMMARY" : "SUMMARY_OF_CONTRIBUTION"}</div>
                  <textarea
                    className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[70px] focus:outline-none focus:border-emerald-500"
                    placeholder={reviewMode === "import" ? "Summarize the external review (2–5 sentences)" : "What is the paper claiming / contributing? (2–5 sentences)"}
                    value={reviewSummary}
                    onChange={(e) => {
                      setReviewSummary(e.target.value);
                      if (reviewError) setReviewError(null);
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono text-zinc-600">MAJOR_STRENGTHS (one per line)</div>
                    <textarea
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[90px] focus:outline-none focus:border-emerald-500"
                      placeholder="- Clear claim list\n- Strong evidence linkage\n- Reproducible code"
                      value={reviewStrengths}
                      onChange={(e) => {
                        setReviewStrengths(e.target.value);
                        if (reviewError) setReviewError(null);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono text-zinc-600">{reviewMode === "import" ? "WEAKNESSES (one per line)" : "MAJOR_CONCERNS (one per line)"}</div>
                    <textarea
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[90px] focus:outline-none focus:border-emerald-500"
                      placeholder="- Missing falsifiability thresholds\n- Evidence does not support C2"
                      value={reviewConcerns}
                      onChange={(e) => {
                        setReviewConcerns(e.target.value);
                        if (reviewError) setReviewError(null);
                      }}
                    />
                  </div>
                </div>

                {reviewMode === "write" ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-zinc-600">FALSIFIABILITY_ASSESSMENT</div>
                      <textarea
                        className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[90px] focus:outline-none focus:border-emerald-500"
                        placeholder="Are claims falsifiable? What would disprove them? Are tests specified?"
                        value={reviewFalsifiability}
                        onChange={(e) => {
                          setReviewFalsifiability(e.target.value);
                          if (reviewError) setReviewError(null);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-zinc-600">TECHNICAL_CORRECTNESS</div>
                      <textarea
                        className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[90px] focus:outline-none focus:border-emerald-500"
                        placeholder="Any proof gaps, leakage risks, statistical issues, or logical errors?"
                        value={reviewTechnical}
                        onChange={(e) => {
                          setReviewTechnical(e.target.value);
                          if (reviewError) setReviewError(null);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-zinc-600">VERIFICATION_READINESS</div>
                      <textarea
                        className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[90px] focus:outline-none focus:border-emerald-500"
                        placeholder="Is it ready for independent re-audit/replication? What’s missing?"
                        value={reviewReadiness}
                        onChange={(e) => {
                          setReviewReadiness(e.target.value);
                          if (reviewError) setReviewError(null);
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono text-zinc-600">DETAILED_COMMENTS (optional)</div>
                    <textarea
                      className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[90px] focus:outline-none focus:border-emerald-500"
                      placeholder="Context, detailed comments, or licensed excerpts (redact sensitive info)."
                      value={importDetailedComments}
                      onChange={(e) => {
                        setImportDetailedComments(e.target.value);
                        if (reviewError) setReviewError(null);
                      }}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-zinc-600">{reviewMode === "import" ? "QUESTIONS (one per line)" : "REQUESTED_CHANGES (one per line)"}</div>
                  <textarea
                    className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[90px] focus:outline-none focus:border-emerald-500"
                    placeholder={
                      reviewMode === "import"
                        ? "- What evidence supports claim C2?\n- Can you share the exact data split?\n- What are the failure modes?"
                        : "- Add claim IDs (C1..Cn) and anchors\n- Provide code hash and environment\n- Clarify falsifiability thresholds\n- None"
                    }
                    value={reviewRequestedChanges}
                    onChange={(e) => {
                      setReviewRequestedChanges(e.target.value);
                      if (reviewError) setReviewError(null);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-zinc-600">{reviewMode === "import" ? "OVERALL_ASSESSMENT" : "RECOMMENDATION"}</div>
                  <textarea
                    className="w-full bg-black border border-zinc-800 p-2 text-sm text-zinc-200 min-h-[80px] focus:outline-none focus:border-emerald-500"
                    placeholder={reviewMode === "import" ? "Overall assessment (as stated by the external reviewer)" : 'Eligible for Level 2 after: (1) ..., (2) ..., (3) ...'}
                    value={reviewRecommendation}
                    onChange={(e) => {
                      setReviewRecommendation(e.target.value);
                      if (reviewError) setReviewError(null);
                    }}
                  />
                </div>

                {reviewError ? <div className="text-xs text-red-300 font-mono">{reviewError}</div> : null}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="emerald"
                    onClick={() => void (reviewMode === "import" ? postExternalArtifact() : postReview())}
                  >
                    {reviewMode === "import" ? "Import Review" : "Post Review"}
                  </Button>
                </div>
              </div>

              {/* External Review Artifacts (Plan §8.1) */}
              <div className="border border-zinc-800 bg-zinc-900/20 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-zinc-300">External Review Artifacts</h4>
                    <div className="text-[11px] text-zinc-600">
                      Imported reviews are first-class artifacts with public source links + attribution, a stable hash, moderation status, and withdrawal/takedown (not normal
                      comments). External reviews never auto-upgrade Levels.
                    </div>
                    <div className="text-[11px] text-zinc-700">
                      Attribution roles: Review Generator (content) • System Creators (tooling) • Curator (import). / 归因说明：评审生成者（内容）• 系统创建者（工具）• 策展者（搬运）。
                    </div>
                    <div className="text-[11px] text-zinc-700">
                      Motivation: external AI reviews can surface issues, but accountability remains with the community/editors; rewards/credits settle only after validation. / 动机：外部 AI
                      审稿可帮助发现问题，但责任仍由社区/编辑承担；奖励/信用按四层贡献点计分：基础导入分（审核通过才给）、结构化整理加分（模板完整填写才给）、主张映射加分（映射到主张编号或段落锚点才给）、社区验证加分（helpful + addressed + high-signal 才给）。
                    </div>
                  </div>
                  <Badge variant="muted" className="font-mono text-[10px]">
                    EXTERNAL_REVIEW_ARTIFACT_V1
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono text-zinc-600">ACTOR</div>
                    {artifactActorRole === "author" ? (
                      <select
                        value={artifactActorName}
                        onChange={(e) => setArtifactActorName(e.target.value)}
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
                      >
                        {(commentAuthorOptions.length ? commentAuthorOptions : ["Author"]).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
                        placeholder="Your name / handle"
                        value={artifactActorRole === "editor" ? "Omega Editor" : artifactActorName}
                        onChange={(e) => setArtifactActorName(e.target.value)}
                        disabled={artifactActorRole === "editor"}
                      />
                    )}
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none">
                        <input
                          type="radio"
                          className="accent-emerald-500"
                          checked={artifactActorRole === "community"}
                          onChange={() => setArtifactActorRole("community")}
                        />
                        Community
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none">
                        <input
                          type="radio"
                          className="accent-emerald-500"
                          checked={artifactActorRole === "curator"}
                          onChange={() => setArtifactActorRole("curator")}
                        />
                        Curator
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none">
                        <input
                          type="radio"
                          className="accent-emerald-500"
                          checked={artifactActorRole === "author"}
                          onChange={() => {
                            setArtifactActorRole("author");
                            if (commentAuthorOptions.length) setArtifactActorName(commentAuthorOptions[0]);
                            else setArtifactActorName("Author");
                          }}
                        />
                        Author (demo)
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none">
                        <input
                          type="radio"
                          className="accent-emerald-500"
                          checked={artifactActorRole === "editor"}
                          onChange={() => {
                            setArtifactActorRole("editor");
                            setArtifactActorName("Omega Editor");
                          }}
                        />
                        Editor (demo)
                      </label>
                    </div>
                    <div className="text-[11px] text-zinc-700">
                      Community can vote Helpful. Authors can mark Addressed. Curators can withdraw their own artifacts. Editors can approve/soft-hide/remove + mark High-signal
                      (demo UI; production uses governance logs).
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-mono text-zinc-600">STATUS_MEANING</div>
                    <ul className="list-disc pl-5 space-y-1 text-[11px] text-zinc-600">
                      <li>
                        <span className="text-amber-400">PENDING</span>: awaiting moderation / verification
                      </li>
                      <li>
                        <span className="text-emerald-400">APPROVED</span>: moderated OK + citeable; Level impact requires verified confirmation or editor high-signal + author response
                      </li>
                      <li>
                        <span className="text-red-300">SOFT_HIDDEN</span>: low-confidence / spam signal; kept for audit but not surfaced by default
                      </li>
                      <li>
                        <span className="text-zinc-500">REMOVED</span>: curator withdrawal or editorial takedown (metadata retained)
                      </li>
                    </ul>
                  </div>
                </div>

                {externalArtifacts.length > 0 ? (
                  <div className="space-y-4">
                    {externalArtifacts.map((a) => {
                      const hash = (a.hash || externalArtifactHashById[a.id] || "").trim();
                      const statusVariant =
                        a.status === "approved" ? "emerald" : a.status === "soft_hidden" ? "destructive" : a.status === "removed" ? "muted" : "amber";
                      const highSignalByRecord = Boolean(a.validation?.highSignal);
                      const highSignalByNote = /(^|\b)(high[-_ ]?signal|high signal)(\b|$)/i.test(`${a.statusReason || ""} ${a.moderation?.note || ""}`.trim());
                      const highSignal = highSignalByRecord || highSignalByNote;
                      const addressed = Boolean(a.validation?.addressed);
                      const helpfulVotes = Array.isArray(a.validation?.helpfulVotes) ? a.validation?.helpfulVotes || [] : [];
                      const helpfulCount = helpfulVotes.length;
                      const evidenceRequests = evidenceRequestCountByTargetId[a.id] || 0;
                      const curatorSanction = getActiveSanctionForActor(actorSanctions, a.curator.userId);
                      const actorForVote = (artifactActorRole === "editor" ? "Omega Editor" : artifactActorName).trim() || "You";
                      const hasVotedHelpful = helpfulVotes.some((v) => (v.by || "").toLowerCase() === actorForVote.toLowerCase());
                      const mappedTargets = a.curator.mappedTargets || a.curator.mappedClaims || [];
                      const normalizationComplete =
                        Boolean((a.content.summary || "").trim()) &&
                        Boolean((a.content.overallAssessment || "").trim()) &&
                        Boolean((a.content.detailedComments || "").trim()) &&
                        !/^not provided\.?$/i.test((a.content.detailedComments || "").trim()) &&
                        (a.content.strengths?.length || 0) > 0 &&
                        (a.content.weaknesses?.length || 0) > 0 &&
                        (a.content.questions?.length || 0) > 0;
                      const baseCredit = a.status === "approved";
                      const claimMappingBonus = mappedTargets.length > 0;
                      const communityValidationBonus = helpfulCount > 0 && addressed && highSignal;
                      const generator =
                        a.source.type === "ai_system"
                          ? a.source.systemName || a.source.originalAuthor || "AI Review Generator"
                          : a.source.type === "mixed"
                            ? [a.source.originalAuthor || "Review Generator", a.source.systemName ? `(via ${a.source.systemName})` : ""].filter(Boolean).join(" ")
                            : a.source.originalAuthor || "Review Generator";
                      const canWithdraw =
                        artifactActorRole === "curator" &&
                        (artifactActorName.trim() || "You").toLowerCase() === a.curator.userId.toLowerCase() &&
                        a.status !== "removed";
                      const canModerate = artifactActorRole === "editor";

                      return (
                        <div key={a.id} className="border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-zinc-200 text-sm">{generator}</span>
                                <Badge variant={statusVariant} className="h-5 px-2 text-[10px] font-mono">
                                  {a.status.toUpperCase()}
                                </Badge>
                                {a.source.systemName ? (
                                  <Badge variant="outline" className="h-5 px-2 text-[10px] font-mono border-zinc-700 text-zinc-300">
                                    AI_SYSTEM: {a.source.systemName}
                                  </Badge>
                                ) : null}
                                <Badge variant="outline" className="h-5 px-2 text-[10px] font-mono border-zinc-800 text-zinc-500">
                                  TYPE: {a.source.type}
                                </Badge>
                                <Badge variant="outline" className="h-5 px-2 text-[10px] font-mono border-zinc-800 text-zinc-500">
                                  ACCESS: {a.source.access}
                                </Badge>
                                {helpfulCount > 0 ? (
                                  <Badge variant="outline" className="h-5 px-2 text-[10px] font-mono border-zinc-800 text-zinc-500">
                                    HELPFUL: {helpfulCount}
                                  </Badge>
                                ) : null}
                                {addressed ? (
                                  <Badge variant="outline" className="h-5 px-2 text-[10px] font-mono border-emerald-900 text-emerald-400">
                                    ADDRESSED
                                  </Badge>
                                ) : null}
                                {highSignal ? (
                                  <Badge variant="outline" className="h-5 px-2 text-[10px] font-mono border-emerald-900 text-emerald-400">
                                    HIGH_SIGNAL
                                  </Badge>
                                ) : null}
                                {evidenceRequests > 0 ? (
                                  <Badge variant="amber" className="h-5 px-2 text-[10px] font-mono">
                                    REQ_EVIDENCE {evidenceRequests}
                                  </Badge>
                                ) : null}
                                {curatorSanction ? (
                                  <Badge variant={curatorSanction.kind === "temporary_ban" ? "destructive" : "amber"} className="h-5 px-2 text-[10px] font-mono">
                                    CURATOR_{curatorSanction.kind === "temporary_ban" ? "TEMP_BAN" : "RATE_LIMIT"}
                                  </Badge>
                                ) : null}
                                {a.curator.coi ? (
                                  <Badge variant="outline" className="h-5 px-2 text-[10px] font-mono border-zinc-800 text-zinc-400">
                                    COI: {(a.curator.coi || "None").trim() || "None"}
                                  </Badge>
                                ) : null}
                              </div>

                              <div className="text-xs font-mono text-zinc-600 break-all">
                                SOURCE:{" "}
                                {a.source.url ? (
                                  <a
                                    href={a.source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-zinc-400 hover:text-emerald-400 underline decoration-dashed"
                                  >
                                    {a.source.url} <ExternalLink className="inline-block ml-1 w-3 h-3" />
                                  </a>
                                ) : (
                                  <span className="text-zinc-500">({a.source.access})</span>
                                )}
                              </div>

                              <div className="text-xs font-mono text-zinc-600">
                                CURATOR: <span className="text-zinc-400">{a.curator.userId}</span>
                                {a.curator.signature ? (
                                  <span className="ml-3">
                                    SIGNED: <span className="text-zinc-400">{a.curator.signature}</span>
                                  </span>
                                ) : null}
                              </div>

                              {a.source.systemCreators?.length ? (
                                <div className="space-y-1">
                                  <div className="text-xs font-mono text-zinc-600">SYSTEM_CREATORS (unclaimed profiles)</div>
                                  <div className="flex flex-wrap gap-2">
                                    {a.source.systemCreators.map((name) => (
                                      <Badge key={name} variant="outline" className="h-5 px-2 text-[10px] font-mono border-zinc-800 text-zinc-500">
                                        UNCLAIMED: {name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {a.curator.roles?.length ? (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {a.curator.roles.map((role) => (
                                    <Badge key={role} variant="outline" className="h-5 px-2 text-[10px] font-mono border-zinc-800 text-zinc-600">
                                      {role}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}

                              <div className="text-xs font-mono text-zinc-600 break-all">
                                HASH: <span className="text-zinc-400">{hash || "PENDING..."}</span>
                              </div>

                              {mappedTargets.length ? (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {mappedTargets.slice(0, 12).map((c) => (
                                    <Badge key={c} variant="outline" className="h-5 px-2 text-[10px] font-mono border-zinc-800 text-zinc-500">
                                      {c}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}

                              <div className="text-[11px] font-mono text-zinc-700 pt-1">
                                REWARD: BASE[{baseCredit ? "ON" : "LOCKED"}] NORM[{normalizationComplete ? "ON" : "LOCKED"}] MAP[{claimMappingBonus ? "ON" : "LOCKED"}]
                                COMMUNITY[{communityValidationBonus ? "ON" : "LOCKED"}]
                              </div>

                              {a.statusReason ? <div className="text-xs text-zinc-600">NOTE: {a.statusReason}</div> : null}
                              {a.withdrawal ? (
                                <div className="text-xs text-zinc-700">
                                  Removed {formatTimestamp(a.withdrawal.withdrawnAt)} by {a.withdrawal.withdrawnBy}
                                  {a.withdrawal.reason ? ` — ${a.withdrawal.reason}` : ""}
                                </div>
                              ) : null}
                            </div>

                            <span className="text-xs text-zinc-600 font-mono">{formatTimestamp(a.createdAt)}</span>
                          </div>

                          <div className="border border-zinc-800 bg-black/20 p-3">
                            <div className="text-[10px] font-mono text-zinc-500 mb-1">SUMMARY (curated)</div>
                            <div className="text-sm text-zinc-300 whitespace-pre-line">{a.content.summary}</div>
                          </div>

                          {a.source.disclaimer ? (
                            <div className="border border-zinc-800 bg-black/20 p-3">
                              <div className="text-[10px] font-mono text-zinc-500 mb-1">SOURCE_DISCLAIMER</div>
                              <div className="text-xs text-zinc-400 whitespace-pre-line">{a.source.disclaimer}</div>
                            </div>
                          ) : null}

                          {a.evidenceAttachments?.length ? (
                            <div className="border border-zinc-800 bg-black/20 p-3">
                              <div className="text-[10px] font-mono text-zinc-500 mb-1">EVIDENCE_ATTACHMENTS</div>
                              <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1">
                                {a.evidenceAttachments.map((att) => (
                                  <li key={att.id}>
                                    <span className="font-mono text-zinc-500 mr-2">{att.kind.toUpperCase()}</span>
                                    <span className="text-zinc-300">{att.label}</span>
                                    {att.url ? (
                                      <a
                                        href={att.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ml-2 text-zinc-400 hover:text-emerald-400 underline decoration-dashed break-all"
                                      >
                                        {att.url} <ExternalLink className="inline-block ml-1 w-3 h-3" />
                                      </a>
                                    ) : att.note ? (
                                      <span className="ml-2 text-zinc-500">{att.note}</span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-emerald-950/10 border-l-2 border-emerald-900 p-2">
                              <span className="text-xs font-bold text-emerald-700 block mb-1">STRENGTHS</span>
                              {a.content.strengths?.length ? (
                                <ul className="list-disc list-inside text-xs text-zinc-400">
                                  {a.content.strengths.map((s, idx) => (
                                    <li key={idx}>{s}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-xs text-zinc-600 italic">Not provided.</div>
                              )}
                            </div>
                            <div className="bg-red-950/10 border-l-2 border-red-900 p-2">
                              <span className="text-xs font-bold text-red-700 block mb-1">WEAKNESSES</span>
                              {a.content.weaknesses?.length ? (
                                <ul className="list-disc list-inside text-xs text-zinc-400">
                                  {a.content.weaknesses.map((s, idx) => (
                                    <li key={idx}>{s}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-xs text-zinc-600 italic">Not provided.</div>
                              )}
                            </div>
                          </div>

                          {a.content.questions?.length ? (
                            <div className="border border-zinc-800 bg-black/20 p-3">
                              <div className="text-[10px] font-mono text-zinc-500 mb-1">QUESTIONS</div>
                              <ul className="list-disc list-inside text-xs text-zinc-400">
                                {a.content.questions.map((s, idx) => (
                                  <li key={idx}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          <div className="border border-zinc-800 bg-black/20 p-3">
                            <div className="text-[10px] font-mono text-zinc-500 mb-1">DETAILED_COMMENTS</div>
                            <div className="text-xs text-zinc-400 whitespace-pre-line">{a.content.detailedComments}</div>
                          </div>

                          <div className="border border-zinc-800 bg-black/20 p-3">
                            <div className="text-[10px] font-mono text-emerald-400 mb-1">OVERALL_ASSESSMENT</div>
                            <div className="text-sm text-zinc-200 whitespace-pre-line">{a.content.overallAssessment}</div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {canModerate ? (
                                <>
                                  <Button type="button" variant="outline" size="sm" className="h-7 border-zinc-700" onClick={() => moderateExternalArtifact(a.id, "approved")}>
                                    Approve
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" className="h-7 border-zinc-700" onClick={() => moderateExternalArtifact(a.id, "soft_hidden")}>
                                    Soft Hide
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" className="h-7 border-zinc-700" onClick={() => moderateExternalArtifact(a.id, "removed")}>
                                    Remove
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" className="h-7 border-zinc-700" onClick={() => requestEvidenceForExternalArtifact(a.id)}>
                                    Request Evidence
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 border-zinc-700"
                                    onClick={() => issueActorSanction({ targetName: a.curator.userId, kind: "rate_limit", issuedBy: artifactActorName.trim() || "Omega Editor" })}
                                  >
                                    Rate limit curator
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 border-zinc-700"
                                    onClick={() => issueActorSanction({ targetName: a.curator.userId, kind: "temporary_ban", issuedBy: artifactActorName.trim() || "Omega Editor" })}
                                  >
                                    Temp ban curator
                                  </Button>
                                  <Button type="button" variant="ghost" size="sm" className="h-7 text-zinc-500 hover:text-white" onClick={() => moderateExternalArtifact(a.id, "pending")}>
                                    Set Pending
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 border-zinc-700"
                                    onClick={() => toggleExternalArtifactHighSignal(a.id)}
                                  >
                                    {highSignalByRecord ? "Clear High-signal" : "Mark High-signal"}
                                  </Button>
                                </>
                              ) : null}
                              {canWithdraw ? (
                                <Button type="button" variant="outline" size="sm" className="h-7 border-zinc-700" onClick={() => withdrawExternalArtifact(a.id)}>
                                  Withdraw
                                </Button>
                              ) : null}
                              {artifactActorRole === "community" ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 border-zinc-700"
                                  onClick={() => toggleExternalArtifactHelpfulVote(a.id)}
                                >
                                  {hasVotedHelpful ? "Unvote Helpful" : "Vote Helpful"}
                                </Button>
                              ) : null}
                              {artifactActorRole === "author" ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 border-zinc-700"
                                  onClick={() => toggleExternalArtifactAddressed(a.id)}
                                >
                                  {addressed ? "Unmark Addressed" : "Mark Addressed"}
                                </Button>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2">
                              <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px] text-zinc-500 hover:text-white" onClick={() => void citeExternalArtifact(a)}>
                                Cite this artifact
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] text-zinc-500 hover:text-white"
                                disabled={!hash}
                                onClick={() => void copyText(hash)}
                              >
                                Copy hash
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-zinc-600 italic">No external review artifacts yet. Use “Import” above to create one.</div>
                )}
              </div>

              {/* Reviews */}
              {mergedReviews.length > 0 ? (
                mergedReviews.map((review) => {
                  const hash = (review.hash || reviewHashById[review.id] || "").trim();
                  const imported = review.origin === "imported";
                  const addressed = Boolean(review.addressed);
                  const who = imported
                    ? (review.source?.originalAuthor || review.author || "External Reviewer")
                    : review.anonymous
                      ? "Anonymous Reviewer"
                      : review.author;
                  const curator = review.curation?.curator;
                  const sourceUrl = review.source?.url;
                  const systemName = review.source?.systemName;
                  const systemCreator = review.source?.systemCreator;
                  const mappedClaims = review.curation?.mappedClaims || [];
                  const canMarkAddressed = artifactActorRole === "author";
                  return (
                    <div key={review.id} className="border border-zinc-800 bg-zinc-950 p-4 space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-200 text-sm">{who}</span>
                            {imported ? (
                              <Badge variant="muted" className="h-5 px-2 text-[10px] font-mono">
                                IMPORTED
                              </Badge>
                            ) : null}
                            {systemName ? (
                              <Badge variant="outline" className="h-5 px-2 text-[10px] font-mono border-zinc-700 text-zinc-300">
                                AI_SYSTEM: {systemName}
                              </Badge>
                            ) : null}
                            {review.verified && !review.anonymous && !imported ? <ShieldCheck className="w-3 h-3 text-emerald-500" /> : null}
                            {review.coi ? (
                              <Badge variant="outline" className="h-5 px-2 text-[10px] font-mono border-zinc-800 text-zinc-400">
                                COI: {(review.coi || "None").trim() || "None"}
                              </Badge>
                            ) : null}
                            {addressed ? (
                              <Badge variant="emerald" className="h-5 px-2 text-[10px] font-mono">
                                ADDRESSED
                              </Badge>
                            ) : null}
                          </div>
                          {imported && sourceUrl ? (
                            <div className="text-xs font-mono text-zinc-600 break-all">
                              SOURCE:{" "}
                              <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-emerald-400 underline decoration-dashed">
                                {sourceUrl} <ExternalLink className="inline-block ml-1 w-3 h-3" />
                              </a>
                            </div>
                          ) : null}
                          {imported && curator ? (
                            <div className="text-xs font-mono text-zinc-600">CURATED_BY: <span className="text-zinc-400">{curator}</span></div>
                          ) : null}
                          {imported && systemCreator ? (
                            <div className="text-xs font-mono text-zinc-600">SYSTEM_CREATOR: <span className="text-zinc-400">{systemCreator}</span></div>
                          ) : null}
                          <div className="text-xs font-mono text-zinc-600 break-all">
                            HASH: <span className="text-zinc-400">{hash || "PENDING..."}</span>
                          </div>
                          {addressed && review.addressed ? (
                            <div className="text-xs font-mono text-zinc-600 break-all">
                              ADDRESSED_BY: <span className="text-zinc-400">{review.addressed.addressedBy}</span> • AT:{" "}
                              <span className="text-zinc-400">{formatTimestamp(review.addressed.addressedAt)}</span>
                              {review.addressed.note ? <span className="text-zinc-500"> • {review.addressed.note}</span> : null}
                            </div>
                          ) : null}
                          {imported && mappedClaims.length ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {mappedClaims.slice(0, 8).map((c) => (
                                <Badge key={c} variant="outline" className="h-5 px-2 text-[10px] font-mono border-zinc-800 text-zinc-500">
                                  {c}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <span className="text-xs text-zinc-600 font-mono">{formatTimestamp(review.createdAt)}</span>
                      </div>

                      <div className="border border-zinc-800 bg-black/20 p-3">
                        <div className="text-[10px] font-mono text-zinc-500 mb-1">SUMMARY</div>
                        <div className="text-sm text-zinc-300 whitespace-pre-line">{review.summary}</div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-emerald-950/10 border-l-2 border-emerald-900 p-2">
                          <span className="text-xs font-bold text-emerald-700 block mb-1">MAJOR STRENGTHS</span>
                          <ul className="list-disc list-inside text-xs text-zinc-400">
                            {(review.strengths || []).map((s, idx) => (
                              <li key={idx}>{s}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-red-950/10 border-l-2 border-red-900 p-2">
                          <span className="text-xs font-bold text-red-700 block mb-1">MAJOR CONCERNS</span>
                          <ul className="list-disc list-inside text-xs text-zinc-400">
                            {(review.concerns || []).map((s, idx) => (
                              <li key={idx}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="border border-zinc-800 bg-black/20 p-3">
                          <div className="text-[10px] font-mono text-zinc-500 mb-1">FALSIFIABILITY</div>
                          <div className="text-xs text-zinc-300 whitespace-pre-line">{review.falsifiabilityAssessment}</div>
                        </div>
                        <div className="border border-zinc-800 bg-black/20 p-3">
                          <div className="text-[10px] font-mono text-zinc-500 mb-1">TECHNICAL</div>
                          <div className="text-xs text-zinc-300 whitespace-pre-line">{review.technicalCorrectnessAssessment}</div>
                        </div>
                        <div className="border border-zinc-800 bg-black/20 p-3">
                          <div className="text-[10px] font-mono text-zinc-500 mb-1">VERIFICATION READINESS</div>
                          <div className="text-xs text-zinc-300 whitespace-pre-line">{review.verificationReadiness}</div>
                        </div>
                      </div>

                      <div className="border border-zinc-800 bg-black/20 p-3">
                        <div className="text-[10px] font-mono text-zinc-500 mb-1">REQUESTED CHANGES</div>
                        <ul className="list-disc list-inside text-xs text-zinc-400">
                          {(review.requestedChanges || []).map((c, idx) => (
                            <li key={idx}>{c}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="border border-zinc-800 bg-emerald-950/10 p-3">
                        <div className="text-[10px] font-mono text-emerald-400 mb-1">RECOMMENDATION</div>
                        <div className="text-sm text-zinc-200 whitespace-pre-line">{review.recommendation}</div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {canMarkAddressed && !imported ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-zinc-500 hover:text-emerald-400"
                              onClick={() => toggleReviewAddressed(review.id)}
                            >
                              {addressed ? "Unmark Addressed" : "Mark Addressed"}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-zinc-500 hover:text-white"
                            onClick={() => void citeReview(review)}
                          >
                            Cite this review
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-zinc-500 hover:text-white"
                          disabled={!hash}
                          onClick={() => void copyText(hash)}
                        >
                          Copy hash
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-zinc-600 italic">No reviews yet. Be the first.</div>
              )}
            </TabsContent>

            <TabsContent value="governance" className="pt-6 space-y-4">
              <div className="border border-zinc-800 bg-black/20 p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-zinc-300">Governance Log</div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 text-zinc-300 hover:border-emerald-500 hover:text-emerald-500"
                      onClick={() => void copyText(JSON.stringify(governanceLog.slice(0, 200), null, 2))}
                      disabled={governanceLog.length === 0}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy JSON
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-zinc-600 font-mono leading-relaxed">
                  Traceability rule (Plan §9.1): any fold/remove/status change must have an action + reason + actor + timestamp record.
                  <br />
                  Demo storage: <span className="text-zinc-500">{'localStorage["omega_governance_log_v1:<paperId>"]'}</span>
                </div>
              </div>

              {governanceLog.length ? (
                <div className="space-y-2">
                  {governanceLog.slice(0, 120).map((entry) => (
                    <div key={entry.id} className="border border-zinc-800 bg-zinc-950/40 p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-500">
                        <Badge variant="muted" className="h-5 px-2 text-[10px]">
                          {entry.target.type.toUpperCase()}
                        </Badge>
                        {entry.moderationAction ? (
                          <Badge variant="amber" className="h-5 px-2 text-[10px]">
                            {formatGovernanceModerationAction(entry.moderationAction)}
                          </Badge>
                        ) : null}
                        {entry.reasonCode ? (
                          <Badge variant="outline" className="h-5 px-2 text-[10px] border-zinc-800 text-zinc-500">
                            {formatGovernanceReason(entry.reasonCode)}
                          </Badge>
                        ) : null}
                        <span className="text-zinc-400">{entry.action}</span>
                        <span>•</span>
                        <span>{formatTimestamp(entry.createdAt)}</span>
                        <span>•</span>
                        <span>
                          {entry.actor.name} <span className="text-zinc-600">({entry.actor.role})</span>
                        </span>
                        <span className="text-zinc-700">•</span>
                        <span className="text-zinc-600">TARGET: {entry.target.id}</span>
                      </div>
                      {entry.reason ? <div className="text-sm text-zinc-300">{entry.reason}</div> : null}
                      {entry.meta ? (
                        <div className="text-xs font-mono text-zinc-600 break-words">
                          META: {JSON.stringify(entry.meta)}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {governanceLog.length > 120 ? (
                    <div className="text-xs text-zinc-600 italic">Showing latest 120 entries.</div>
                  ) : null}
                </div>
              ) : (
                <div className="border border-zinc-800 bg-black/20 p-4 text-sm text-zinc-600 italic">
                  No governance actions logged for this paper yet.
                </div>
              )}
            </TabsContent>

            <TabsContent value="files" className="pt-6 space-y-4">
              <div className="border border-zinc-800 divide-y divide-zinc-800">
                  <div className="p-3 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-zinc-400" />
                        <span className="text-sm font-mono">manuscript_v1.2.pdf</span>
                     </div>
                    {sourceUrl ? (
                      <a href={sourceUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          Download
                        </Button>
                      </a>
                    ) : (
                      <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
                        Download
                      </Button>
                    )}
                  </div>
                  {paper.codeAvailable && (
                    <div className="p-3 flex flex-col gap-2">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <GitBranch className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-mono text-emerald-400">Source Code Repository</span>
                         </div>
                        {paper.codeUrl ? (
                          <a href={paper.codeUrl} target="_blank" rel="noreferrer">
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              Visit Repo
                            </Button>
                          </a>
                        ) : (
                          <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
                            Visit Repo
                          </Button>
                        )}
                       </div>
                       <div className="bg-zinc-950 p-2 font-mono text-xs text-zinc-500 flex justify-between items-center">
                         <span className="truncate pr-3">
                           {paper.codeHash ? `Hash: ${paper.codeHash}` : paper.codeUrl ? `Repo: ${paper.codeUrl}` : "No code reference"}
                         </span>
                         <TooltipProvider>
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <button
                                 type="button"
                                 className="text-zinc-500 hover:text-white disabled:opacity-40"
                                 onClick={() => void copyCodeHash()}
                                 disabled={!paper.codeHash && !paper.codeUrl}
                                 aria-label="Copy code reference"
                               >
                                 <Copy className="w-3 h-3" />
                               </button>
                             </TooltipTrigger>
                             <TooltipContent>{copiedCodeHash ? "Copied" : "Copy"}</TooltipContent>
                           </Tooltip>
                         </TooltipProvider>
                       </div>
                    </div>
                  )}
               </div>
             </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </SheetContent>
  );
}
