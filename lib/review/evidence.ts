export type EvidencePointerType =
  | "figure"
  | "table"
  | "data"
  | "code"
  | "stat_test"
  | "appendix"
  | "doi"
  | "url";

export type EvidencePointer = {
  id: string;
  type: EvidencePointerType;
  label: string;
  ref?: string;
  url?: string;
  doi?: string;
  hash?: string;
  commit?: string;
  note?: string;
};

export type ClaimEvidence = {
  /**
   * Optional stable identifier (e.g. C1, C2, C3…).
   * When omitted, UIs and engines may derive an id from array order.
   */
  id?: string;
  claim: string;
  /**
   * Body anchor reference for the claim (paragraph / proposition / theorem id, etc.).
   */
  sourceRef?: string;
  evidenceIds: string[];
};

export function formatEvidencePointer(p: EvidencePointer) {
  const parts: string[] = [];
  const upper = p.type.toUpperCase();
  parts.push(`${upper}: ${p.label}`);
  if (p.ref) parts.push(`ref=${p.ref}`);
  if (p.doi) parts.push(`doi=${p.doi}`);
  if (p.url) parts.push(`url=${p.url}`);
  if (p.commit) parts.push(`commit=${p.commit}`);
  if (p.hash) parts.push(`hash=${p.hash}`);
  if (p.note) parts.push(`note=${p.note}`);
  return parts.join(" | ");
}
