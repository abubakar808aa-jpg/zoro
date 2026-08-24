import type { JobSourceProvider } from '@jobman/shared/src/types';
import { fetchAshbyJobs } from './ashby';
import { fetchGreenhouseJobs } from './greenhouse';
import { fetchLeverJobs } from './lever';
import { fetchPersonioJobs, isPersonioLanguage, type PersonioLanguage } from './personio';
import { fetchRecruiteeJobs } from './recruitee';
import { fetchSmartRecruitersJobs } from './smartrecruiters';
import { fetchUsaJobs } from './usajobs';
import { fetchTheMuseJobs } from './themuse';
import { fetchWorkableJobs } from './workable';
import { upsertImportedJobs } from './shared';

export type ScheduledJobSource = {
  provider: Exclude<JobSourceProvider, 'manual'>;
  sourceKey: string;
  companyName: string;
  careersUrl?: string;
  active?: boolean;
  region?: 'global' | 'eu';
  credentialEnvKey?: string;
  language?: PersonioLanguage;
  keyword?: string;
  location?: string;
  maxPages?: number;
  category?: string;
  level?: string;
};

export function validateScheduledSource(value: unknown): ScheduledJobSource | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<ScheduledJobSource>;
  const providers: ScheduledJobSource['provider'][] = ['greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'recruitee', 'personio', 'usajobs', 'themuse'];
  if (!source.provider || !providers.includes(source.provider)) return null;
  if (!source.sourceKey?.trim() || !source.companyName?.trim()) return null;
  const rawLanguage = (source as { language?: unknown }).language;
  if (source.provider === 'personio' && rawLanguage !== undefined && !isPersonioLanguage(rawLanguage)) return null;
  return {
    provider: source.provider,
    sourceKey: source.sourceKey.trim(),
    companyName: source.companyName.trim(),
    careersUrl: source.careersUrl?.trim() || undefined,
    active: source.active !== false,
    region: source.region === 'eu' ? 'eu' : 'global',
    credentialEnvKey: source.credentialEnvKey?.trim() || undefined,
    language: source.provider === 'personio' && isPersonioLanguage(rawLanguage) ? rawLanguage : undefined,
    keyword: source.keyword?.trim().slice(0, 100) || undefined,
    location: source.location?.trim().slice(0, 100) || undefined,
    maxPages: Number.isInteger(source.maxPages) ? Math.min(5, Math.max(1, Number(source.maxPages))) : undefined,
    category: source.category?.trim().slice(0, 100) || undefined,
    level: source.level?.trim().slice(0, 100) || undefined,
  };
}

export async function fetchScheduledSource(source: ScheduledJobSource) {
  const common = {
    boardToken: source.sourceKey,
    companyName: source.companyName,
    careersUrl: source.careersUrl,
  };

  let jobs;
  switch (source.provider) {
    case 'greenhouse':
      jobs = await fetchGreenhouseJobs(common);
      break;
    case 'lever':
      jobs = await fetchLeverJobs({ ...common, region: source.region });
      break;
    case 'ashby':
      jobs = await fetchAshbyJobs(common);
      break;
    case 'smartrecruiters': {
      jobs = await fetchSmartRecruitersJobs({
        sourceKey: source.sourceKey,
        companyName: source.companyName,
        careersUrl: source.careersUrl,
      });
      break;
    }
    case 'workable':
      jobs = await fetchWorkableJobs({
        sourceKey: source.sourceKey,
        companyName: source.companyName,
        careersUrl: source.careersUrl,
      });
      break;
    case 'recruitee':
      jobs = await fetchRecruiteeJobs({
        sourceKey: source.sourceKey,
        companyName: source.companyName,
        careersUrl: source.careersUrl,
      });
      break;
    case 'personio':
      jobs = await fetchPersonioJobs({
        sourceKey: source.sourceKey,
        companyName: source.companyName,
        careersUrl: source.careersUrl,
        language: source.language,
      });
      break;
    case 'usajobs':
      jobs = await fetchUsaJobs({
        sourceKey: source.sourceKey,
        companyName: source.companyName,
        keyword: source.keyword,
        location: source.location,
      }, { maxPages: source.maxPages });
      break;
    case 'themuse':
      jobs = await fetchTheMuseJobs({
        sourceKey: source.sourceKey,
        companyName: source.companyName,
        category: source.category,
        location: source.location,
        level: source.level,
      }, { maxPages: source.maxPages });
      break;
  }

  return jobs;
}

export async function runScheduledSource(source: ScheduledJobSource) {
  const jobs = await fetchScheduledSource(source);
  return upsertImportedJobs(jobs, {
    provider: source.provider,
    sourceKey: source.sourceKey,
    companyName: source.companyName,
    careersUrl: source.careersUrl,
  });
}
