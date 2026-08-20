import type { JobSourceProvider } from '@jobman/shared/src/types';
import { fetchAshbyJobs } from './ashby';
import { fetchGreenhouseJobs } from './greenhouse';
import { fetchLeverJobs } from './lever';
import { fetchRecruiteeJobs } from './recruitee';
import { fetchSmartRecruitersJobs } from './smartrecruiters';
import { fetchWorkableJobs } from './workable';
import { fetchBambooHrJobs } from './bamboohr';
import { fetchPersonioJobs } from './personio';
import { fetchRemotiveJobs } from './remotive';
import { fetchArbeitnowJobs } from './arbeitnow';
import { upsertImportedJobs } from './shared';

export type ScheduledJobSource = {
  provider: Exclude<JobSourceProvider, 'manual'>;
  sourceKey: string;
  companyName: string;
  careersUrl?: string;
  active?: boolean;
  region?: 'global' | 'eu';
  credentialEnvKey?: string;
};

export function validateScheduledSource(value: unknown): ScheduledJobSource | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<ScheduledJobSource>;
  const providers: ScheduledJobSource['provider'][] = ['greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'recruitee', 'bamboohr', 'personio', 'remotive', 'arbeitnow'];
  if (!source.provider || !providers.includes(source.provider)) return null;
  if (!source.sourceKey?.trim() || !source.companyName?.trim()) return null;
  return {
    provider: source.provider,
    sourceKey: source.sourceKey.trim(),
    companyName: source.companyName.trim(),
    careersUrl: source.careersUrl?.trim() || undefined,
    active: source.active !== false,
    region: source.region === 'eu' ? 'eu' : 'global',
    credentialEnvKey: source.credentialEnvKey?.trim() || undefined,
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
    case 'bamboohr':
      jobs = await fetchBambooHrJobs(common);
      break;
    case 'personio':
      jobs = await fetchPersonioJobs({
        sourceKey: source.sourceKey,
        companyName: source.companyName,
        careersUrl: source.careersUrl,
      });
      break;
    case 'remotive':
      jobs = await fetchRemotiveJobs({
        companyName: source.companyName,
        sourceKey: source.sourceKey,
        careersUrl: source.careersUrl,
      });
      break;
    case 'arbeitnow':
      jobs = await fetchArbeitnowJobs({
        companyName: source.companyName,
        sourceKey: source.sourceKey,
        careersUrl: source.careersUrl,
      });
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
