import { NextResponse } from 'next/server';
import { fetchOfficialNews } from '@/lib/news-ingestion/news';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await fetchOfficialNews();
  const failed = result.sources.filter(source => source.status === 'failed').length;
  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'X-JobMan-News-Health': failed ? `degraded-${failed}` : 'healthy',
    },
  });
}
