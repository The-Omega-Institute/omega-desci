import type { Paper } from "@/lib/mockData";

type ZenodoCreator = {
  name: string;
  orcid?: string;
};

type ZenodoRecord = {
  created?: string;
  id: number;
  doi?: string;
  metadata: {
    title: string;
    description?: string;
    doi?: string;
    publication_date?: string;
    creators?: ZenodoCreator[];
    keywords?: string[];
    resource_type?: {
      title?: string;
      type?: string;
      subtype?: string;
    };
    related_identifiers?: Array<{
      identifier: string;
      relation?: string;
      scheme?: string;
      resource_type?: string;
    }>;
    version?: string;
    communities?: Array<{ id: string }>;
  };
  links?: {
    self_html?: string;
    doi?: string;
  };
  files?: Array<{
    key: string;
    links?: { self?: string };
  }>;
  swh?: string | null;
};

type ZenodoSearchResponse = {
  hits: {
    total: number;
    hits: ZenodoRecord[];
  };
};

const ZENODO_API_BASE = process.env.ZENODO_API_BASE?.trim() || "https://zenodo.org/api";
const DEFAULT_COMMUNITY = process.env.ZENODO_COMMUNITY?.trim() || "the-matrix";
const ACCESS_TOKEN = process.env.ZENODO_ACCESS_TOKEN?.trim() || "";

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function humanizeCommunityId(id: string) {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferArticleType(title: string, keywords: string[]): Paper["articleType"] {
  const haystack = `${title}\n${keywords.join(" ")}`.toLowerCase();
  if (/(survey|review|overview)\b/.test(haystack)) return "Survey";
  if (/(replication|reproduc)/.test(haystack)) return "Replication Report";
  if (/(negative result|null result|failed to)\b/.test(haystack)) return "Negative Result";
  if (/(method|protocol|implementation)\b/.test(haystack)) return "Methods Note";
  return "Preprint";
}

function inferDiscipline(title: string, keywords: string[]): Paper["discipline"] {
  const haystack = `${title}\n${keywords.join(" ")}`.toLowerCase();
  if (/(cellular automata|wolfram|rule\s*\d+|qca)\b/.test(haystack)) return "Cellular Automata";
  if (/(entropy|thermo|maxwell|second law)\b/.test(haystack)) return "Thermodynamics";
  if (/(cosmo|gravity|relativity|black hole|horizon)\b/.test(haystack)) return "Cosmology";
  if (/(machine learning|neural|llm|gpt|ai)\b/.test(haystack)) return "AI Foundations";
  return "Digital Physics";
}

function isAiName(name: string) {
  return /(^|\b)(gpt|chatgpt|llm|ai|claude|gemini|openai|anthropic)\b/i.test(name);
}

function extractRepoUrl(record: ZenodoRecord) {
  const candidates: string[] = [];

  const description = record.metadata.description || "";
  const descriptionMatches = description.match(/https?:\/\/[^\s)]+/g) || [];
  candidates.push(...descriptionMatches);

  const related = record.metadata.related_identifiers || [];
  for (const rel of related) {
    if (rel?.identifier) candidates.push(rel.identifier);
  }

  const repo = candidates.find((u) => /github\.com|gitlab\.com|bitbucket\.org/i.test(u));
  return repo || undefined;
}

function hasDataFiles(files: ZenodoRecord["files"]) {
  const keys = (files || []).map((f) => f.key.toLowerCase());
  const dataExts = [
    ".csv",
    ".json",
    ".zip",
    ".tar",
    ".gz",
    ".7z",
    ".parquet",
    ".h5",
    ".hdf5",
    ".npz",
    ".npy",
    ".mat",
  ];
  return keys.some((k) => dataExts.some((ext) => k.endsWith(ext)));
}

export function zenodoRecordToPaper(record: ZenodoRecord, communityId?: string): Paper {
  const title = record.metadata.title || "Untitled Record";
  const keywords = record.metadata.keywords || [];
  const doi = record.doi || record.metadata.doi || "";
  const publicationDate = record.metadata.publication_date || record.created?.split("T")?.[0] || "";

  const community =
    communityId ||
    record.metadata.communities?.[0]?.id ||
    DEFAULT_COMMUNITY ||
    "zenodo";
  const communityLabel = humanizeCommunityId(community);
  const resourceLabel = record.metadata.resource_type?.title || "Zenodo Record";

  const abstractRaw = record.metadata.description || "No abstract provided.";
  const abstract = stripHtml(abstractRaw);

  const authors =
    record.metadata.creators?.map((c) => ({
      name: c.name,
      isAI: isAiName(c.name),
      orcid: c.orcid,
    })) || [{ name: "Unknown", isAI: false }];

  const codeUrl = extractRepoUrl(record);
  const codeAvailable = Boolean(codeUrl);
  const dataAvailable = hasDataFiles(record.files);

  return {
    id: `zenodo-${record.id}`,
    title,
    abstract,
    doi: doi || `zenodo:${record.id}`,
    collectionVolume: `${communityLabel} · ${resourceLabel}`,
    level: 1,
    articleType: inferArticleType(title, keywords),
    discipline: inferDiscipline(title, keywords),
    keywords,
    authors,
    aiContributionPercent: 0,
    codeAvailable,
    codeUrl,
    dataAvailable,
    dataUrl: dataAvailable ? record.links?.self_html : undefined,
    importedFrom: "Zenodo",
    versions: [
      {
        version: record.metadata.version || "v1.0",
        date: publicationDate,
        note: "Imported from Zenodo",
      },
    ],
    openReviewsCount: 0,
    reviews: [],
    replicationBounty: undefined,
    falsifiabilityPath: "N/A",
  };
}

export async function fetchZenodoCommunityRecords(params: {
  community?: string;
  page?: number;
  size?: number;
  sort?: string;
  q?: string | null;
}) {
  const community = params.community?.trim() || DEFAULT_COMMUNITY;
  const page = Number.isFinite(params.page) && (params.page as number) > 0 ? (params.page as number) : 1;
  const sizeRaw = Number.isFinite(params.size) ? (params.size as number) : 24;
  const size = Math.min(100, Math.max(1, sizeRaw));
  const sort = params.sort?.trim() || "newest";
  const q = params.q?.trim() || "";

  const url = new URL(`${ZENODO_API_BASE.replace(/\/$/, "")}/records/`);
  url.searchParams.set("communities", community);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(size));
  url.searchParams.set("sort", sort);
  if (q) url.searchParams.set("q", q);
  if (ACCESS_TOKEN) url.searchParams.set("access_token", ACCESS_TOKEN);

  const res = await fetch(url.toString(), {
    next: { revalidate: 300 },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Zenodo API error (${res.status}): ${text || res.statusText}`);
  }

  const data = (await res.json()) as ZenodoSearchResponse;
  const papers = (data.hits?.hits || []).map((r) => zenodoRecordToPaper(r, community));

  return {
    community,
    page,
    size,
    sort,
    q: q || null,
    total: data.hits?.total || 0,
    papers,
  };
}

export async function fetchZenodoRecordById(recordId: string | number, communityHint?: string) {
  const id = String(recordId).trim();
  if (!/^\d+$/.test(id)) throw new Error("Invalid Zenodo record id.");

  const url = new URL(`${ZENODO_API_BASE.replace(/\/$/, "")}/records/${id}`);
  if (ACCESS_TOKEN) url.searchParams.set("access_token", ACCESS_TOKEN);

  const res = await fetch(url.toString(), {
    next: { revalidate: 300 },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Zenodo API error (${res.status}): ${text || res.statusText}`);
  }

  const record = (await res.json()) as ZenodoRecord;
  return zenodoRecordToPaper(record, communityHint);
}
