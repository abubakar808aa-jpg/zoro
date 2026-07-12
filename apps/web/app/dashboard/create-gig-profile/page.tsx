'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { saveGigProfile, uploadProfilePhoto } from '@/lib/firestore';
import { GIG_CATEGORIES, US_STATES } from '@jobman/shared/src/constants/categories';
import { generateBio } from '@/lib/ai';

export default function CreateGigProfilePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    category: '',
    bio: '',
    skills: '',
    hourlyRate: '',
    location: '',
    availability: 'full-time' as 'full-time' | 'part-time' | 'weekends',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiWriting, setAiWriting] = useState(false);
  const [error, setError] = useState('');

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleAIBio() {
    if (!form.category) { setError('Choose a category first.'); return; }
    setAiWriting(true);
    setError('');
    try {
      const label = GIG_CATEGORIES.find(c => c.id === form.category)?.label ?? form.category;
      const facts = [
        `Trade: ${label}`,
        form.hourlyRate && `Hourly rate: $${form.hourlyRate}`,
        form.location && `Location: ${form.location}`,
        `Availability: ${form.availability}`,
        form.skills.trim() && `Skills: ${form.skills}`,
      ].filter(Boolean).join('. ');
      const result = await generateBio('gig', facts);
      setForm(f => ({
        ...f,
        bio: result.bio,
        skills: f.skills.trim() ? f.skills : result.skills.join(', '),
      }));
    } catch (err: any) {
      setError(err.message ?? 'AI writing failed.');
    } finally {
      setAiWriting(false);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.category) { setError('Please choose a category.'); return; }
    if (!form.bio.trim()) { setError('Please add a short bio.'); return; }
    if (!form.hourlyRate || Number(form.hourlyRate) <= 0) { setError('Please enter a valid hourly rate.'); return; }
    if (!form.location) { setError('Please select your state.'); return; }

    setSaving(true);
    setError('');
    try {
      let photoURL = user.photoURL ?? '';
      if (photoFile) photoURL = await uploadProfilePhoto(user.uid, photoFile);

      await saveGigProfile(user.uid, {
        name: user.displayName ?? user.email ?? 'Worker',
        email: user.email ?? '',
        photoURL,
        bio: form.bio.trim(),
        category: form.category,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        hourlyRate: Number(form.hourlyRate),
        location: form.location,
        availability: form.availability,
      });

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Create Gig Worker Profile</h1>
        <p className="text-slate-500 mt-1">Let employers find you based on your skills.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Photo */}
        <div className="card flex items-center gap-4">
          {photoPreview ? (
            <img src={photoPreview} alt="preview" className="w-16 h-16 rounded-xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">
              {(user?.displayName?.[0] ?? '?').toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Profile Photo</p>
            <label className="btn-secondary text-sm cursor-pointer">
              Upload Photo
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
          <select className="input" value={form.category} onChange={e => set('category', e.target.value)} required>
            <option value="">Select your trade / skill</option>
            {GIG_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
            ))}
          </select>
        </div>

        {/* Bio */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">Bio <span className="text-red-500">*</span></label>
            <button type="button" onClick={handleAIBio} disabled={aiWriting}
              className="text-xs font-semibold text-violet-600 hover:text-violet-700 disabled:opacity-50">
              {aiWriting ? '✨ Writing…' : '✨ Write with AI'}
            </button>
          </div>
          <textarea
            className="input min-h-[100px] resize-none"
            placeholder="Describe your experience, what you offer, and why clients should hire you…"
            value={form.bio}
            onChange={e => set('bio', e.target.value)}
            required
          />
        </div>

        {/* Skills */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Skills <span className="text-slate-400 font-normal">(comma-separated)</span></label>
          <input
            className="input"
            placeholder="e.g. Pipe repair, Water heater install, Drain cleaning"
            value={form.skills}
            onChange={e => set('skills', e.target.value)}
          />
        </div>

        {/* Hourly Rate */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Hourly Rate (USD) <span className="text-red-500">*</span></label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
            <input
              className="input pl-7"
              type="number"
              min="1"
              placeholder="25"
              value={form.hourlyRate}
              onChange={e => set('hourlyRate', e.target.value)}
              required
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">State <span className="text-red-500">*</span></label>
          <select className="input" value={form.location} onChange={e => set('location', e.target.value)} required>
            <option value="">Select your state</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Availability */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Availability</label>
          <div className="flex gap-2 flex-wrap">
            {(['full-time', 'part-time', 'weekends'] as const).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => set('availability', opt)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  form.availability === opt
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-primary-400'
                }`}
              >
                {opt === 'full-time' ? 'Full-Time' : opt === 'part-time' ? 'Part-Time' : 'Weekends'}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Create Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
