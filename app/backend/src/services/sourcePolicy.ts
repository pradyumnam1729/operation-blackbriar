// Typed-source policy for the competitive watch engine. Cadences and sweep
// query templates are engineering-owned (same philosophy as the locked-suffix
// rule): the PMM admin controls WHICH sources exist and whether they're
// enabled; the policy for how each type is discovered and refreshed lives in
// code. Phase 0 sweeps a conservative subset — jobs/procurement/analyst are
// schema-supported and manually addable but not auto-swept yet (open decision
// #4 in the gap analysis: they are the noisiest types).

export type SourceType =
  | "official"
  | "pricing"
  | "release_notes"
  | "reviews"
  | "news"
  | "jobs"
  | "procurement"
  | "analyst"
  | "other";

export interface SourceTypePolicy {
  /** Default re-scrape interval (overridable per source via refresh_hours). */
  refreshHours: number;
  /** Jina Search queries a sweep runs for this type. Empty = never swept. */
  sweepQueries: (competitorName: string) => string[];
  /** Keep a search hit for this type? domain = competitor site host or null. */
  accept: (url: string, domain: string | null) => boolean;
}

/** True hostname match (exact or subdomain) — a substring test would let
 *  `https://evil.example/?ref=kahua.com` register as competitor ground truth
 *  (QA SF-3: evidence poisoning via crafted search results). */
const onDomain = (url: string, domain: string | null): boolean => {
  if (!domain) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    const d = domain.toLowerCase();
    return host === d || host.endsWith("." + d);
  } catch {
    return false;
  }
};

export const SOURCE_POLICY: Record<SourceType, SourceTypePolicy> = {
  official: {
    refreshHours: 24 * 30,
    sweepQueries: () => [], // the registry website is the entry point
    accept: onDomain,
  },
  pricing: {
    refreshHours: 24 * 7,
    sweepQueries: (n) => [`${n} pricing plans`],
    accept: (url, domain) => onDomain(url, domain) && /pricing|plans|editions/i.test(url),
  },
  release_notes: {
    refreshHours: 24 * 7,
    sweepQueries: (n) => [`${n} release notes what's new`],
    accept: (url, domain) =>
      onDomain(url, domain) || /release|changelog|whats-new|support\./i.test(url),
  },
  reviews: {
    refreshHours: 24 * 30,
    sweepQueries: (n) => [`${n} G2 reviews`],
    accept: (url) => /g2\.com|capterra\.com|trustradius\.com/i.test(url),
  },
  news: {
    refreshHours: 24 * 7,
    sweepQueries: (n) => [`${n} construction software announcement news`],
    accept: (url) => !/g2\.com|capterra|reddit|facebook|twitter|x\.com/i.test(url),
  },
  // Schema-supported, manually addable, not swept in Phase 0:
  jobs: { refreshHours: 24 * 14, sweepQueries: () => [], accept: () => true },
  procurement: { refreshHours: 24 * 14, sweepQueries: () => [], accept: () => true },
  analyst: { refreshHours: 24 * 90, sweepQueries: () => [], accept: () => true },
  other: { refreshHours: 24 * 30, sweepQueries: () => [], accept: () => true },
};

export const SWEPT_TYPES: SourceType[] = ["pricing", "release_notes", "reviews", "news"];

/** Max sources auto-discovered per type per competitor. */
export const MAX_SOURCES_PER_TYPE = 2;

export function refreshHoursFor(sourceType: string, override: number | null): number {
  if (override && override > 0) return override;
  return (SOURCE_POLICY[sourceType as SourceType] ?? SOURCE_POLICY.other).refreshHours;
}

/** Is this source due for a re-scrape? */
export function isDue(
  scrapedAt: string | null,
  sourceType: string,
  refreshOverride: number | null
): boolean {
  if (!scrapedAt) return true;
  const ageHours = (Date.now() - new Date(scrapedAt).getTime()) / 3_600_000;
  return ageHours >= refreshHoursFor(sourceType, refreshOverride);
}
