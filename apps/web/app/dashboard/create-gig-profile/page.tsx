'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import {
  saveGigProfile,
  uploadProfilePhoto,
  getProfile,
  getWorkerGigPreferences,
  saveWorkerGigPreferences,
} from '@/lib/firestore';
import { GIG_CATEGORIES, US_STATES } from '@jobman/shared/src/constants/categories';
import { generateBio } from '@/lib/ai';
import { importFromLinkedIn, isLinkedInConfigured } from '@/lib/linkedin';

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
    serviceArea: '',
    serviceRadiusMiles: '15',
    minimumHourlyTakeHome: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [linkedInPhoto, setLinkedInPhoto] = useState('');
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiWriting, setAiWriting] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  // Prefill when an existing gig profile is being edited
  useEffect(() => {
    if (!user) return;
    Promise.all([getProfile(user.uid), getWorkerGigPreferences(user.uid)]).then(([p, preferences]) => {
      if (!p || p.type !== 'gig') return;
      setEditing(true);
      setForm({
        category: p.category ?? '',
        bio: p.bio ?? '',
        skills: (p.skills ?? []).join(', '),
        hourlyRate: p.hourlyRate ? String(p.hourlyRate) : '',
        location: p.location ?? '',
        availability: (p.availability as any) || 'full-time',
        serviceArea: preferences?.serviceArea ?? '',
        serviceRadiusMiles: preferences ? String(preferences.serviceRadiusMiles) : '15',
        minimumHourlyTakeHome: preferences ? String(preferences.minimumHourlyTakeHome) : '',
      });
      if (p.photoURL) setPhotoPreview(p.photoURL);
    }).catch(() => {});
  }, [user]);

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

  async function handleLinkedInImport() {
    setImporting(true);
    setError('');
    try {
      const li = await importFromLinkedIn();
      if (li.picture) {
        setLinkedInPhoto(li.picture);
        setPhotoFile(null);
        setPhotoPreview(li.picture);
      }
    } catch (err: any) {
      setError(err.message ?? 'LinkedIn import failed.');
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.category) { setError('Please choose a category.'); return; }
    if (!form.bio.trim()) { setError('Please add a short bio.'); return; }
    if (!form.hourlyRate || Number(form.hourlyRate) <= 0) { setError('Please enter a valid hourly rate.'); return; }
    if (!form.location) { setError('Please select your state.'); return; }
    if (!form.serviceArea.trim()) { setError('Please add your main service city.'); return; }
    if (Number(form.serviceRadiusMiles) < 1 || Number(form.serviceRadiusMiles) > 100) { setError('Service radius must be between 1 and 100 miles.'); return; }
    if (!form.minimumHourlyTakeHome || Number(form.minimumHourlyTakeHome) <= 0) { setError('Please add the minimum hourly take-home that makes a gig worthwhile.'); return; }

    setSaving(true);
    setError('');
    try {
      let photoURL = linkedInPhoto || (user.photoURL ?? '');
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
      await saveWorkerGigPreferences(user.uid, {
        serviceArea: form.serviceArea.trim(),
        serviceRadiusMiles: Number(form.serviceRadiusMiles),
        minimumHourlyTakeHome: Number(form.minimumHourlyTakeHome),
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
        <h1 className="text-2xl font-bold text-slate-900">{editing ? 'Edit' : 'Create'} Gig Worker Profile</h1>
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
            <div className="flex flex-wrap gap-2">
              <label className="btn-secondary text-sm cursor-pointer">
                Upload Photo
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
              {isLinkedInConfigured() && (
                <button type="button" onClick={handleLinkedInImport} disabled={importing}
                  className="btn-secondary text-sm !bg-[#0a66c2] !text-white">
                  {importing ? 'Importing…' : 'in Import from LinkedIn'}
                </button>
              )}
            </div>
            {linkedInPhoto && <p className="text-xs text-slate-400 mt-1">Photo imported from LinkedIn ✓</p>}
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

        <fieldset className="rounded-3xl border-2 border-ink bg-acid-100 p-5 shadow-pop-sm">
          <legend className="px-2 font-display text-lg font-bold text-ink">Your “worth leaving the couch” settings</legend>
          <p className="mb-4 text-sm leading-relaxed text-slate-700">
            These stay private. Later, JobMan will use them to skip low-value trips and show your estimated take-home pay.
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="service-area" className="block text-sm font-medium text-slate-700 mb-1">Main service city</label>
              <input
                id="service-area"
                className="input"
                placeholder="e.g. Oakland"
                value={form.serviceArea}
                onChange={e => set('serviceArea', e.target.value)}
                maxLength={120}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="service-radius" className="block text-sm font-medium text-slate-700 mb-1">Travel radius</label>
                <div className="relative">
                  <input
                    id="service-radius"
                    className="input pr-16"
                    type="number"
                    min="1"
                    max="100"
                    value={form.serviceRadiusMiles}
                    onChange={e => set('serviceRadiusMiles', e.target.value)}
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">miles</span>
                </div>
              </div>
              <div>
                <label htmlFor="minimum-take-home" className="block text-sm font-medium text-slate-700 mb-1">Minimum take-home per hour</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    id="minimum-take-home"
                    className="input pl-8"
                    type="number"
                    min="1"
                    max="1000"
                    placeholder="40"
                    value={form.minimumHourlyTakeHome}
                    onChange={e => set('minimumHourlyTakeHome', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        </fieldset>

        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
