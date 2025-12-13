import type { Paper, VerificationLevel } from "@/lib/mockData";

export type ArchiveFilters = {
  disciplines: Paper["discipline"][];
  articleTypes: Paper["articleType"][];
  requireCode: boolean;
  requireData: boolean;
  minLevel: VerificationLevel | null;
};

export const DEFAULT_ARCHIVE_FILTERS: ArchiveFilters = {
  disciplines: [],
  articleTypes: [],
  requireCode: false,
  requireData: false,
  minLevel: null,
};

export function getHasActiveFilters(filters: ArchiveFilters) {
  return (
    filters.disciplines.length > 0 ||
    filters.articleTypes.length > 0 ||
    filters.requireCode ||
    filters.requireData ||
    filters.minLevel !== null
  );
}

export function toggleStringArrayValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

export function filterPapers(papers: Paper[], filters: ArchiveFilters) {
  return papers.filter((paper) => {
    if (filters.disciplines.length > 0 && !filters.disciplines.includes(paper.discipline)) return false;
    if (filters.articleTypes.length > 0 && !filters.articleTypes.includes(paper.articleType)) return false;
    if (filters.requireCode && !paper.codeAvailable) return false;
    if (filters.requireData && !paper.dataAvailable) return false;
    if (filters.minLevel !== null && paper.level < filters.minLevel) return false;
    return true;
  });
}

export type SortKey = "newest" | "most-reviewed" | "highest-bounty" | "ai-heavy";

export const SORT_OPTIONS: Array<{
  key: SortKey;
  label: string;
  description: string;
}> = [
  { key: "newest", label: "NEWEST", description: "Latest version date first" },
  { key: "most-reviewed", label: "MOST REVIEWED", description: "Highest open review count first" },
  { key: "highest-bounty", label: "HIGHEST BOUNTY", description: "Largest replication bounty first" },
  { key: "ai-heavy", label: "AI HEAVY", description: "Highest AI contribution first" },
];

function getLatestVersionDateMs(paper: Paper) {
  let latest = 0;
  for (const v of paper.versions || []) {
    if (!v?.date) continue;
    const ms = Date.parse(v.date);
    if (Number.isFinite(ms) && ms > latest) latest = ms;
  }
  return latest;
}

export function sortPapers(papers: Paper[], sortKey: SortKey) {
  const list = [...papers];

  list.sort((a, b) => {
    switch (sortKey) {
      case "most-reviewed":
        return (b.openReviewsCount || 0) - (a.openReviewsCount || 0);
      case "highest-bounty":
        return (b.replicationBounty?.amountELF || 0) - (a.replicationBounty?.amountELF || 0);
      case "ai-heavy":
        return (b.aiContributionPercent || 0) - (a.aiContributionPercent || 0);
      case "newest":
      default:
        return getLatestVersionDateMs(b) - getLatestVersionDateMs(a);
    }
  });

  return list;
}

