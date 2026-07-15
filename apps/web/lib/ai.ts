// Client helpers for the AI API route. All calls go through /api/ai so the
// Anthropic API key never leaves the server.

import { auth } from './firebase';

async function askAI<T>(task: string, payload: object): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in to use AI features.');

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ task, payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'AI request failed');
  return data as T;
}

export type GeneratedJob = {
  title: string;
  description: string;
  requirements: string[];
  skills: string[];
  category: string;
  type: 'fulltime' | 'parttime' | 'contract' | 'gig';
  location: string;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: 'hourly' | 'annual';
};

export function generateJobPosting(brief: string) {
  return askAI<GeneratedJob>('job-description', { brief });
}

export function generateBio(profileType: 'gig' | 'professional', facts: string) {
  return askAI<{ bio: string; skills: string[] }>('bio', { profileType, facts });
}

export function generateCoverLetter(p: {
  jobTitle: string;
  jobDescription: string;
  requirements?: string[];
  applicantName: string;
  applicantBackground?: string;
}) {
  return askAI<{ coverLetter: string }>('cover-letter', p);
}

export function suggestReplies(messages: { sender: 'me' | 'them'; text: string }[]) {
  return askAI<{ suggestions: string[] }>('reply-suggestions', { messages });
}

export type ParsedSearch = {
  type: string;
  location: string;
  remote: boolean;
  keywords: string[];
  maxHourly: number | null;
};

export function parseJobSearch(query: string) {
  return askAI<ParsedSearch>('parse-search', { query });
}
