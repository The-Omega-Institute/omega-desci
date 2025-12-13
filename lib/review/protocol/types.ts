import type { Paper } from "@/lib/mockData";
import type { EvidencePointer, EvidencePointerType } from "@/lib/review/evidence";
import type { EpistemicVerdict } from "@/lib/review/epistemic";
import type { RiskFlag } from "@/lib/review/risk";

export type OmegaReviewProtocolId = "omega-review-protocol-v1";

export type OmegaReviewClaimV1 = {
  id: string;
  claim: string;
  evidenceIds: string[];
};

export type OmegaReviewEvidenceV1 = EvidencePointer & { type: EvidencePointerType };

export type OmegaReviewDimensionId =
  | "value"
  | "falsifiability"
  | "evidence"
  | "robustness"
  | "reproducibility"
  | "causal"
  | "ethics";

export type OmegaReviewTestV1 = {
  id: string;
  dimension: OmegaReviewDimensionId;
  label: string;
  status: EpistemicVerdict;
  detail: string;
  fix?: string;
  weight?: number;
};

export type OmegaReviewTaskStatus = "queued" | "running" | "succeeded" | "failed" | "manual";

export type OmegaReviewTaskKind = "reproduction_ticket" | "safety_scan" | "schema_validation";

export type OmegaReviewTaskV1 = {
  id: string;
  kind: OmegaReviewTaskKind;
  status: OmegaReviewTaskStatus;
  queueJobId?: string;
  detail?: string;
};

export type OmegaReviewPayloadV1 = {
  paper: Pick<Paper, "id" | "title" | "doi" | "abstract" | "authors" | "importedFrom"> & Partial<Paper>;
  claims: OmegaReviewClaimV1[];
  evidence: OmegaReviewEvidenceV1[];
  tests: OmegaReviewTestV1[];
  tasks?: OmegaReviewTaskV1[];
  riskFlags?: RiskFlag[];
  attacks?: unknown[];
  sources?: Record<string, unknown>;
};

export type OmegaReviewArtifactV1 = {
  version: 1;
  protocol: OmegaReviewProtocolId;
  id: string;
  createdAt: string;
  hashAlg: "sha256";
  hash: string;
  payload: OmegaReviewPayloadV1;
};

