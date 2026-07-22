import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { GIG_CATEGORIES, PROFESSIONAL_CATEGORIES, US_STATES } from '@jobman/shared/src/constants/categories';
import { verifyFirebaseToken } from '@/lib/verify-token';
import { makeRateLimiter } from '@/lib/rate-limit';

export const maxDuration = 30;

const MODEL = process.env.AI_MODEL ?? 'claude-haiku-4-5';

const checkRateLimit = makeRateLimiter(20, 60_000);

const CATEGORY_IDS = [...GIG_CATEGORIES, ...PROFESSIONAL_CATEGORIES]
  .map(c => `${c.id} (${c.label})`).join(', ');

// Claude sometimes wraps JSON in prose or code fences — extract the first {...} block.
function extractJSON(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI returned no JSON');
  return JSON.parse(text.slice(start, end + 1));
}

function buildPrompt(task: string, p: any): string {
  switch (task) {
    case 'job-description':
      return `You are helping a US employer write a job posting for JobMan, a job/gig marketplace.

Employer's rough description: "${p.brief}"

Valid category ids: ${CATEGORY_IDS}
Valid US states: ${US_STATES.join(', ')}

Write a complete, professional job posting. Infer the best category, job type, and state if mentioned. Suggest a realistic US pay range for this kind of work.

Return ONLY JSON:
{
  "title": "concise job title",
  "description": "2-4 paragraph professional description",
  "requirements": ["3-6 requirements, one per item"],
  "skills": ["4-8 short skill tags"],
  "category": "one valid category id, or empty string",
  "type": "fulltime | parttime | contract | gig",
  "location": "a valid US state name if mentioned, else empty string",
  "remote": true or false,
  "salaryMin": number or null,
  "salaryMax": number or null,
  "salaryPeriod": "hourly" or "annual"
}`;

    case 'bio':
      return `Write a first-person profile bio for a ${p.profileType === 'gig' ? 'skilled gig/trade worker' : 'degree-holding professional'} on JobMan, a US job marketplace. It should sound genuine and confident, not salesy.

What we know about them:
${p.facts}

Return ONLY JSON:
{
  "bio": "2-3 sentence first-person bio",
  "skills": ["4-8 short skill tags relevant to their work"]
}`;

    case 'cover-letter':
      return `Write a short, genuine cover letter (3 short paragraphs max, no address headers, no "Dear Sir/Madam") for this job application on JobMan.

Job title: ${p.jobTitle}
Job description: ${p.jobDescription}
${p.requirements?.length ? `Requirements: ${p.requirements.join('; ')}` : ''}
Applicant name: ${p.applicantName}
${p.applicantBackground ? `Applicant background: ${p.applicantBackground}` : ''}

Sound like a real person, warm and direct. End with the applicant's name.

Return ONLY JSON: { "coverLetter": "the letter text with \\n between paragraphs" }`;

    case 'reply-suggestions':
      return `You are suggesting quick replies in a chat between a worker and an employer on JobMan, a US job marketplace. Here is the recent conversation ("me" is the person replying):

${p.messages.map((m: any) => `${m.sender}: ${m.text}`).join('\n')}

Suggest 3 short, natural replies "me" could send next. Each under 15 words. Vary the tone (e.g. one accepting/positive, one asking a question, one scheduling/next-step).

Return ONLY JSON: { "suggestions": ["reply 1", "reply 2", "reply 3"] }`;

    case 'parse-search':
      return `Convert this job search query into structured filters for JobMan, a US job marketplace.

Query: "${p.query}"

Valid job types: fulltime, parttime, contract, gig
Valid US states: ${US_STATES.join(', ')}

Return ONLY JSON:
{
  "type": "one valid type or empty string",
  "location": "a valid US state name or empty string",
  "remote": true if they explicitly want remote else false,
  "keywords": ["1-4 lowercase keywords for text matching, e.g. job titles or trades"],
  "maxHourly": number or null (if they mention a max hourly rate)
}`;

    default:
      throw new Error(`Unknown task: ${task}`);
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes('paste-your')) {
    return NextResponse.json(
      { error: 'AI is not configured. Add ANTHROPIC_API_KEY to apps/web/.env.local and restart the dev server.' },
      { status: 503 }
    );
  }

  let uid: string;
  try {
    uid = await verifyFirebaseToken(req.headers.get('authorization'));
  } catch {
    return NextResponse.json({ error: 'Sign in to use AI features.' }, { status: 401 });
  }
  if (!checkRateLimit(uid)) {
    return NextResponse.json({ error: 'Too many AI requests — try again in a minute.' }, { status: 429 });
  }

  try {
    const { task, payload } = await req.json();
    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPrompt(task, payload ?? {}) }],
    });

    const text = msg.content.find(b => b.type === 'text')?.text ?? '';
    return NextResponse.json(extractJSON(text));
  } catch (err: any) {
    console.error('[ai route]', err);
    return NextResponse.json({ error: err.message ?? 'AI request failed' }, { status: 500 });
  }
}
