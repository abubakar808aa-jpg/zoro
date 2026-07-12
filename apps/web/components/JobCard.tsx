'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { JobListing } from '@jobman/shared/src/types';

export default function JobCard({ job }: { job: JobListing }) {
  const posted = job.createdAt ? formatDistanceToNow(new Date((job.createdAt as any).seconds * 1000), { addSuffix: true }) : '';

  const typeConfig: Record<string, { color: string; label: string; bar: string }> = {
    fulltime:  { color: 'bg-emerald-100 text-emerald-700', label: 'Full-Time',  bar: 'from-emerald-400 to-teal-400' },
    parttime:  { color: 'bg-yellow-100 text-yellow-700',   label: 'Part-Time',  bar: 'from-yellow-400 to-amber-400' },
    gig:       { color: 'bg-orange-100 text-orange-700',   label: 'Gig',        bar: 'from-orange-400 to-amber-400' },
    contract:  { color: 'bg-violet-100 text-violet-700',   label: 'Contract',   bar: 'from-violet-500 to-primary-500' },
  };

  const cfg = typeConfig[job.type] ?? { color: 'bg-slate-100 text-slate-600', label: job.type, bar: 'from-slate-300 to-slate-400' };

  return (
    <Link href={`/jobs/${job.id}`} className="block bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all overflow-hidden group">
      {/* Accent bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${cfg.bar}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-lg leading-tight group-hover:text-primary-600 transition-colors">{job.title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              🏢 {job.postedByName} · 📍 {job.location}{job.remote ? ' · 🏠 Remote OK' : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className={`badge font-semibold ${cfg.color}`}>{cfg.label}</span>
            {job.salary && (
              <span className="text-sm font-bold text-slate-900">
                ${job.salary.min.toLocaleString()}–${job.salary.max.toLocaleString()}
                <span className="text-xs font-normal text-slate-400">/{job.salary.period === 'hourly' ? 'hr' : 'yr'}</span>
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-slate-500 mt-3 line-clamp-2 leading-relaxed">{job.description}</p>

        {job.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {job.skills.slice(0, 5).map(s => (
              <span key={s} className="badge bg-slate-100 text-slate-600 text-xs">{s}</span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50 text-xs text-slate-400">
          <span>👥 {job.applicantCount} applicant{job.applicantCount !== 1 ? 's' : ''}</span>
          <span>{posted}</span>
        </div>
      </div>
    </Link>
  );
}
