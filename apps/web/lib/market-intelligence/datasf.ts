const DATASETS = [
  {
    id: '311' as const,
    resource: 'vw6y-z8j6',
    dateField: 'requested_datetime',
    categoryField: 'service_name',
    neighborhoodField: 'analysis_neighborhood',
  },
  {
    id: 'building_permits' as const,
    resource: 'i98e-djp9',
    dateField: 'filed_date',
    categoryField: 'permit_type_definition',
    neighborhoodField: 'neighborhoods_analysis_boundaries',
  },
];

export type DataSfInsight = { dataset: '311' | 'building_permits'; category: string; neighborhood: string; count: number };
type Options = { appToken?: string; fetchImpl?: typeof fetch; timeoutMs?: number; sleep?: (milliseconds: number) => Promise<void>; now?: Date };

export function buildDataSfQueries(now = new Date()) {
  const since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1_000).toISOString().slice(0, 19);
  return DATASETS.map(dataset => {
    const url = new URL(`https://data.sfgov.org/resource/${dataset.resource}.json`);
    url.searchParams.set('$select', `${dataset.categoryField} as category, ${dataset.neighborhoodField} as neighborhood, count(*) as demand_count`);
    url.searchParams.set('$where', `${dataset.dateField} >= '${since}' and ${dataset.categoryField} is not null`);
    url.searchParams.set('$group', `${dataset.categoryField}, ${dataset.neighborhoodField}`);
    url.searchParams.set('$order', 'demand_count DESC');
    url.searchParams.set('$limit', '100');
    return { id: dataset.id, url: url.toString() };
  });
}

function text(value: unknown) { return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''; }

export function normalizeDataSfRows(value: unknown, dataset: DataSfInsight['dataset']): DataSfInsight[] {
  if (!Array.isArray(value)) throw new Error('DataSF did not return a valid aggregate result.');
  return value.slice(0, 100).flatMap(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const row = raw as Record<string, unknown>;
    const category = text(row.category).slice(0, 120);
    if (!category) return [];
    return [{
      dataset,
      category,
      neighborhood: (text(row.neighborhood) || 'Citywide').slice(0, 80),
      count: Math.max(0, Math.min(10_000_000, Number(row.demand_count) || 0)),
    }];
  });
}

async function fetchDataset(query: ReturnType<typeof buildDataSfQueries>[number], options: Required<Pick<Options, 'fetchImpl' | 'timeoutMs' | 'sleep'>> & { appToken: string }) {
  const startedAt = Date.now();
  try {
    let response: Response | undefined;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      response = await options.fetchImpl(query.url, {
        headers: { Accept: 'application/json', ...(options.appToken ? { 'X-App-Token': options.appToken } : {}) },
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (response.ok) break;
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) throw new Error(`HTTP ${response.status}`);
      await options.sleep(200 * 2 ** (attempt - 1));
    }
    const insights = normalizeDataSfRows(await response!.json(), query.id);
    return { insights, health: { id: query.id, status: insights.length ? 'healthy' as const : 'empty' as const, rows: insights.length, durationMs: Date.now() - startedAt } };
  } catch (cause) {
    return { insights: [], health: { id: query.id, status: 'failed' as const, rows: 0, durationMs: Date.now() - startedAt, error: cause instanceof Error ? cause.message : 'Unknown error' } };
  }
}

export async function fetchDataSfDemand(options: Options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const results = await Promise.all(buildDataSfQueries(options.now).map(query => fetchDataset(query, {
    fetchImpl,
    sleep,
    timeoutMs: options.timeoutMs ?? 10_000,
    appToken: options.appToken ?? process.env.DATASF_APP_TOKEN ?? '',
  })));
  return {
    insights: results.flatMap(result => result.insights),
    sources: results.map(result => result.health),
    windowDays: 90,
    generatedAt: new Date().toISOString(),
    privacy: 'Aggregated public counts only; no addresses, coordinates, request IDs, or personal data.',
  };
}
