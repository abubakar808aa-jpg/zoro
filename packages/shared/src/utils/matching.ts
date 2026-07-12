import type { JobListing, GigProfile, ProfessionalProfile } from '../types';

// Simple heuristic match score between a job and a worker profile (no AI).
export function scoreJobMatch(
  job: Pick<JobListing, 'category' | 'location' | 'remote' | 'skills'>,
  profile: GigProfile | ProfessionalProfile
): number {
  let score = 0;
  if (job.category === profile.category) score += 3;
  if (job.location === profile.location) score += 2;
  if (job.remote) score += 2;
  const profileSkills = new Set(profile.skills.map(s => s.trim().toLowerCase()));
  let overlap = 0;
  for (const skill of job.skills) {
    if (profileSkills.has(skill.trim().toLowerCase())) overlap++;
  }
  score += Math.min(overlap, 4);
  return score;
}
