import type { ScheduledJobSource } from './run-source';

export const STARTER_SOURCES: ScheduledJobSource[] = [
  {
    provider: 'greenhouse',
    sourceKey: 'figma',
    companyName: 'Figma',
    careersUrl: 'https://www.figma.com/careers/',
  },
  {
    provider: 'lever',
    sourceKey: 'palantir',
    companyName: 'Palantir',
    careersUrl: 'https://www.palantir.com/careers/',
  },
  {
    provider: 'ashby',
    sourceKey: 'ramp',
    companyName: 'Ramp',
    careersUrl: 'https://ramp.com/careers',
  },
  {
    provider: 'smartrecruiters',
    sourceKey: 'smartrecruiters',
    companyName: 'SmartRecruiters',
    careersUrl: 'https://careers.smartrecruiters.com/SmartRecruiters',
  },
  {
    provider: 'workable',
    sourceKey: 'commonapp',
    companyName: 'Common App',
    careersUrl: 'https://apply.workable.com/commonapp/',
  },
  {
    provider: 'recruitee',
    sourceKey: 'resourcefultalentgroup',
    companyName: 'Resourceful Talent Group',
    careersUrl: 'https://resourcefultalentgroup.recruitee.com/',
  },
  // Multi-company aggregators: free, no-auth, no board token required. One
  // source imports remote roles from many employers (each job keeps its own
  // employer name). Per-company ATS boards (bamboohr, personio) are added via
  // CONNECTOR_SOURCES_JSON or the jobSources collection — see docs/README.md.
  {
    provider: 'remotive',
    sourceKey: 'remotive',
    companyName: 'Remotive',
    careersUrl: 'https://remotive.com/',
  },
  {
    provider: 'arbeitnow',
    sourceKey: 'arbeitnow',
    companyName: 'Arbeitnow',
    careersUrl: 'https://www.arbeitnow.com/',
  },
];
