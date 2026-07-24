'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { getOpenReports } from '@/lib/firestore';
import { adminAction } from '@/lib/admin';
import type { Report } from '@jobman/shared/src/types';

const TARGET_LABEL: Record<Report['targetType'], string> = {
  job: '📋 Job',
  user: '👤 User',
  activity: '📡 Feed post',
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getOpenReports()
      .then(setReports)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleResolve(report: Report) {
    setError('');
    try {
      await adminAction({ action: 'resolveReport', reportId: report.id });
      setReports(list => list.filter(r => r.id !== report.id));
    } catch (err: any) { setError(err.message); }
  }

  async function handleRemoveContent(report: Report) {
    if (!window.confirm('Remove the reported content permanently?')) return;
    setError('');
    try {
      if (report.targetType === 'job') {
        await adminAction({ action: 'deleteJob', jobId: report.targetId });
      } else if (report.targetType === 'activity') {
        await adminAction({ action: 'deleteActivity', activityId: report.targetId });
      } else {
        const reason = window.prompt('Ban this user? Enter a reason:');
        if (reason === null) return;
        await adminAction({ action: 'banUser', uid: report.targetId, reason });
      }
      await adminAction({ action: 'resolveReport', reportId: report.id });
      setReports(list => list.filter(r => r.id !== report.id));
    } catch (err: any) { setError(err.message); }
  }

  if (loading) return <div className="card animate-pulse h-64" />;

  return (
    <div>
      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
      {reports.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">✅</div>
          <p className="font-medium">No open reports. All clear!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="card !p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge bg-red-50 text-red-600 text-xs">{TARGET_LABEL[r.targetType]}</span>
                    <span className="text-xs text-slate-400">
                      {r.createdAt ? formatDistanceToNow(new Date((r.createdAt as any).seconds * 1000), { addSuffix: true }) : ''}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">&ldquo;{r.reason}&rdquo;</p>
                  {r.targetType === 'job' && (
                    <Link href={`/jobs/${r.targetId}`} className="text-xs text-primary-600 hover:underline">View job →</Link>
                  )}
                  {r.targetType === 'user' && (
                    <Link href={`/profile/${r.targetId}`} className="text-xs text-primary-600 hover:underline">View profile →</Link>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button type="button" onClick={() => handleResolve(r)}
                    className="text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-full transition-colors">
                    ✓ Dismiss
                  </button>
                  <button type="button" onClick={() => handleRemoveContent(r)}
                    className="text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full transition-colors">
                    {r.targetType === 'user' ? 'Ban user' : 'Remove content'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
