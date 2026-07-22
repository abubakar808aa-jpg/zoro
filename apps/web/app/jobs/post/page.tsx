'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createJob } from '@/lib/firestore';
import { generateJobPosting } from '@/lib/ai';
import { useAuth } from '@/components/AuthProvider';
import { GIG_CATEGORIES, PROFESSIONAL_CATEGORIES, US_STATES } from '@jobman/shared/src/constants/categories';
import { GEN_Z_TAGS, type GenZTag } from '@jobman/shared/src/types';

const ALL_CATEGORIES = [...GIG_CATEGORIES, ...PROFESSIONAL_CATEGORIES];

export default function PostJobPage() {
  const { user, accountType } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    title: '', description: '', type: 'fulltime', category: '',
    location: '', remote: false,
    salaryMin: '', salaryMax: '', salaryPeriod: 'annual',
    skills: '', requirements: '',
  });
  const [genZTags, setGenZTags] = useState<GenZTag[]>([]);

  function toggleTag(tag: GenZTag) {
    setGenZTags(tags => tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]);
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [brief, setBrief] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleAIWrite() {
    if (!brief.trim()) { setAiError('Describe the job in a sentence or two first.'); return; }
    setAiLoading(true); setAiError('');
    try {
      const g = await generateJobPosting(brief.trim());
      setForm(f => ({
        ...f,
        title: g.title || f.title,
        description: g.description || f.description,
        requirements: g.requirements?.join('\n') || f.requirements,
        skills: g.skills?.join(', ') || f.skills,
        category: g.category || f.category,
        type: g.type || f.type,
        location: g.location || f.location,
        remote: g.remote ?? f.remote,
        salaryMin: g.salaryMin != null ? String(g.salaryMin) : f.salaryMin,
        salaryMax: g.salaryMax != null ? String(g.salaryMax) : f.salaryMax,
        salaryPeriod: g.salaryPeriod || f.salaryPeriod,
      }));
    } catch (err: any) {
      setAiError(err.message);
    } finally { setAiLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { router.push('/sign-in'); return; }
    setLoading(true); setError('');
    try {
      const id = await createJob({
        title: form.title,
        description: form.description,
        type: form.type as any,
        category: form.category,
        location: form.location,
        remote: form.remote,
        salary: form.salaryMin && form.salaryMax ? {
          min: Number(form.salaryMin), max: Number(form.salaryMax), period: form.salaryPeriod as any,
        } : undefined,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        requirements: form.requirements.split('\n').map(r => r.trim()).filter(Boolean),
        postedBy: user.uid,
        postedByName: user.displayName ?? user.email ?? 'Anonymous',
        postedByPhoto: user.photoURL ?? '',
        status: 'open',
        genZTags,
      });
      router.push(`/jobs/${id}`);
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  if (!user) return (
    <div className="text-center py-20">
      <p className="text-slate-500 mb-4">You must be signed in to post a job.</p>
      <a href="/sign-in" className="btn-primary">Sign In</a>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Post a Job</h1>
      <p className="text-slate-500 mb-8">Find the perfect candidate for your role — free in v1.</p>

      {/* AI Assist */}
      <div className="mb-6 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-primary-50 p-5">
        <p className="font-semibold text-slate-900 flex items-center gap-2">✨ Write it with AI</p>
        <p className="text-sm text-slate-500 mt-0.5 mb-3">Describe the job in your own words — AI fills out the whole form below.</p>
        <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={2} className="input resize-none"
          placeholder="e.g. Need a plumber for a bathroom remodel in Dallas, weekends, about 2 weeks of work" />
        {aiError && <p className="text-sm text-red-600 mt-2">{aiError}</p>}
        <button type="button" onClick={handleAIWrite} disabled={aiLoading}
          className="btn-primary text-sm mt-3 disabled:opacity-50">
          {aiLoading ? '✨ Writing…' : '✨ Generate Job Posting'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Job Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} required className="input" placeholder="e.g. Senior Software Engineer" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Job Type *</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} className="input">
              <option value="fulltime">Full-Time</option>
              <option value="parttime">Part-Time</option>
              <option value="contract">Contract</option>
              <option value="gig">Gig / One-Time</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} required className="input">
              <option value="">Select category</option>
              <optgroup label="Gig / Trade">
                {GIG_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </optgroup>
              <optgroup label="Professional">
                {PROFESSIONAL_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </optgroup>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Location *</label>
          <select value={form.location} onChange={e => set('location', e.target.value)} required className="input">
            <option value="">Select state</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-2 mt-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={form.remote} onChange={e => set('remote', e.target.checked)} className="rounded" />
            Remote / hybrid OK
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">What makes this job a vibe? <span className="text-slate-400 font-normal">(these attract way more applicants)</span></label>
          <div className="flex flex-wrap gap-2 mt-1">
            {GEN_Z_TAGS.map(t => (
              <button key={t.id} type="button" onClick={() => toggleTag(t.id)}
                className={`badge px-3 py-1.5 text-sm font-semibold cursor-pointer transition-colors ${genZTags.includes(t.id) ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Salary / Pay Range</label>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">$</span>
            <input type="number" value={form.salaryMin} onChange={e => set('salaryMin', e.target.value)} className="input" placeholder="Min" />
            <span className="text-slate-400">–</span>
            <input type="number" value={form.salaryMax} onChange={e => set('salaryMax', e.target.value)} className="input" placeholder="Max" />
            <select value={form.salaryPeriod} onChange={e => set('salaryPeriod', e.target.value)} className="input w-32">
              <option value="annual">/ year</option>
              <option value="hourly">/ hour</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Job Description *</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} required rows={6}
            className="input resize-none" placeholder="Describe the role, responsibilities, and what you're looking for…" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Requirements <span className="text-slate-400 font-normal">(one per line)</span></label>
          <textarea value={form.requirements} onChange={e => set('requirements', e.target.value)} rows={4}
            className="input resize-none" placeholder="Bachelor's degree&#10;3+ years experience&#10;Valid driver's license" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Skills <span className="text-slate-400 font-normal">(comma-separated)</span></label>
          <input value={form.skills} onChange={e => set('skills', e.target.value)} className="input" placeholder="Python, React, Communication, Leadership" />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full text-base py-3">
          {loading ? 'Posting…' : 'Post Job'}
        </button>
      </form>
    </div>
  );
}
