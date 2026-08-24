export type InteractionEvent =
  | { type: 'job_apply_click'; jobId: string }
  | { type: 'news_open'; newsId: string; sourceName: string };

export type InteractionValidation =
  | { ok: true; event: InteractionEvent }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every(key => allowed.has(key));
}

function validId(value: unknown, prefix?: string) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 240) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return false;
  return prefix ? value.startsWith(prefix) : true;
}

function validSourceName(value: unknown) {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.trim().length <= 120
    && !/[\u0000-\u001F\u007F]/.test(value);
}

export function validateInteractionEvent(value: unknown): InteractionValidation {
  if (!isRecord(value)) return { ok: false, error: 'Event payload must be an object' };

  if (value.type === 'job_apply_click') {
    if (!hasOnlyKeys(value, ['type', 'jobId']) || !validId(value.jobId)) {
      return { ok: false, error: 'Job event payload is invalid' };
    }
    return { ok: true, event: { type: 'job_apply_click', jobId: value.jobId as string } };
  }

  if (value.type === 'news_open') {
    if (
      !hasOnlyKeys(value, ['type', 'newsId', 'sourceName'])
      || !validId(value.newsId, 'news_')
      || !validSourceName(value.sourceName)
    ) {
      return { ok: false, error: 'News event payload is invalid' };
    }
    return {
      ok: true,
      event: {
        type: 'news_open',
        newsId: value.newsId as string,
        sourceName: (value.sourceName as string).trim(),
      },
    };
  }

  return { ok: false, error: 'Unsupported event type' };
}
