export const YELP_SERVICE_CATEGORIES = ['cleaning', 'electricians', 'handyman', 'hvac', 'landscaping', 'movers', 'painters', 'plumbing'] as const;
export type YelpServiceCategory = typeof YELP_SERVICE_CATEGORIES[number];

export type ProviderDiscoveryCandidate = {
  id: string;
  source: 'yelp';
  sourceId: string;
  sourceUrl: string;
  name: string;
  searchCategory: YelpServiceCategory;
  categories: Array<{ alias: string; title: string }>;
  rating: number | null;
  reviewCount: number;
  location: { city: string; state: string };
};

type Options = { apiKey?: string; fetchImpl?: typeof fetch; timeoutMs?: number; sleep?: (milliseconds: number) => Promise<void> };

function record(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function text(value: unknown) { return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''; }

function yelpUrl(value: unknown) {
  try {
    const url = new URL(text(value));
    return url.protocol === 'https:' && (url.hostname === 'yelp.com' || url.hostname.endsWith('.yelp.com')) ? url.toString() : '';
  } catch { return ''; }
}

export function isYelpServiceCategory(value: unknown): value is YelpServiceCategory {
  return typeof value === 'string' && YELP_SERVICE_CATEGORIES.includes(value as YelpServiceCategory);
}

export function normalizeYelpResponse(value: unknown, searchCategory: YelpServiceCategory): ProviderDiscoveryCandidate[] {
  const businesses = record(value)?.businesses;
  if (!Array.isArray(businesses)) throw new Error('Yelp did not return a valid businesses list.');
  return businesses.slice(0, 50).flatMap(raw => {
    const item = record(raw);
    const sourceId = text(item?.id);
    const name = text(item?.name);
    const sourceUrl = yelpUrl(item?.url);
    if (!sourceId || !name || !sourceUrl) return [];
    const rawCategories = Array.isArray(item?.categories) ? item.categories : [];
    const categories = rawCategories.flatMap(category => {
      const data = record(category);
      const alias = text(data?.alias);
      const title = text(data?.title);
      return alias && title ? [{ alias, title }] : [];
    }).slice(0, 10);
    const rawLocation = record(item?.location);
    const rating = Number(item?.rating);
    return [{
      id: `yelp_${sourceId}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
      source: 'yelp' as const,
      sourceId,
      sourceUrl,
      name: name.slice(0, 160),
      searchCategory,
      categories,
      rating: Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null,
      reviewCount: Math.max(0, Math.min(1_000_000, Number(item?.review_count) || 0)),
      location: { city: text(rawLocation?.city).slice(0, 80), state: text(rawLocation?.state).slice(0, 3) },
    }];
  });
}

export async function fetchYelpCandidates(category: YelpServiceCategory, options: Options = {}) {
  const apiKey = options.apiKey ?? process.env.YELP_API_KEY ?? '';
  if (!apiKey) throw new Error('Yelp server API key is not configured.');
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const url = new URL('https://api.yelp.com/v3/businesses/search');
  url.searchParams.set('location', 'San Francisco Bay Area, CA');
  url.searchParams.set('categories', category);
  url.searchParams.set('limit', '50');
  url.searchParams.set('sort_by', 'rating');
  let response: Response | undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await fetchImpl(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(options.timeoutMs ?? 10_000) });
    if (response.ok) break;
    if (![429, 500, 502, 503].includes(response.status) || attempt === 3) throw new Error(`Yelp request failed with HTTP ${response.status}.`);
    await sleep(250 * 2 ** (attempt - 1));
  }
  return normalizeYelpResponse(await response!.json(), category);
}
