'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { saveProfessionalProfile, uploadProfilePhoto, getProfile } from '@/lib/firestore';
import { PROFESSIONAL_CATEGORIES, US_STATES } from '@jobman/shared/src/constants/categories';
import type { Education, Experience } from '@jobman/shared/src/types';
import { generateBio } from '@/lib/ai';
import { importFromLinkedIn, isLinkedInConfigured } from '@/lib/linkedin';

export default function CreateProProfilePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    title: '',
    category: '',
    bio: '',
    skills: '',
    experienceYears: '',
    location: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [linkedInPhoto, setLinkedInPhoto] = useState('');
  const [importing, setImporting] = useState(false);
  const [education, setEducation] = useState<Education[]>([
    { school: '', degree: '', field: '', from: '', to: String(new Date().getFullYear()) },
  ]);
  const [experience, setExperience] = useState<Experience[]>([
    { title: '', company: '', from: String(new Date().getFullYear() - 1), to: '', current: false, description: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [aiWriting, setAiWriting] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  // Prefill when an existing professional profile is being edited
  useEffect(() => {
    if (!user) return;
    getProfile(user.uid).then(p => {
      if (!p || p.type !== 'professional') return;
      setEditing(true);
      setForm({
        title: p.title ?? '',
        category: p.category ?? '',
        bio: p.bio ?? '',
        skills: (p.skills ?? []).join(', '),
        experienceYears: p.experienceYears ? String(p.experienceYears) : '',
        location: p.location ?? '',
      });
      if (p.education?.length) setEducation(p.education);
      if (p.experience?.length) setExperience(p.experience);
      if (p.photoURL) setPhotoPreview(p.photoURL);
    }).catch(() => {});
  }, [user]);

  function setField(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleAIBio() {
    if (!form.title.trim()) { setError('Enter your job title first.'); return; }
    setAiWriting(true);
    setError('');
    try {
      const label = PROFESSIONAL_CATEGORIES.find(c => c.id === form.category)?.label ?? form.category;
      const facts = [
        `Title: ${form.title}`,
        label && `Industry: ${label}`,
        form.experienceYears && `Years of experience: ${form.experienceYears}`,
        form.location && `Location: ${form.location}`,
        form.skills.trim() && `Skills: ${form.skills}`,
      ].filter(Boolean).join('. ');
      const result = await generateBio('professional', facts);
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

  function addEducation() {
    setEducation(ed => [...ed, { school: '', degree: '', field: '', from: '', to: String(new Date().getFullYear()) }]);
  }

  function updateEducation(index: number, field: keyof Education, value: string | number) {
    setEducation(ed => ed.map((e, i) => i === index ? { ...e, [field]: value } : e));
  }

  function removeEducation(index: number) {
    setEducation(ed => ed.filter((_, i) => i !== index));
  }

  function addExperience() {
    setExperience(ex => [...ex, { title: '', company: '', from: String(new Date().getFullYear()), to: '', current: false, description: '' }]);
  }

  function updateExperience(index: number, field: keyof Experience, value: any) {
    setExperience(ex => ex.map((e, i) => i === index ? { ...e, [field]: value } : e));
  }

  function removeExperience(index: number) {
    setExperience(ex => ex.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.title.trim()) { setError('Please enter your job title.'); return; }
    if (!form.category) { setError('Please choose a category.'); return; }
    if (!form.bio.trim()) { setError('Please add a short bio.'); return; }
    if (!form.experienceYears || Number(form.experienceYears) < 0) { setError('Please enter your years of experience.'); return; }
    if (!form.location) { setError('Please select your state.'); return; }

    setSaving(true);
    setError('');
    try {
      let photoURL = linkedInPhoto || (user.photoURL ?? '');
      if (photoFile) photoURL = await uploadProfilePhoto(user.uid, photoFile);

      const validEducation = education.filter(e => e.degree.trim() && e.school.trim());
      const validExperience = experience.filter(e => e.title.trim() && e.company.trim());

      await saveProfessionalProfile(user.uid, {
        name: user.displayName ?? user.email ?? 'Professional',
        email: user.email ?? '',
        photoURL,
        bio: form.bio.trim(),
        title: form.title.trim(),
        category: form.category,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        experienceYears: Number(form.experienceYears),
        location: form.location,
        education: validEducation,
        experience: validExperience,
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
        <h1 className="text-2xl font-bold text-slate-900">{editing ? 'Edit' : 'Create'} Professional Profile</h1>
        <p className="text-slate-500 mt-1">Showcase your credentials and get hired for full-time roles.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Job Title <span className="text-red-500">*</span></label>
          <input
            className="input"
            placeholder="e.g. Senior Software Engineer, CPA, Attorney"
            value={form.title}
            onChange={e => setField('title', e.target.value)}
            required
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Industry <span className="text-red-500">*</span></label>
          <select className="input" value={form.category} onChange={e => setField('category', e.target.value)} required>
            <option value="">Select your industry</option>
            {PROFESSIONAL_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
            ))}
          </select>
        </div>

        {/* Bio */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">Professional Summary <span className="text-red-500">*</span></label>
            <button type="button" onClick={handleAIBio} disabled={aiWriting}
              className="text-xs font-semibold text-violet-600 hover:text-violet-700 disabled:opacity-50">
              {aiWriting ? '✨ Writing…' : '✨ Write with AI'}
            </button>
          </div>
          <textarea
            className="input min-h-[110px] resize-none"
            placeholder="Describe your background, expertise, and career goals…"
            value={form.bio}
            onChange={e => setField('bio', e.target.value)}
            required
          />
        </div>

        {/* Skills */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Skills <span className="text-slate-400 font-normal">(comma-separated)</span></label>
          <input
            className="input"
            placeholder="e.g. React, TypeScript, AWS, Team Leadership"
            value={form.skills}
            onChange={e => setField('skills', e.target.value)}
          />
        </div>

        {/* Experience years + location */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Years of Experience <span className="text-red-500">*</span></label>
            <input
              className="input"
              type="number"
              min="0"
              max="60"
              placeholder="5"
              value={form.experienceYears}
              onChange={e => setField('experienceYears', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">State <span className="text-red-500">*</span></label>
            <select className="input" value={form.location} onChange={e => setField('location', e.target.value)} required>
              <option value="">Select state</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Education */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-700">Education</label>
            <button type="button" onClick={addEducation} className="text-sm text-primary-600 hover:text-primary-700 font-medium">+ Add</button>
          </div>
          <div className="space-y-3">
            {education.map((ed, i) => (
              <div key={i} className="card space-y-3">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Education {i + 1}</p>
                  {education.length > 1 && (
                    <button type="button" onClick={() => removeEducation(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                  )}
                </div>
                <input className="input" placeholder="Degree (e.g. B.S.)" value={ed.degree}
                  onChange={e => updateEducation(i, 'degree', e.target.value)} />
                <input className="input" placeholder="Field of study (e.g. Computer Science)" value={ed.field}
                  onChange={e => updateEducation(i, 'field', e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <input className="input" placeholder="Institution" value={ed.school}
                    onChange={e => updateEducation(i, 'school', e.target.value)} />
                  <input className="input" type="number" placeholder="Year" value={ed.to}
                    onChange={e => updateEducation(i, 'to', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Work Experience */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-700">Work Experience</label>
            <button type="button" onClick={addExperience} className="text-sm text-primary-600 hover:text-primary-700 font-medium">+ Add</button>
          </div>
          <div className="space-y-3">
            {experience.map((ex, i) => (
              <div key={i} className="card space-y-3">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Position {i + 1}</p>
                  {experience.length > 1 && (
                    <button type="button" onClick={() => removeExperience(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                  )}
                </div>
                <input className="input" placeholder="Job Title" value={ex.title}
                  onChange={e => updateExperience(i, 'title', e.target.value)} />
                <input className="input" placeholder="Company" value={ex.company}
                  onChange={e => updateExperience(i, 'company', e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <input className="input" type="number" placeholder="Start Year" value={ex.from}
                    onChange={e => updateExperience(i, 'from', e.target.value)} />
                  {!ex.current && (
                    <input className="input" type="number" placeholder="End Year" value={ex.to}
                      onChange={e => updateExperience(i, 'to', e.target.value)} />
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={ex.current}
                    onChange={e => updateExperience(i, 'current', e.target.checked)}
                    className="rounded border-slate-300" />
                  I currently work here
                </label>
                <textarea className="input resize-none min-h-[60px]" placeholder="Brief description (optional)"
                  value={ex.description} onChange={e => updateExperience(i, 'description', e.target.value)} />
              </div>
            ))}
          </div>
        </div>

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
