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
];
