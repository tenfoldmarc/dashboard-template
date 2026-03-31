import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface IGMediaItem {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

interface IGInsight {
  name: string;
  values: { value: number }[];
}

async function fetchInsights(mediaId: string, mediaType: string, token: string) {
  const result = { views: 0, shares: 0, saves: 0, reach: 0 };
  try {
    const isVideo = mediaType === 'VIDEO' || mediaType === 'REEL';
    const metrics = isVideo
      ? 'reach,saved,views,shares,total_interactions'
      : 'impressions,reach,saved,shares,total_interactions';

    const res = await fetch(`https://graph.instagram.com/v21.0/${mediaId}/insights?metric=${metrics}&access_token=${token}`);
    if (!res.ok) return result;

    const data = await res.json();
    for (const insight of (data.data || []) as IGInsight[]) {
      const val = insight.values?.[0]?.value ?? 0;
      if (insight.name === 'views' || insight.name === 'impressions') result.views = val;
      else if (insight.name === 'shares') result.shares = val;
      else if (insight.name === 'saved') result.saves = val;
      else if (insight.name === 'reach') result.reach = val;
    }
  } catch { /* skip */ }
  return result;
}

export async function GET(request: Request) {
  try {
    const token = process.env.IG_ACCESS_TOKEN?.trim();
    const userId = process.env.IG_USER_ID?.trim();

    if (!token || !userId) {
      return NextResponse.json({ error: 'IG credentials not configured', posts: [] }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

    // Paginate through IG API to get up to `limit` posts
    const allItems: IGMediaItem[] = [];
    let pageUrl = `https://graph.instagram.com/v21.0/${userId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=50&access_token=${token}`;
    let hasMore = true;

    while (hasMore && allItems.length < limit) {
      const response: Response = await fetch(pageUrl);
      if (!response.ok) break;
      const json = await response.json();
      allItems.push(...(json.data || []));
      if (json.paging?.next) {
        pageUrl = json.paging.next;
      } else {
        hasMore = false;
      }
    }

    // Trim to requested limit
    const items = allItems.slice(0, limit);

    // Fetch insights in parallel batches of 5 to avoid rate limits
    const posts = [];
    for (let i = 0; i < items.length; i += 5) {
      const batch = items.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (item) => {
          const insights = await fetchInsights(item.id, item.media_type, token);
          return {
            id: item.id,
            caption: item.caption || '',
            mediaType: item.media_type,
            mediaUrl: item.media_url || null,
            thumbnailUrl: item.thumbnail_url || item.media_url || null,
            permalink: item.permalink,
            timestamp: item.timestamp,
            likes: item.like_count || 0,
            comments: item.comments_count || 0,
            views: insights.views,
            shares: insights.shares,
            saves: insights.saves,
            reach: insights.reach,
          };
        })
      );
      posts.push(...results);
    }

    return NextResponse.json({ posts });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error', posts: [] }, { status: 500 });
  }
}
