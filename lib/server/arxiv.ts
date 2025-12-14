import type { Paper } from "@/lib/mockData";

type ArxivRecord = {
  id: string;
  url: string;
  title: string;
  summary: string;
  publishedAt: string;
  updatedAt: string;
  authors: string[];
  categories: string[];
  primaryCategory: string | null;
  doi: string | null;
};

function decodeXmlEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstTag(xml: string, tag: string) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return null;
  return decodeXmlEntities(m[1] || "");
}

function allCategoryTerms(xml: string) {
  const re = /<category\s+term="([^"]+)"/gi;
  const terms: string[] = [];
  for (const m of xml.matchAll(re)) {
    const term = (m[1] || "").trim();
    if (term) terms.push(term);
  }
  return Array.from(new Set(terms));
}

function primaryCategoryTerm(xml: string) {
  const re = /<arxiv:primary_category\s+term="([^"]+)"/i;
  const m = xml.match(re);
  const term = (m?.[1] || "").trim();
  return term || null;
}

function arxivDoi(xml: string) {
  const re = /<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/i;
  const m = xml.match(re);
  const doi = decodeXmlEntities(m?.[1] || "");
  return doi || null;
}

export function extractArxivId(input: string) {
  const raw = (input || "").trim();
  if (!raw) return null;

  const direct = raw.replace(/^arxiv:/i, "").trim();
  if (/^[a-z-]+(\/\d{7})(v\d+)?$/i.test(direct)) return direct;
  if (/^\d{4}\.\d{4,5}(v\d+)?$/i.test(direct)) return direct;

  try {
    const url = new URL(raw);
    const path = url.pathname;
    const absMatch = path.match(/\/abs\/([^/?#]+)/i);
    if (absMatch?.[1]) return absMatch[1].trim();
    const pdfMatch = path.match(/\/pdf\/([^/?#]+?)(?:\.pdf)?$/i);
    if (pdfMatch?.[1]) return pdfMatch[1].trim();
  } catch {
    // ignore
  }

  const anywhereNew = raw.match(/\b(\d{4}\.\d{4,5}(?:v\d+)?)\b/i);
  if (anywhereNew?.[1]) return anywhereNew[1];

  const anywhereOld = raw.match(/\b([a-z-]+\/\d{7}(?:v\d+)?)\b/i);
  if (anywhereOld?.[1]) return anywhereOld[1];

  return null;
}

export async function fetchArxivRecord(arxivId: string): Promise<ArxivRecord> {
  const id = arxivId.trim();
  if (!id) throw new Error("Missing arXiv id.");

  const endpoint = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`;
  const res = await fetch(endpoint, { cache: "no-store" });
  if (!res.ok) throw new Error(`arXiv API error (${res.status})`);
  const xml = await res.text();

  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/i);
  if (!entryMatch?.[1]) throw new Error("arXiv entry not found.");
  const entry = entryMatch[1];

  const entryId = firstTag(entry, "id") || `http://arxiv.org/abs/${id}`;
  const title = firstTag(entry, "title") || id;
  const summary = firstTag(entry, "summary") || "";
  const publishedAt = firstTag(entry, "published") || new Date().toISOString();
  const updatedAt = firstTag(entry, "updated") || publishedAt;

  const authors = (() => {
    const authorBlocks = entry.match(/<author>([\s\S]*?)<\/author>/gi) || [];
    const names: string[] = [];
    for (const block of authorBlocks) {
      const name = firstTag(block, "name");
      if (name) names.push(name);
    }
    return names;
  })();

  const categories = allCategoryTerms(entry);
  const primaryCategory = primaryCategoryTerm(entry);
  const doi = arxivDoi(entry);

  return {
    id,
    url: entryId,
    title,
    summary,
    publishedAt,
    updatedAt,
    authors,
    categories,
    primaryCategory,
    doi,
  };
}

function mapDiscipline(primaryCategory: string | null): Paper["discipline"] {
  const cat = (primaryCategory || "").toLowerCase();
  if (cat.startsWith("cs.")) return "AI Foundations";
  if (cat.startsWith("q-bio.")) return "AI Foundations";
  if (cat.startsWith("astro-ph") || cat.startsWith("gr-qc") || cat.includes("cosmo")) return "Cosmology";
  if (cat.includes("stat-mech") || cat.includes("thermo") || cat.includes("cond-mat")) return "Thermodynamics";
  if (cat.startsWith("physics.")) return "Digital Physics";
  if (cat.startsWith("math.")) return "Digital Physics";
  return "AI Foundations";
}

export function arxivRecordToPaper(record: ArxivRecord): Paper {
  const published = record.publishedAt ? record.publishedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const doi = record.doi ? record.doi : `arXiv:${record.id}`;
  const keywords = Array.from(new Set(["arXiv", ...(record.categories || []).slice(0, 6)]));

  return {
    id: `arxiv:${record.id}`,
    title: record.title,
    abstract: record.summary,
    doi,
    collectionVolume: record.primaryCategory ? `arXiv · ${record.primaryCategory}` : "arXiv",
    level: 0,
    articleType: "Theory Preprint",
    discipline: mapDiscipline(record.primaryCategory),
    keywords,
    authors: (record.authors || []).slice(0, 24).map((name) => ({ name, isAI: false })),
    aiContributionPercent: 0,
    codeAvailable: false,
    dataAvailable: false,
    importedFrom: "arXiv",
    versions: [
      {
        version: record.id.includes("v") ? record.id.split("v").pop() ? `v${record.id.split("v").pop()}` : "v1" : "v1",
        date: published,
        note: "Imported from arXiv (record-level metadata).",
      },
    ],
    openReviewsCount: 0,
    reviews: [],
    replicationBounty: { active: true, amountELF: 420 },
    falsifiabilityPath: "N/A (arXiv import) — define a falsification threshold and a counter-test.",
  };
}
