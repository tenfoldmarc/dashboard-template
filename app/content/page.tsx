'use client';

import { useEffect, useState, useMemo } from 'react';
import StatBox from '@/components/StatBox';
import { useToast } from '@/components/ToastProvider';

type MainTab = 'mycontent' | 'competitors';
type SortKey = 'recent' | 'views' | 'likes' | 'shares';

interface IGPost {
  id: string;
  caption: string;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string;
  timestamp: string;
  likes: number;
  comments: number;
  views: number;
  shares: number;
  saves: number;
  reach: number;
}

interface FollowerData {
  current: number;
  daily: { date: string; count: number }[];
  weeklyGrowth: number;
  monthlyGrowth: number;
}

interface CompetitorData {
  id: string;
  instagram_handle: string;
  display_name: string;
  color: string;
  avgViews: number;
  postsPerWeek: number;
  monthlyReach: number;
  posts: CompPost[];
}

interface CompPost {
  id: string;
  handle: string;
  instagram_handle?: string;
  content: string;
  likes: number;
  shares: number;
  views: number;
  post_url: string;
  posted_at: string;
  scraped_at: string;
  thumbnail_url: string;
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function HookTemplatesSection() {
  const [hooks, setHooks] = useState<{ id: string; hook_text: string; handle: string; views: number; is_own: boolean }[]>([]);
  const [templates, setTemplates] = useState<{ id: string; template: string; example_hook: string; example_handle: string; views: number }[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/content/hooks').then(r => r.json()).then(d => {
      setHooks(d.hooks || []);
      setTemplates(d.templates || []);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function analyzeHooks() {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/content/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze' }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh hooks data
        const refreshRes = await fetch('/api/content/hooks');
        const refreshData = await refreshRes.json();
        setHooks(refreshData.hooks || []);
        setTemplates(refreshData.templates || []);
      }
    } catch { /* skip */ }
    setAnalyzing(false);
  }

  function copyTemplate(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Hook Templates */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-[1.2rem] tracking-[1px]">TOP HOOK TEMPLATES</h2>
          <button
            onClick={analyzeHooks}
            disabled={analyzing || !loaded}
            className="px-4 py-2 rounded-xl text-[.72rem] font-semibold border border-border text-muted hover:text-cream hover:border-accent transition-all disabled:opacity-50"
          >
            {analyzing ? 'Analyzing posts...' : !loaded ? 'Loading...' : templates.length > 0 ? 'Re-analyze' : 'Analyze Top Posts'}
          </button>
        </div>

        {analyzing ? (
          <div className="p-6 rounded-xl border border-border bg-card/40 text-center">
            <div className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-[.82rem] text-muted">Extracting hooks from captions and generating templates...</p>
          </div>
        ) : templates.length > 0 ? (
          <div className="space-y-2">
            {templates.map((t, i) => (
              <div key={t.id} className="p-4 rounded-xl border border-border bg-card/70">
                <div className="flex items-start gap-3">
                  <span className="text-accent font-bold text-[.82rem] min-w-[22px] font-mono mt-0.5">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-[.9rem] font-semibold text-cream leading-relaxed">{t.template}</p>
                    <p className="text-[.7rem] text-muted mt-1.5">
                      Example: &ldquo;{t.example_hook}&rdquo; — <span className="text-accent">@{t.example_handle}</span>
                      {t.views > 0 && <span className="ml-2 text-[var(--text-secondary)]">{(t.views / 1000).toFixed(0)}K views</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => copyTemplate(t.template, i)}
                    className="px-3 py-1 rounded-full border border-border text-[.68rem] text-muted hover:border-accent hover:text-accent transition-all whitespace-nowrap flex-shrink-0"
                  >
                    {copiedIdx === i ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-xl border border-border bg-card/40 text-center">
            <p className="text-[.82rem] text-muted">Click &ldquo;Analyze Top Posts&rdquo; to extract hook templates from your best-performing content and your competitors&apos;.</p>
          </div>
        )}
      </div>

      {/* Top Hooks */}
      {hooks.length > 0 && (
        <div>
          <h2 className="font-heading text-[1.2rem] tracking-[1px] mb-3">TOP PERFORMING HOOKS</h2>
          <div className="space-y-1.5">
            {hooks.slice(0, 15).map((hook, i) => (
              <div key={hook.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/70">
                <span className="text-accent font-bold text-[.72rem] min-w-[22px] font-mono">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[.82rem] text-cream truncate">&ldquo;{hook.hook_text}&rdquo;</p>
                  <p className="text-[.65rem] text-muted mt-0.5">
                    <span className={hook.is_own ? 'text-accent' : 'text-[var(--text-secondary)]'}>@{hook.handle}</span>
                    <span className="mx-1.5">·</span>
                    {(hook.views / 1000).toFixed(0)}K views
                  </p>
                </div>
                <button
                  onClick={() => copyTemplate(hook.hook_text, i + 100)}
                  className="px-3 py-1 rounded-full border border-border text-[.68rem] text-muted hover:border-accent hover:text-accent transition-all whitespace-nowrap flex-shrink-0"
                >
                  {copiedIdx === i + 100 ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'mycontent', label: 'My Content' },
  { key: 'competitors', label: 'Competitors' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'views', label: 'Views' },
  { key: 'likes', label: 'Likes' },
  { key: 'shares', label: 'Shares' },
];

const DATE_RANGES = ['7d', '30d', '90d'] as const;

export default function ContentPage() {
  const [mainTab, setMainTab] = useState<MainTab>('mycontent');
  const [sort, setSort] = useState<SortKey>('recent');
  const [dateRange, setDateRange] = useState<string>('30d');
  const { showToast } = useToast();

  // My Content state
  const [myPosts, setMyPosts] = useState<IGPost[]>([]);
  const [followers, setFollowers] = useState<FollowerData | null>(null);
  const [myLoading, setMyLoading] = useState(true);

  // Competitors state
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [compFilter, setCompFilter] = useState('all');
  const [compLoading, setCompLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHandle, setNewHandle] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [addingCompetitor, setAddingCompetitor] = useState(false);
  const [addError, setAddError] = useState('');

  // Fetch my posts + followers
  const fetchMyContent = async () => {
    setMyLoading(true);
    try {
      const [postsData, followerData] = await Promise.all([
        fetch('/api/content/my-posts?limit=100').then((r) => r.json()),
        fetch('/api/content/followers').then((r) => r.json()),
      ]);
      setMyPosts(postsData.posts || []);
      if (followerData.current !== undefined) {
        setFollowers(followerData);
      }
    } catch {
      showToast('Failed to load Instagram data', 'error');
    } finally {
      setMyLoading(false);
    }
  };

  useEffect(() => {
    fetchMyContent();
  }, []);

  // Fetch competitors
  const fetchCompetitors = async () => {
    setCompLoading(true);
    try {
      const res = await fetch('/api/content/competitors');
      const data = await res.json();
      setCompetitors(data.competitors || []);
    } catch {
      // silent
    } finally {
      setCompLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitors();
  }, []);

  // Sorted posts
  const sortedMyPosts = useMemo(() => {
    return [...myPosts].sort((a, b) => {
      if (sort === 'views') return b.views - a.views;
      if (sort === 'likes') return b.likes - a.likes;
      if (sort === 'shares') return b.shares - a.shares;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [myPosts, sort]);

  // Filtered + sorted competitor posts
  const allCompPosts = useMemo(() => {
    let posts: CompPost[] = [];
    for (const c of competitors) {
      if (compFilter === 'all' || compFilter === c.instagram_handle) {
        posts = posts.concat(c.posts);
      }
    }
    return [...posts].sort((a, b) => {
      if (sort === 'views') return b.views - a.views;
      if (sort === 'likes') return b.likes - a.likes;
      if (sort === 'shares') return b.shares - a.shares;
      // Sort by posted_at date (fall back to scraped_at), across all competitors
      const dateA = new Date(a.posted_at || a.scraped_at).getTime();
      const dateB = new Date(b.posted_at || b.scraped_at).getTime();
      return dateB - dateA;
    });
  }, [competitors, compFilter, sort]);

  // Follower chart data filtered by date range
  const chartData = useMemo(() => {
    if (!followers?.daily?.length) return [];
    const days = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30;
    return followers.daily.slice(-days);
  }, [followers, dateRange]);

  // Max value for chart Y-axis
  const chartMax = useMemo(() => {
    if (chartData.length === 0) return 100;
    const max = Math.max(...chartData.map((d) => d.count));
    return max > 0 ? max : 100;
  }, [chartData]);

  // Add competitor
  async function addCompetitor() {
    if (!newHandle.trim()) return;
    setAddingCompetitor(true);
    setAddError('');
    try {
      const res = await fetch('/api/content/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: newHandle.trim().replace(/^@/, ''), displayName: newDisplayName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add competitor');
      }
      showToast('Competitor added');
      setShowAddModal(false);
      setNewHandle('');
      setNewDisplayName('');
      setAddError('');
      // Re-fetch competitors list
      await fetchCompetitors();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add competitor';
      setAddError(message);
      showToast(message, 'error');
    } finally {
      setAddingCompetitor(false);
    }
  }

  // Remove competitor
  async function removeCompetitor(id: string) {
    try {
      await fetch(`/api/content/competitors?id=${id}`, { method: 'DELETE' });
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
      showToast('Competitor removed');
    } catch {
      showToast('Failed to remove', 'error');
    }
  }

  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([fetchMyContent(), fetchCompetitors()]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-7 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[2.4rem] tracking-[1.5px]">Content</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-border text-[.78rem] font-medium text-muted hover:text-cream hover:border-accent transition-all disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 bg-surface p-1 rounded-full w-fit">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className={`px-5 py-2 rounded-full text-[.82rem] font-semibold transition-all ${
              mainTab === tab.key ? 'bg-accent text-white' : 'text-muted hover:text-cream'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── MY CONTENT ─── */}
      {mainTab === 'mycontent' && (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-4">
            <StatBox
              label="Followers"
              value={followers ? fmt(followers.current) : '--'}
              change={followers ? `+${fmt(followers.weeklyGrowth)} this week` : 'Loading...'}
              changeType="up"
              glow="green"
            />
            <StatBox
              label="Monthly Growth"
              value={followers ? `+${fmt(followers.monthlyGrowth)}` : '--'}
              change="Last 30 days"
              changeType="up"
            />
            <StatBox
              label="Avg Views"
              value={myPosts.length > 0 ? fmt(Math.round(myPosts.reduce((s, p) => s + p.views, 0) / myPosts.length)) : '--'}
              change={`${myPosts.length} posts`}
              changeType="neutral"
            />
            <StatBox
              label="Avg Likes"
              value={myPosts.length > 0 ? fmt(Math.round(myPosts.reduce((s, p) => s + p.likes, 0) / myPosts.length)) : '--'}
              change={`${myPosts.filter((p) => p.saves > 0).length} with saves`}
              changeType="neutral"
            />
          </div>

          {/* Follower Growth Chart */}
          {chartData.length > 0 && (
            <div className="rounded-card border border-border bg-card/60 backdrop-blur-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-[1.2rem] tracking-[1px]">FOLLOWER GROWTH</h2>
                <div className="flex gap-1">
                  {DATE_RANGES.map((r) => (
                    <button
                      key={r}
                      onClick={() => setDateRange(r)}
                      className={`px-3 py-1 rounded-full text-[.72rem] font-medium border transition-all ${
                        dateRange === r
                          ? 'bg-accent text-white border-accent'
                          : 'border-border text-muted hover:text-cream hover:border-accent'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative h-48 flex items-end gap-[2px]">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-[.6rem] text-muted font-mono">
                  <span>+{chartMax}</span>
                  <span>+{Math.round(chartMax / 2)}</span>
                  <span>0</span>
                </div>
                {/* Bars */}
                <div className="ml-14 flex-1 flex items-end gap-[2px] h-full">
                  {chartData.map((d) => {
                    const height = chartMax > 0 ? (d.count / chartMax) * 100 : 0;
                    return (
                      <div
                        key={d.date}
                        className="flex-1 group relative"
                        style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}
                      >
                        <div
                          className="w-full rounded-t-sm transition-all duration-200 group-hover:opacity-80"
                          style={{
                            height: `${Math.max(height, 2)}%`,
                            background: d.count > 0 ? 'var(--accent)' : 'var(--border)',
                            minHeight: '2px',
                          }}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                          <div className="bg-surface border border-border rounded-lg px-3 py-1.5 text-[.68rem] whitespace-nowrap shadow-xl">
                            <div className="font-mono text-accent font-bold">+{d.count}</div>
                            <div className="text-muted">{d.date}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* X-axis labels */}
              <div className="ml-14 flex justify-between text-[.58rem] text-muted font-mono mt-1">
                <span>{chartData[0]?.date?.slice(5) ?? ''}</span>
                <span>{chartData[Math.floor(chartData.length / 2)]?.date?.slice(5) ?? ''}</span>
                <span>{chartData[chartData.length - 1]?.date?.slice(5) ?? ''}</span>
              </div>
            </div>
          )}

          {/* Sort controls + Posts header */}
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-[1.2rem] tracking-[1px]">YOUR POSTS</h2>
            <div className="flex gap-1.5">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={`px-3.5 py-1.5 rounded-full text-[.72rem] font-medium border transition-all ${
                    sort === s.key
                      ? 'bg-accent text-white border-accent'
                      : 'border-border text-muted hover:text-cream hover:border-accent'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Instagram-style grid */}
          {myLoading ? (
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl bg-card/60 aspect-square" />
              ))}
            </div>
          ) : sortedMyPosts.length === 0 ? (
            <div className="rounded-card border border-border bg-card/60 p-12 text-center">
              <p className="text-sm text-muted">No posts loaded yet. Check your Instagram token.</p>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {sortedMyPosts.map((post) => (
                <a
                  key={post.id}
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl overflow-hidden bg-card border border-border hover:border-[var(--border-hover)] transition-all"
                >
                  <div className="relative aspect-square overflow-hidden">
                    {post.thumbnailUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`/api/image-proxy?url=${encodeURIComponent(post.thumbnailUrl)}`}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-accent/20 to-violet/20" />
                    )}
                    {(post.mediaType === 'VIDEO' || post.mediaType === 'REEL') && (
                      <div className="absolute top-2 right-2">
                        <svg className="w-5 h-5 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    )}
                  </div>
                  <div className="px-2.5 py-2 grid grid-cols-2 gap-x-2 gap-y-1">
                    <div className="flex items-center gap-1 text-[.65rem] text-[var(--text-secondary)]">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                      <span className="font-semibold text-cream">{fmt(post.views)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[.65rem] text-[var(--text-secondary)]">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/></svg>
                      <span className="font-semibold text-cream">{fmt(post.likes)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[.65rem] text-[var(--text-secondary)]">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z"/></svg>
                      <span className="font-semibold text-cream">{fmt(post.comments)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[.65rem] text-[var(--text-secondary)]">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg>
                      <span className="font-semibold text-cream">{fmt(post.shares)}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Hook Templates Section */}
          <HookTemplatesSection />
        </div>
      )}

      {/* ─── COMPETITORS ─── */}
      {mainTab === 'competitors' && (
        <div className="space-y-6">
          {/* Filter tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCompFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-[.72rem] font-medium border transition-all ${
                compFilter === 'all'
                  ? 'bg-accent text-white border-accent'
                  : 'border-border text-muted hover:text-cream hover:border-accent'
              }`}
            >
              All
            </button>
            {competitors.map((c) => (
              <button
                key={c.id}
                onClick={() => setCompFilter(c.instagram_handle)}
                className={`px-3.5 py-1.5 rounded-full text-[.72rem] font-medium border transition-all ${
                  compFilter === c.instagram_handle
                    ? 'bg-accent/15 text-accent border-accent'
                    : 'border-border text-muted hover:text-cream hover:border-accent'
                }`}
              >
                @{c.instagram_handle}
              </button>
            ))}
            <button
              onClick={() => {
                setShowAddModal(true);
                setAddError('');
              }}
              className="px-3.5 py-1.5 rounded-full text-[.72rem] font-medium border border-dashed border-border text-muted hover:text-accent hover:border-accent transition-all"
            >
              + Add Competitor
            </button>
          </div>

          {/* Competitor overview cards */}
          {compFilter === 'all' && (
            <div className="grid grid-cols-3 gap-4">
              {competitors.map((c) => (
                <div
                  key={c.id}
                  className="rounded-card border border-border bg-card/60 backdrop-blur-xl p-5 transition-all hover:-translate-y-0.5 hover:border-border-hover"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[.92rem] font-semibold">@{c.instagram_handle}</div>
                      {c.display_name !== c.instagram_handle && (
                        <div className="text-[.68rem] text-muted">{c.display_name}</div>
                      )}
                    </div>
                    <button
                      onClick={() => removeCompetitor(c.id)}
                      className="text-[.68rem] text-muted hover:text-red transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[.68rem] text-muted uppercase tracking-wider">Posts/wk</div>
                      <div className="font-mono text-[1.1rem] text-cream">{c.postsPerWeek}</div>
                    </div>
                    <div>
                      <div className="text-[.68rem] text-muted uppercase tracking-wider">Avg Views</div>
                      <div className="font-mono text-[1.1rem] text-cream">{fmt(c.avgViews)}</div>
                    </div>
                    <div>
                      <div className="text-[.68rem] text-muted uppercase tracking-wider">Mo. Reach</div>
                      <div className="font-mono text-[1.1rem] text-cream">{fmt(c.monthlyReach)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {competitors.length === 0 && (
                <div className="col-span-3 rounded-card border border-border bg-card/60 p-12 text-center">
                  <p className="text-sm text-muted">No competitors added yet. Click &ldquo;+ Add Competitor&rdquo; to start tracking.</p>
                </div>
              )}
            </div>
          )}

          {/* Sort controls */}
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-[1.2rem] tracking-[1px]">
              {compFilter === 'all' ? 'ALL COMPETITOR POSTS' : `@${compFilter} POSTS`}
            </h2>
            <div className="flex gap-1.5">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={`px-3.5 py-1.5 rounded-full text-[.72rem] font-medium border transition-all ${
                    sort === s.key
                      ? 'bg-accent text-white border-accent'
                      : 'border-border text-muted hover:text-cream hover:border-accent'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Competitor posts grid */}
          {compLoading ? (
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl bg-card/60 aspect-square" />
              ))}
            </div>
          ) : allCompPosts.length === 0 ? (
            <div className="rounded-card border border-border bg-card/60 p-12 text-center">
              <p className="text-sm text-muted">No competitor posts found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {allCompPosts.map((post) => (
                <a
                  key={post.id}
                  href={post.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl overflow-hidden bg-card border border-border hover:border-[var(--border-hover)] transition-all"
                >
                  <div className="relative aspect-square overflow-hidden">
                    {post.thumbnail_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`/api/image-proxy?url=${encodeURIComponent(post.thumbnail_url)}`}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className="w-full h-full bg-gradient-to-br from-blue/20 to-violet/20 flex items-center justify-center" style={post.thumbnail_url ? { display: 'none' } : {}}>
                      <svg className="w-8 h-8 text-muted opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                  </div>
                  <div className="px-2.5 py-2 grid grid-cols-2 gap-x-2 gap-y-1">
                    <div className="flex items-center gap-1 text-[.65rem] text-[var(--text-secondary)]">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                      <span className="font-semibold text-cream">{fmt(post.views)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[.65rem] text-[var(--text-secondary)]">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/></svg>
                      <span className="font-semibold text-cream">{fmt(post.likes)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[.65rem] text-[var(--text-secondary)]">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z"/></svg>
                      <span className="font-semibold text-cream">--</span>
                    </div>
                    <div className="flex items-center gap-1 text-[.65rem] text-[var(--text-secondary)]">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg>
                      <span className="font-semibold text-cream">{fmt(post.shares)}</span>
                    </div>
                  </div>
                  <div className="px-2.5 pb-2">
                    <span className="text-[.6rem] font-semibold text-muted">@{post.handle}</span>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Add Competitor Modal */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="rounded-card border border-border bg-card p-6 w-full max-w-md space-y-4 animate-fade-in-scale">
                <h3 className="font-heading text-[1.2rem] tracking-[1px]">Add Competitor</h3>
                <div>
                  <label className="text-[.72rem] uppercase tracking-wider text-muted block mb-1">Instagram Handle</label>
                  <input
                    value={newHandle}
                    onChange={(e) => setNewHandle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addCompetitor();
                    }}
                    placeholder="@username"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:border-accent"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-[.72rem] uppercase tracking-wider text-muted block mb-1">Display Name (optional)</label>
                  <input
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addCompetitor();
                    }}
                    placeholder="Display name"
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:border-accent"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                {addError && (
                  <p className="text-[.75rem] text-red">{addError}</p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setNewHandle('');
                      setNewDisplayName('');
                      setAddError('');
                    }}
                    className="px-4 py-2 rounded-full text-[.78rem] font-medium border border-border text-muted hover:text-cream transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addCompetitor}
                    disabled={addingCompetitor || !newHandle.trim()}
                    className="px-5 py-2 rounded-full text-[.78rem] font-semibold bg-accent text-white hover:bg-accent-hover transition-all disabled:opacity-50"
                  >
                    {addingCompetitor ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
