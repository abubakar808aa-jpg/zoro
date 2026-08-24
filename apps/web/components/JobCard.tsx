'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { logInteraction } from '@/lib/analytics';
import { normalizeJobDescription } from '@/lib/job-description';
import { GEN_Z_TAGS, type JobListing } from '@jobman/shared/src/types';

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date(Number((value as { seconds: number }).seconds) * 1000);
  }
  const parsed = new Date(String(value || ''));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function JobCard({ job, featured = false }: { job: JobListing; featured?: boolean }) {
  const [trackingNotice, setTrackingNotice] = useState('');
  const freshnessDate = asDate(job.isImported ? job.lastSeenAt : job.createdAt);
  const freshness = freshnessDate ? formatDistanceToNow(freshnessDate, { addSuffix: true }) : '';
  const description = normalizeJobDescription(job.description);

  const typeConfig: Record<string, { color: string; label: string; bar: string }> = {
    fulltime:  { color: 'bg-acid-200 text-ink',       label: 'Full-Time',  bar: 'from-acid-400 to-emerald-400' },
    parttime:  { color: 'bg-yellow-100 text-ink',     label: 'Part-Time',  bar: 'from-yellow-400 to-amber-400' },
    gig:       { color: 'bg-pink-100 text-accent-600', label: 'Gig',       bar: 'from-accent-400 to-orange-400' },
    contract:  { color: 'bg-primary-100 text-primary-700', label: 'Contract', bar: 'from-violet-500 to-accent-400' },
  };

  const cfg = typeConfig[job.type] ?? { color: 'bg-slate-100 text-slate-600', label: job.type, bar: 'from-slate-300 to-slate-400' };
  const sourceLabel = job.sourceProvider
    ? ({ greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby', smartrecruiters: 'SmartRecruiters', workable: 'Workable', recruitee: 'Recruitee', personio: 'Personio', manual: 'JobMan' } as const)[job.sourceProvider]
    : 'JobMan';
  const isExternal = Boolean(job.isImported && job.applyUrl);
  const cardClassName = `block bg-white rounded-3xl border-2 border-ink hover:-translate-y-1 transition-all overflow-hidden group ${featured ? 'shadow-pop-lime' : 'shadow-pop-sm hover:shadow-pop'}`;
  const cardContent = (
    <>
      {featured ? (
        <div className="h-7 w-full bg-acid-300 border-b-2 border-ink flex items-center px-4">
          <span className="text-xs font-display font-bold text-ink tracking-wide">⚡ FEATURED</span>
        </div>
      ) : (
        <div className={`h-2 w-full bg-gradient-to-r ${cfg.bar} border-b-2 border-ink`} />
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-ink text-lg leading-tight group-hover:text-primary-600 transition-colors">{job.title}</h3>
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

        <p className="text-sm text-slate-500 mt-3 line-clamp-2 leading-relaxed">{description}</p>

        {((job.genZTags?.length ?? 0) > 0 || job.skills?.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {job.genZTags?.map(tag => {
              const t = GEN_Z_TAGS.find(g => g.id === tag);
              return t ? (
                <span key={tag} className="badge bg-primary-100 text-primary-700 text-xs border border-primary-200">
                  {t.emoji} {t.label}
                </span>
              ) : null;
            })}
            {job.skills?.slice(0, 5).map(s => (
              <span key={s} className="badge bg-slate-100 text-slate-600 text-xs">{s}</span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50 text-xs text-slate-400">
          <span className={job.isImported ? 'font-bold text-primary-700' : ''}>
            {job.isImported ? `Apply on ${job.postedByName} site ↗` : `👥 ${job.applicantCount} applicant${job.applicantCount !== 1 ? 's' : ''}`}
          </span>
          <span>{job.isImported ? `Checked ${freshness}` : freshness}</span>
        </div>
        {job.isImported && <p className="mt-2 text-[11px] text-slate-400">Found via {sourceLabel} · Opens the employer’s original listing</p>}
        {trackingNotice && (
          <p role="status" aria-live="polite" className="mt-2 text-xs font-semibold text-amber-700">
            {trackingNotice}
          </p>
        )}
      </div>
    </>
  );

  if (isExternal) {
    return (
      <a
        href={job.applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => logInteraction(
          { type: 'job_apply_click', jobId: job.id },
          () => setTrackingNotice('The employer page opened, but our click counter took a coffee break.'),
        )}
        className={cardClassName}
        aria-label={`Apply for ${job.title} on ${job.postedByName}'s website`}
      >
        {cardContent}
      </a>
    );
  }

  return <Link href={`/jobs/${job.id}`} className={cardClassName}>{cardContent}</Link>;
}
