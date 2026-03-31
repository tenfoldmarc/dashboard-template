'use client';

import { useEffect, useState, useCallback } from 'react';
import StatBox from '@/components/StatBox';

type DateRange = 'yesterday' | 'today' | '7d' | '30d' | '90d' | 'custom';
type SortMode = 'cpl' | 'spend';

interface AdData {
  name: string;
  spend: number;
  cpl: number;
  ctr: number;
  impressions: number;
}

interface AdsResponse {
  totalSpend: number;
  cpm: number;
  ctr: number;
  cpl: number;
  impressions: number;
  clicks: number;
  topAds: AdData[];
  note?: string;
  error?: string;
  dateRange?: { since: string; until: string };
}

function fmtCurrency(n: number) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtNumber(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

const DATE_PILLS: { key: DateRange; label: string }[] = [
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
];

export default function AdsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('cpl');
  const [data, setData] = useState<AdsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/ads?dateRange=${dateRange}&sortBy=${sortMode}`;
      if (dateRange === 'custom' && customStart && customEnd) {
        url = `/api/ads?startDate=${customStart}&endDate=${customEnd}&sortBy=${sortMode}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [dateRange, sortMode, customStart, customEnd]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  return (
    <div className="space-y-7 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[2.4rem] tracking-[1.5px]">Facebook Ads</h1>
        <button
          onClick={async () => {
            setRefreshing(true);
            await fetchAds();
            setRefreshing(false);
          }}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-border text-[.78rem] font-medium text-muted hover:text-cream hover:border-accent transition-all disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Date range pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {DATE_PILLS.map((pill) => (
          <button
            key={pill.key}
            onClick={() => setDateRange(pill.key)}
            className={`px-4 py-2 rounded-full text-[.78rem] font-semibold border transition-all ${
              dateRange === pill.key
                ? 'bg-accent text-white border-accent'
                : 'border-border text-muted hover:text-cream hover:border-accent'
            }`}
          >
            {pill.label}
          </button>
        ))}

        {/* Custom date range */}
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => {
              setCustomStart(e.target.value);
              if (e.target.value && customEnd) setDateRange('custom');
            }}
            className="px-3 py-1.5 rounded-xl border text-[.75rem] outline-none focus:border-accent"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
          <span className="text-muted text-[.72rem]">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              if (customStart && e.target.value) setDateRange('custom');
            }}
            className="px-3 py-1.5 rounded-xl border text-[.75rem] outline-none focus:border-accent"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Note banner */}
      {data?.note && (
        <div className="rounded-xl border border-amber/20 bg-amber/5 px-4 py-3 text-[.78rem] text-amber">
          {data.note}
        </div>
      )}

      {/* Stats row */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-card border border-border bg-card/60 h-28" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-4 gap-4">
          <StatBox
            label="Total Spend"
            value={fmtCurrency(data.totalSpend)}
            change={data.dateRange ? `${data.dateRange.since} - ${data.dateRange.until}` : ''}
            changeType="neutral"
            glow="amber"
          />
          <StatBox
            label="CPM"
            value={fmtCurrency(data.cpm)}
            change={`${fmtNumber(data.impressions)} impressions`}
            changeType="neutral"
          />
          <StatBox
            label="CTR"
            value={data.ctr.toFixed(2) + '%'}
            change={`${fmtNumber(data.clicks || 0)} clicks`}
            changeType={data.ctr > 1 ? 'up' : 'down'}
          />
          <StatBox
            label="Cost Per Lead"
            value={data.cpl > 0 ? fmtCurrency(data.cpl) : '--'}
            change={data.cpl > 0 ? 'From lead actions' : 'No lead data'}
            changeType={data.cpl > 0 && data.cpl < 10 ? 'up' : 'neutral'}
            glow={data.cpl > 0 && data.cpl < 10 ? 'green' : undefined}
          />
        </div>
      ) : (
        <div className="rounded-card border border-border bg-card/60 p-12 text-center">
          <p className="text-sm text-muted">Failed to load ad data.</p>
        </div>
      )}

      {/* Top Ads section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-[1.2rem] tracking-[1px]">TOP ADS</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setSortMode('cpl')}
              className={`px-3.5 py-1.5 rounded-full text-[.72rem] font-medium border transition-all ${
                sortMode === 'cpl'
                  ? 'bg-accent text-white border-accent'
                  : 'border-border text-muted hover:text-cream hover:border-accent'
              }`}
            >
              Lowest CPL
            </button>
            <button
              onClick={() => setSortMode('spend')}
              className={`px-3.5 py-1.5 rounded-full text-[.72rem] font-medium border transition-all ${
                sortMode === 'spend'
                  ? 'bg-accent text-white border-accent'
                  : 'border-border text-muted hover:text-cream hover:border-accent'
              }`}
            >
              Highest Spend
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-card border border-border bg-card/60 h-32" />
            ))}
          </div>
        ) : data?.topAds && data.topAds.length > 0 ? (
          <div className="space-y-3">
            {data.topAds.map((ad, i) => (
              <div
                key={i}
                className="rounded-card border border-border bg-card/60 backdrop-blur-xl p-5 transition-all hover:-translate-y-0.5 hover:border-border-hover animate-fade-in-scale"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-start gap-5">
                  {/* Creative preview area */}
                  <div className="w-20 h-20 rounded-xl bg-surface flex items-center justify-center flex-shrink-0">
                    <div className="text-center">
                      <svg className="w-6 h-6 text-muted mx-auto" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                      <span className="text-[.55rem] text-muted mt-1 block">AD #{i + 1}</span>
                    </div>
                  </div>

                  {/* Ad info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[.92rem] font-semibold truncate mb-2">{ad.name}</h3>
                    <div className="flex gap-6 text-[.75rem]">
                      <div>
                        <span className="text-muted">Spend</span>
                        <div className="font-mono text-cream font-semibold">{fmtCurrency(ad.spend)}</div>
                      </div>
                      <div>
                        <span className="text-muted">CPL</span>
                        <div className={`font-mono font-semibold ${ad.cpl > 0 ? 'text-accent' : 'text-muted'}`}>
                          {ad.cpl > 0 ? fmtCurrency(ad.cpl) : '--'}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted">CTR</span>
                        <div className="font-mono text-cream font-semibold">{ad.ctr.toFixed(2)}%</div>
                      </div>
                      <div>
                        <span className="text-muted">Impressions</span>
                        <div className="font-mono text-cream font-semibold">{fmtNumber(ad.impressions)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Rank badge */}
                  <div className="flex-shrink-0">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-mono text-[.72rem] font-bold ${
                        i === 0
                          ? 'bg-accent/15 text-accent'
                          : i === 1
                          ? 'bg-blue/15 text-blue'
                          : i === 2
                          ? 'bg-amber/15 text-amber'
                          : 'bg-surface text-muted'
                      }`}
                    >
                      {i + 1}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-border bg-card/60 p-12 text-center">
            <p className="text-sm text-muted">No ad data for this period.</p>
          </div>
        )}
      </div>
    </div>
  );
}
