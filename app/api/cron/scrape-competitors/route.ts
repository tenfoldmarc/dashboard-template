import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const COMPETITOR_HANDLES = [
  'noevarner.ai',
  'chase.h.ai',
  'agentic.james',
  'cooper.simson',
  'leadgenman',
  'mavgpt',
  'nicholas.puru',
  'albert.olgaard',
  'justyn.ai',
  'mattganzak',
  'drcintas',
  'showtoolsai',
];

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      return NextResponse.json({ error: 'APIFY_API_TOKEN not set' }, { status: 500 });
    }

    // Support single handle parameter for granular control
    const { searchParams } = new URL(request.url);
    const singleHandle = searchParams.get('handle');

    const handles = singleHandle ? [singleHandle] : (() => {
      const batch = searchParams.get('batch');
      if (batch !== null) {
        const batchNum = parseInt(batch);
        return COMPETITOR_HANDLES.slice(batchNum * 2, batchNum * 2 + 2);
      }
      return COMPETITOR_HANDLES;
    })();

    if (handles.length === 0) {
      return NextResponse.json({ success: true, inserted: 0, message: 'No handles' });
    }

    const supabase = createAdminClient();
    let totalInserted = 0;

    // Scrape all handles in a single Apify run (multi-URL is faster than sequential)
    const directUrls = handles.map(h => `https://www.instagram.com/${h}/`);

    try {
      const runRes = await fetch(
        'https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=' + apifyToken,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            directUrls,
            resultsType: 'posts',
            resultsLimit: 5,
          }),
        }
      );

      if (!runRes.ok) {
        return NextResponse.json({ error: 'Apify scrape failed', status: runRes.status }, { status: 500 });
      }

      const posts = await runRes.json();

      for (const post of posts) {
        const ownerHandle = post.ownerUsername ? `@${post.ownerUsername}` : '';
        const { error } = await supabase.from('competitor_posts').upsert(
          {
            handle: ownerHandle,
            content: (post.caption || '').slice(0, 500),
            likes: post.likesCount || 0,
            shares: post.sharesCount || 0,
            views: post.videoViewCount || post.videoPlayCount || 0,
            post_url: post.url || '',
            thumbnail_url: post.displayUrl || '',
            scraped_at: new Date().toISOString(),
          },
          { onConflict: 'post_url' }
        );

        if (!error) totalInserted++;
      }
    } catch {
      // Apify timeout or error
    }

    return NextResponse.json({ success: true, inserted: totalInserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
