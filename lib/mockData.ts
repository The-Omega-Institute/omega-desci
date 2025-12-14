export type VerificationLevel = 0 | 1 | 2 | 3;

export interface Author {
  name: string;
  isAI: boolean;
  orcid?: string;
}

export interface Version {
  version: string;
  date: string;
  note: string;
  abstractOverride?: string;
}

export interface Review {
  id: string;
  author: string;
  anonymous?: boolean;
  verified: boolean;
  createdAt: string; // ISO timestamp
  hash?: string;
  coi: string;
  addressed?: {
    addressedAt: string;
    addressedBy: string;
    note?: string;
  };

  /**
   * Optional provenance for curated/imported external reviews.
   * - `community`: a review authored inside Omega.
   * - `imported`: a curated external review (incl. external AI/agentic reviewer outputs).
   */
  origin?: "community" | "imported";
  source?: {
    url: string;
    platform?: string;
    originalAuthor?: string;
    originalCreatedAt?: string; // ISO or date string (best-effort)
    license?: string;
    permission?: "link_only" | "licensed" | "authorized";
    systemName?: string;
    systemCreator?: string;
  };
  curation?: {
    curator?: string;
    curatedAt?: string; // ISO timestamp
    mappedClaims?: string[];
  };

  summary: string;
  strengths: string[];
  concerns: string[];
  falsifiabilityAssessment: string;
  technicalCorrectnessAssessment: string;
  verificationReadiness: string;
  requestedChanges: string[];
  recommendation: string;
}

export type ExternalReviewSourceType = "ai_system" | "human" | "mixed";

export type ExternalReviewSourceAccess = "public_url" | "token_gated" | "screenshot_only" | "export";

export type ExternalReviewCuratorRole = "curation" | "normalization" | "translation" | "claim-mapping" | "citation-check";

export type ExternalReviewEvidenceAttachmentKind = "screenshot" | "export" | "link" | "other";

export interface ExternalReviewEvidenceAttachment {
  id: string;
  kind: ExternalReviewEvidenceAttachmentKind;
  label: string;
  url?: string;
  note?: string;
  sha256?: string;
}

export type ExternalReviewArtifactStatus = "pending" | "approved" | "soft_hidden" | "removed";

export interface ExternalReviewVote {
  by: string;
  at: string; // ISO timestamp
}

export interface ExternalReviewValidation {
  helpfulVotes?: ExternalReviewVote[];
  addressed?: {
    addressedAt: string;
    addressedBy: string;
    note?: string;
  };
  highSignal?: {
    markedAt: string;
    markedBy: string;
    note?: string;
  };
}

export interface ExternalReviewArtifact {
  id: string;
  paperId: string;
  paperVersionId?: string;
  paperDoi?: string;
  createdAt: string; // ISO timestamp (imported into Omega)
  hash?: string;
  status: ExternalReviewArtifactStatus;
  statusReason?: string;
  source: {
    systemName?: string; // source_system_name
    type: ExternalReviewSourceType; // source_type
    url?: string; // source_url (optional when screenshot-only/export)
    access: ExternalReviewSourceAccess; // source_access
    platform?: string;
    originalAuthor?: string;
    originalCreatedAt?: string; // ISO or date string (best-effort)
    license?: string;
    permission: "link_only" | "licensed" | "authorized";
    systemCreators?: string[];
    disclaimer?: string; // source_disclaimer (summary)
  };
  curator: {
    userId: string; // curator_user_id (demo uses handle)
    roles: ExternalReviewCuratorRole[];
    attestation: string; // curator_attestation
    signature?: string; // curator_signature
    curatedAt: string; // ISO timestamp
    coi: string;
    mappedClaims?: string[];
    mappedTargets?: string[]; // claim ids or paragraph/section anchors (e.g., C1, #p3, §2.1)
  };
  evidenceAttachments?: ExternalReviewEvidenceAttachment[];
  validation?: ExternalReviewValidation;
  withdrawal?: {
    withdrawnAt: string;
    withdrawnBy: string;
    reason?: string;
  };
  moderation?: {
    reviewedAt?: string;
    reviewedBy?: string;
    note?: string;
  };
  content: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    questions: string[];
    detailedComments: string;
    overallAssessment: string;
  };
}

export type CommentKind = "question" | "suggestion" | "reference" | "concern" | "counterexample";

export type CommentStatus = "open" | "resolved" | "incorporated";

export type CommentAuthorRole = "community" | "author" | "editor";

export type CommentVisibility = "queued" | "published";

export interface CommentReply {
  id: string;
  author: string;
  authorRole?: CommentAuthorRole;
  createdAt: string;
  body: string;
}

export interface Comment {
  id: string;
  author: string;
  authorRole?: CommentAuthorRole;
  createdAt: string;
  kind: CommentKind;
  body: string;
  targetRef?: string;
  visibility?: CommentVisibility; // tiered permissions: new accounts may enqueue comments
  removed?: boolean; // content removed (metadata retained) for auditability
  mergedIntoId?: string; // duplicate merge target (canonical comment id)
  status?: CommentStatus;
  softHidden?: boolean;
  replies?: CommentReply[];
}

export type StructuredAbstract = {
  problem: string;
  approach: string;
  keyClaims: string;
  limitations: string;
};

export type ContributorRole =
  | "Conceptualization"
  | "Methodology"
  | "Software"
  | "Validation"
  | "Writing"
  | "Visualization";

export type NonHumanContributor = {
  name: string;
  versionOrId?: string;
  scope?: string;
  promptStrategy?: string;
  validationSummary?: string;
};

export interface Paper {
  id: string;
  title: string;
  abstract: string;
  abstractStructured?: StructuredAbstract;
  provenanceStatement?: string;
  responsibleStewards?: string[];
  contributorRoles?: Partial<Record<ContributorRole, string[]>>;
  nonHumanContributors?: NonHumanContributor[];
  doi: string;
  collectionVolume: string;
  level: VerificationLevel;
  articleType:
    | "Theory Preprint"
    | "Conjecture Note"
    | "Proof or Formal Derivation"
    | "Computational Experiment"
    | "Verification Report"
    | "Replication Report"
    | "Negative Result"
    | "Survey or Synthesis"
    | "Critique or Commentary";
  discipline: "Digital Physics" | "Cellular Automata" | "Thermodynamics" | "AI Foundations" | "Cosmology";
  keywords: string[];
  tags?: string[];
  license?: string;
  competingInterests?: string;
  funding?: string;
  authors: Author[];
  aiContributionPercent: number;
  codeAvailable: boolean;
  codeUrl?: string;
  codeHash?: string;
  dataAvailable: boolean;
  dataUrl?: string;
  importedFrom: "Zenodo" | "Omega" | "arXiv";
  versions: Version[];
  openReviewsCount: number;
  reviews: Review[];
  comments?: Comment[];
  replicationBounty?: {
    active: boolean;
    amountELF: number;
  };
  falsifiabilityPath: string;
}

const DISCIPLINES = ["Digital Physics", "Cellular Automata", "Thermodynamics", "AI Foundations", "Cosmology"] as const;

export const papers: Paper[] = [
  {
    id: "omega-001",
    title: "Cosmological Phase Transitions in Wolfram's Rule 30",
    abstract: "We investigate the emergence of thermodynamic irreversibility in elementary cellular automata. By treating Rule 30 as a proxy for the quantum vacuum, we demonstrate a phase transition analogous to cosmic inflation when boundary conditions are perturbed. Results suggest distinct entropy horizons.",
    doi: "10.5281/zenodo.9928112",
    collectionVolume: "Vol 1. Digital Physics",
    level: 2,
    articleType: "Theory Preprint",
    discipline: "Digital Physics",
    keywords: ["Rule 30", "Entropy", "Inflation", "Wolfram Physics"],
    authors: [
      { name: "Dr. A. Vance", isAI: false, orcid: "0000-0002-1825-0097" },
      { name: "Omega AI v2", isAI: true }
    ],
    aiContributionPercent: 40,
    codeAvailable: true,
    codeUrl: "https://github.com/omega-inst/rule30-cosmology",
    codeHash: "0x7a91...b2f1",
    dataAvailable: true,
    dataUrl: "ipfs://QmHash...",
    importedFrom: "Zenodo",
    versions: [
      { version: "v1.2", date: "2024-05-10", note: "Corrected entropy calculations" },
      { version: "v1.0", date: "2024-04-22", note: "Initial submission" }
    ],
    openReviewsCount: 12,
    reviews: [
      {
        id: "r1",
        author: "Prof. S. Glitch",
        anonymous: false,
        verified: true,
        createdAt: "2024-05-02T09:30:00.000Z",
        coi: "None",
        summary: "A creative link between Rule 30 entropy dynamics and inflation-style behavior, backed by a runnable simulation pipeline.",
        strengths: ["Novel methodology", "Reproducible code + clear parameters", "Evidence is easy to re-audit"],
        concerns: ["Boundary condition assumptions are weak and under-justified", "Some claims are not explicitly linked to figures/tables"],
        falsifiabilityAssessment:
          "Partially falsifiable via simulation-based predictions; needs clearer claim-to-test mapping (C1..Cn) and explicit failure thresholds.",
        technicalCorrectnessAssessment:
          "The core derivation appears plausible, but the boundary-condition regime and sensitivity analysis require deeper treatment.",
        verificationReadiness:
          "High: code is available and parameters are stated; recommend an independent rerun on larger grids + parameter sweep to confirm robustness.",
        requestedChanges: [
          "Add a numbered claims list (C1..Cn) and link each to specific figures/tables.",
          "Strengthen boundary-condition rationale and include sensitivity/ablation results.",
          "Provide a reproducibility note: exact commit/hash, environment, and deterministic seeds.",
        ],
        recommendation:
          "Eligible for Level 2 after: (1) explicit claim→evidence anchors, (2) boundary-condition + sensitivity analysis, (3) reproducibility anchors (commit/hash + env).",
      }
    ],
    replicationBounty: { active: true, amountELF: 500 },
    falsifiabilityPath: "Simulate Rule 30 on a 10^9 grid for 10^5 steps. If entropy variance < 0.01%, hypothesis is falsified."
  },
  {
    id: "omega-002",
    title: "Negative Result: Hypergraph Rewriting Systems Do Not Converge in Low Dimensions",
    abstract: "An exhaustive search of rewriting rules in 2D and 3D manifolds shows a divergence in spatial curvature. This contradicts the 'Emergent Gravity' proposal for low-dimensional discrete spaces. We provide a counter-example set of 500 graphs.",
    doi: "10.5281/zenodo.8837123",
    collectionVolume: "Vol 1. Digital Physics",
    level: 3,
    articleType: "Negative Result",
    discipline: "Cosmology",
    keywords: ["Hypergraphs", "Gravity", "Divergence", "Geometry"],
    authors: [
      { name: "J. Doe", isAI: false },
      { name: "GPT-4o", isAI: true }
    ],
    aiContributionPercent: 85,
    codeAvailable: true,
    codeHash: "0x8b22...c3d4",
    dataAvailable: false,
    importedFrom: "Zenodo",
    versions: [{ version: "v1.0", date: "2024-05-15", note: "Initial release" }],
    openReviewsCount: 4,
    reviews: [],
    replicationBounty: { active: false, amountELF: 0 },
    falsifiabilityPath: "Find a single rewriting rule in the provided set that converges to a Euclidean manifold."
  },
  {
    id: "omega-003",
    title: "Algorithmic Information Content of Black Hole Horizons",
    abstract: "Applying Kolmogorov complexity metrics to the event horizon surface area. We propose that information is not lost but compressed into irreducible algorithmic strings.",
    doi: "10.5281/zenodo.7748291",
    collectionVolume: "Vol 2. Info Theory",
    level: 1,
    articleType: "Theory Preprint",
    discipline: "Thermodynamics",
    keywords: ["Black Holes", "Kolmogorov", "Information Paradox"],
    authors: [
      { name: "S. Hawking (Simulated)", isAI: true },
      { name: "R. Penrose (Simulated)", isAI: true },
      { name: "Prompt Eng. Team", isAI: false }
    ],
    aiContributionPercent: 95,
    codeAvailable: false,
    dataAvailable: true,
    importedFrom: "Zenodo",
    versions: [{ version: "v1.0", date: "2024-05-18", note: "Generated by Omega-LLM" }],
    openReviewsCount: 28,
    reviews: [],
    replicationBounty: { active: true, amountELF: 1500 },
    falsifiabilityPath: "Prove that the compression ratio of the horizon exceeds the Bekenstein bound."
  },
  {
    id: "omega-004",
    title: "Replication Report: 'Consciousness as an Error Correcting Code'",
    abstract: "We attempted to replicate the findings of Smith et al. regarding quantum error correction in microtubules. Using updated simulation parameters, we failed to observe the predicted coherence times.",
    doi: "10.5281/zenodo.1122334",
    collectionVolume: "Vol 3. Bio-Digital",
    level: 3,
    articleType: "Replication Report",
    discipline: "AI Foundations",
    keywords: ["Microtubules", "Quantum Bio", "Replication Failure"],
    authors: [{ name: "Lab 42", isAI: false }],
    aiContributionPercent: 0,
    codeAvailable: true,
    codeHash: "0x1111...aaaa",
    dataAvailable: true,
    importedFrom: "Zenodo",
    versions: [{ version: "v1.0", date: "2024-02-10", note: "Final report" }],
    openReviewsCount: 2,
    reviews: [],
    falsifiabilityPath: "Direct experimental observation of coherence > 1ms."
  },
  {
    id: "omega-005",
    title: "Survey of Turing-Complete Chemical Reaction Networks",
    abstract: "A comprehensive review of chemical systems capable of universal computation. We categorize 50 distinct reaction pathways and their computational efficiency relative to silicon.",
    doi: "10.5281/zenodo.5566778",
    collectionVolume: "Vol 1. Digital Physics",
    level: 1,
    articleType: "Survey or Synthesis",
    discipline: "Cellular Automata",
    keywords: ["Chemistry", "Turing Complete", "Unconventional Computing"],
    authors: [{ name: "Dr. K. Chen", isAI: false, orcid: "0000-0001-5555-1234" }],
    aiContributionPercent: 10,
    codeAvailable: false,
    dataAvailable: true,
    importedFrom: "Zenodo",
    versions: [{ version: "v1.0", date: "2024-01-20", note: "Published" }],
    openReviewsCount: 0,
    reviews: [],
    falsifiabilityPath: "N/A (Survey)"
  },
  {
    id: "omega-006",
    title: "Optimizing Maxwell's Demon with Reinforcement Learning",
    abstract: "We train a Deep Q-Network to operate a Maxwell's Demon gate. The agent discovers a strategy that seemingly violates the Second Law effectively by utilizing information as a resource with > 99% efficiency.",
    doi: "10.5281/zenodo.4433221",
    collectionVolume: "Vol 2. Info Theory",
    level: 2,
    articleType: "Computational Experiment",
    discipline: "Thermodynamics",
    keywords: ["RL", "Maxwell Demon", "Entropy", "DeepMind"],
    authors: [
      { name: "AlphaZero-Thermo", isAI: true },
      { name: "T. Stark", isAI: false }
    ],
    aiContributionPercent: 60,
    codeAvailable: true,
    codeHash: "0x9988...7766",
    dataAvailable: true,
    importedFrom: "Zenodo",
    versions: [{ version: "v2.1", date: "2024-05-20", note: "Updated hyperparameters" }],
    openReviewsCount: 15,
    reviews: [],
    replicationBounty: { active: true, amountELF: 200 },
    falsifiabilityPath: "Demonstrate that the energy cost of the agent's memory erasure >= the work extracted."
  }
];

// Generate more filler data to reach 12
for (let i = 7; i <= 12; i++) {
  papers.push({
    id: `omega-00${i}`,
    title: `Procedural Generation of Physical Laws #${i}`,
    abstract: "Exploring the space of possible physical laws using genetic algorithms. This paper represents a generated hypothesis regarding fundamental constants.",
    doi: `10.5281/zenodo.000000${i}`,
    collectionVolume: "Vol 4. Generative Science",
    level: (i % 4) as VerificationLevel,
    articleType: "Theory Preprint",
    discipline: DISCIPLINES[i % 5],
    keywords: ["Genetic Algo", "Physics", "Simulation"],
    authors: [{ name: "Omega AI", isAI: true }],
    aiContributionPercent: 100,
    codeAvailable: i % 2 === 0,
    dataAvailable: true,
    importedFrom: "Zenodo",
    versions: [{ version: "v1.0", date: "2024-05-01", note: "Auto-generated" }],
    openReviewsCount: i * 2,
    reviews: [],
    replicationBounty: i % 3 === 0 ? { active: true, amountELF: i * 100 } : undefined,
    falsifiabilityPath: "Experimental verification of the predicted fine-structure constant variation."
  });
}

export function getStats() {
  const paperCount = papers.length;
  const bountyCount = papers.filter(p => p.replicationBounty?.active).length;
  const totalELF = papers.reduce((acc, p) => acc + (p.replicationBounty?.amountELF || 0), 48000); // 48k base + active
  return { paperCount, bountyCount, totalELF };
}
