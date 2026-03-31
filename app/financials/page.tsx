'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useToast } from '@/components/ToastProvider';

/* ─── Types ─── */

interface OverviewData {
  totalRevenue: number;
  mrr: number;
  fees: number;
  chargebackAmount: number;
  chargebackCount: number;
  refundAmount: number;
  refundCount: number;
  revenueByDay: { date: string; amount: number }[];
  netRevenue: number;
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  description: string;
  created: string;
  status: string;
  refunded: boolean;
  amount_refunded: number;
  customer_email: string;
}

/* ─── Helpers ─── */

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtMoneyShort(n: number) {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return '$' + n.toFixed(0);
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ─── Chart Range ─── */

type ChartRange = '7d' | 'month' | 'lastMonth' | '90d';

const RANGE_LABELS: Record<ChartRange, string> = {
  '7d': '7 Days',
  month: 'This Month',
  lastMonth: 'Last Month',
  '90d': '90 Days',
};

function getDateRange(range: ChartRange): { from: Date; to: Date } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  switch (range) {
    case '7d': {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from, to: now };
    }
    case 'month': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to: now };
    }
    case 'lastMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from, to };
    }
    case '90d': {
      const from = new Date(now);
      from.setDate(from.getDate() - 89);
      return { from, to: now };
    }
  }
}

/* ─── Stat Card Component ─── */

function StatCard({
  label,
  value,
  subtext,
  color = 'var(--accent)',
  icon,
}: {
  label: string;
  value: string;
  subtext?: string;
  color?: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-card border border-border bg-card/60 backdrop-blur-xl p-5 transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_12px_40px_rgba(0,0,0,.35)] hover:border-border-hover animate-fade-in-scale"
      style={{ boxShadow: `0 0 30px ${color}15` }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-[.72rem] uppercase tracking-[1px] text-muted">{label}</div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15`, color }}>
          {icon}
        </div>
      </div>
      <div className="font-mono text-[2rem] tracking-[1px] text-cream leading-tight">{value}</div>
      {subtext && (
        <div className="text-[.72rem] mt-1 text-muted">{subtext}</div>
      )}
    </div>
  );
}

/* ─── Revenue Bar Chart ─── */

function RevenueBarChart({ data, range }: { data: { date: string; amount: number }[]; range: ChartRange }) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const { from, to } = getDateRange(range);

  // Filter data to range
  const filteredData = useMemo(() => {
    const fromKey = from.toISOString().slice(0, 10);
    const toKey = to.toISOString().slice(0, 10);
    return data.filter((d) => d.date >= fromKey && d.date <= toKey);
  }, [data, from, to]);

  const maxAmount = Math.max(1, ...filteredData.map((d) => d.amount));

  // Y-axis labels (5 steps)
  const yLabels = useMemo(() => {
    const steps = 5;
    const stepVal = maxAmount / steps;
    return Array.from({ length: steps + 1 }, (_, i) => Math.round(stepVal * i));
  }, [maxAmount]);

  // Show every Nth label
  const xLabelEvery = filteredData.length > 30 ? 7 : filteredData.length > 14 ? 3 : filteredData.length > 7 ? 2 : 1;

  // Summary
  const total = filteredData.reduce((s, d) => s + d.amount, 0);
  const avg = filteredData.length > 0 ? total / filteredData.length : 0;

  return (
    <>
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[.68rem] uppercase tracking-wider text-muted mb-1">Period Total</div>
          <div className="font-mono text-[1.5rem] text-cream tracking-wide">{fmtMoney(total)}</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)' }}>
          <div className="text-[.68rem] uppercase tracking-wider text-muted mb-1">Avg Daily</div>
          <div className="font-mono text-[1.5rem] text-cream tracking-wide">{fmtMoney(Math.round(avg))}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: '260px' }}>
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ left: '52px', right: '8px' }}>
          {yLabels.slice().reverse().map((val, i) => (
            <div key={i} className="relative w-full" style={{ borderBottom: '1px solid var(--border)' }}>
              <span
                className="absolute text-[.6rem] font-mono text-muted"
                style={{ left: '-52px', top: '-7px', width: '44px', textAlign: 'right' }}
              >
                {fmtMoneyShort(val)}
              </span>
            </div>
          ))}
        </div>

        {/* Bars */}
        <div
          className="absolute bottom-0 flex items-end gap-[2px]"
          style={{ left: '56px', right: '8px', top: '0', paddingBottom: '24px' }}
        >
          {filteredData.map((day, i) => {
            const pct = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
            const isHovered = hoveredBar === i;
            return (
              <div
                key={day.date}
                className="relative flex-1 flex flex-col items-center justify-end"
                style={{ height: 'calc(100% - 24px)' }}
                onMouseEnter={() => setHoveredBar(i)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div
                    className="absolute z-20 px-3 py-2 rounded-lg text-center whitespace-nowrap pointer-events-none"
                    style={{
                      bottom: `calc(${Math.max(pct, 5)}% + 12px)`,
                      background: 'rgba(15,23,42,.95)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid var(--border-hover)',
                      boxShadow: '0 8px 32px rgba(0,0,0,.5)',
                    }}
                  >
                    <div className="font-mono text-sm font-semibold text-accent">{fmtMoney(day.amount)}</div>
                    <div className="text-[.6rem] text-muted mt-0.5">{fmtDate(day.date)}</div>
                  </div>
                )}

                {/* Bar */}
                <div
                  className="w-full rounded-t-sm transition-all duration-200 cursor-pointer"
                  style={{
                    height: `${Math.max(pct, 1)}%`,
                    minHeight: day.amount > 0 ? '3px' : '1px',
                    background: isHovered
                      ? 'linear-gradient(to top, #4ADE80, rgba(74,222,128,.4))'
                      : 'linear-gradient(to top, var(--accent), rgba(34,197,94,.2))',
                    boxShadow: isHovered ? '0 0 24px rgba(34,197,94,.35)' : 'none',
                    opacity: day.amount === 0 ? 0.15 : 1,
                  }}
                />

                {/* X-axis label */}
                {i % xLabelEvery === 0 && (
                  <span
                    className="absolute text-[.55rem] font-mono text-muted whitespace-nowrap"
                    style={{ bottom: '0', transform: 'translateY(100%)' }}
                  >
                    {fmtDate(day.date)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {filteredData.length === 0 && (
        <div className="text-center py-12 text-muted text-sm">No revenue data for this period.</div>
      )}
    </>
  );
}

/* ─── Refund Confirmation Modal ─── */

function RefundModal({
  transaction,
  onClose,
  onConfirm,
  loading,
}: {
  transaction: Transaction;
  onClose: () => void;
  onConfirm: (chargeId: string, amount?: number) => void;
  loading: boolean;
}) {
  const [refundAmount, setRefundAmount] = useState(transaction.amount.toFixed(2));

  const parsedAmount = parseFloat(refundAmount);
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= transaction.amount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(2,6,23,.7)', backdropFilter: 'blur(12px)' }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 animate-fade-in-scale"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '440px',
          width: '90%',
          boxShadow: '0 24px 64px rgba(0,0,0,.5)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-cream transition-colors"
          style={{ border: '1px solid var(--border)' }}
        >
          &times;
        </button>

        <h3 className="font-heading text-[1.3rem] tracking-[1px] mb-2">Confirm Refund</h3>
        <p className="text-sm text-muted mb-5">
          You are about to refund <strong className="text-cream">{transaction.description || 'Payment'}</strong>.
        </p>

        <div className="rounded-xl p-4 mb-5" style={{ background: 'var(--surface)' }}>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted">Customer</span>
            <span className="text-cream">{transaction.customer_email || '--'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Original amount</span>
            <span className="font-mono font-semibold text-cream">${transaction.amount.toFixed(2)}</span>
          </div>
        </div>

        <div className="mb-5">
          <label className="text-[.68rem] uppercase tracking-wider text-muted mb-1 block">Refund amount ($)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={transaction.amount}
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none focus:border-accent font-mono"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
          {parsedAmount < transaction.amount && isValid && (
            <div className="text-[.65rem] text-muted mt-1">Partial refund of ${parsedAmount.toFixed(2)}</div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              if (!isValid) return;
              // If refunding the full amount, pass undefined so Stripe does a full refund
              const amt = parsedAmount < transaction.amount ? parsedAmount : undefined;
              onConfirm(transaction.id, amt);
            }}
            disabled={loading || !isValid}
            className="flex-1 px-5 py-2.5 rounded-full text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              background: 'var(--red)',
              color: '#fff',
              boxShadow: '0 4px 20px rgba(239,68,68,.2)',
            }}
          >
            {loading ? 'Processing...' : 'Confirm Refund'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full border text-sm font-medium text-muted hover:text-cream transition-all"
            style={{ borderColor: 'var(--border)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function FinancialsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartRange, setChartRange] = useState<ChartRange>('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [refundTarget, setRefundTarget] = useState<Transaction | null>(null);
  const [refunding, setRefunding] = useState(false);
  const { showToast } = useToast();

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [overviewRes, chargesRes] = await Promise.all([
        fetch('/api/stripe/overview?days=90'),
        fetch('/api/stripe/charges?limit=100'),
      ]);

      const overviewData = await overviewRes.json();
      const chargesData = await chargesRes.json();

      if (!overviewData.error) setOverview(overviewData);
      if (chargesData.transactions) setTransactions(chargesData.transactions);
    } catch {
      showToast('Failed to fetch Stripe data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleRefund(chargeId: string, amount?: number) {
    setRefunding(true);
    try {
      const res = await fetch('/api/stripe/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargeId, amount }),
      });
      const data = await res.json();

      if (data.error) {
        showToast(data.error, 'error');
      } else {
        showToast(`Refund of $${data.amount.toFixed(2)} issued successfully`);
        // Update transaction in list
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === chargeId
              ? {
                  ...t,
                  refunded: amount === undefined || amount === t.amount,
                  amount_refunded: t.amount_refunded + (data.amount || 0),
                }
              : t
          )
        );
        setRefundTarget(null);
        // Refresh overview data
        fetchAll(true);
      }
    } catch {
      showToast('Refund failed', 'error');
    } finally {
      setRefunding(false);
    }
  }

  // Filter transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        !term ||
        (t.description || '').toLowerCase().includes(term) ||
        (t.customer_email || '').toLowerCase().includes(term);
      const matchType =
        filterType === 'all' ||
        (filterType === 'payment' && t.status === 'succeeded' && !t.refunded) ||
        (filterType === 'refund' && (t.refunded || t.amount_refunded > 0)) ||
        (filterType === 'failed' && t.status === 'failed');
      return matchSearch && matchType;
    });
  }, [transactions, searchTerm, filterType]);

  return (
    <div className="space-y-7 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[2.4rem] tracking-[1.5px]">Financials</h1>
          <p className="text-muted text-sm mt-1">Stripe revenue, subscriptions, and transaction history.</p>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-[1.03] disabled:opacity-50"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            boxShadow: '0 4px 20px var(--accent-glow)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard
          label="Total Revenue"
          value={loading ? '--' : fmtMoney(overview?.totalRevenue || 0)}
          subtext="This month"
          color="var(--accent)"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          }
        />
        <StatCard
          label="MRR"
          value={loading ? '--' : fmtMoney(overview?.mrr || 0)}
          subtext="Recurring"
          color="var(--blue)"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />
        <StatCard
          label="Stripe Fees"
          value={loading ? '--' : fmtMoney(overview?.fees || 0)}
          subtext={overview && overview.totalRevenue > 0 ? `${((overview.fees / overview.totalRevenue) * 100).toFixed(1)}% of revenue` : 'This month'}
          color="var(--amber)"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          }
        />
        <StatCard
          label="Chargebacks"
          value={loading ? '--' : fmtMoney(overview?.chargebackAmount || 0)}
          subtext={overview ? `${overview.chargebackCount} dispute${overview.chargebackCount !== 1 ? 's' : ''}` : 'This month'}
          color="var(--red)"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          }
        />
        <StatCard
          label="Refunds"
          value={loading ? '--' : fmtMoney(overview?.refundAmount || 0)}
          subtext={overview ? `${overview.refundCount} refund${overview.refundCount !== 1 ? 's' : ''}` : 'This month'}
          color="var(--rose)"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
            </svg>
          }
        />
      </div>

      {/* Revenue Chart */}
      <div className="rounded-card border border-border bg-card/60 backdrop-blur-xl p-6 animate-fade-in">
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <h2 className="font-heading text-[1.4rem] tracking-[1px]">Revenue</h2>
          <div className="flex items-center gap-2">
            {(Object.keys(RANGE_LABELS) as ChartRange[]).map((key) => (
              <button
                key={key}
                onClick={() => setChartRange(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  chartRange === key
                    ? 'bg-accent text-white'
                    : 'text-muted border hover:text-cream hover:border-accent'
                }`}
                style={chartRange !== key ? { borderColor: 'var(--border)' } : {}}
              >
                {RANGE_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted text-sm">Loading chart data from Stripe...</div>
        ) : overview ? (
          <RevenueBarChart data={overview.revenueByDay} range={chartRange} />
        ) : (
          <div className="text-center py-16 text-muted text-sm">No data available.</div>
        )}
      </div>

      {/* Transactions Table */}
      <div>
        <h2 className="font-heading text-[1.4rem] tracking-[1px] mb-4">Transactions</h2>

        {/* Search & Filter Bar */}
        <div className="flex gap-3 mb-4 flex-wrap items-center">
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border text-sm outline-none focus:border-accent w-80"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          {['all', 'payment', 'refund', 'failed'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterType === type
                  ? 'bg-accent text-white'
                  : 'text-muted border hover:text-cream hover:border-accent'
              }`}
              style={filterType !== type ? { borderColor: 'var(--border)' } : {}}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
            </button>
          ))}

          <span className="ml-auto text-[.72rem] text-muted font-mono">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div
          className="rounded-card border overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--glass-bg)', backdropFilter: 'var(--glass-blur)' }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left p-3.5 text-[.72rem] uppercase tracking-wider text-muted font-medium">Date</th>
                <th className="text-left p-3.5 text-[.72rem] uppercase tracking-wider text-muted font-medium">Description</th>
                <th className="text-left p-3.5 text-[.72rem] uppercase tracking-wider text-muted font-medium">Customer</th>
                <th className="text-left p-3.5 text-[.72rem] uppercase tracking-wider text-muted font-medium">Amount</th>
                <th className="text-left p-3.5 text-[.72rem] uppercase tracking-wider text-muted font-medium">Status</th>
                <th className="text-right p-3.5 text-[.72rem] uppercase tracking-wider text-muted font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted text-sm">
                    Loading transactions from Stripe...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted text-sm">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const isRefunded = t.refunded || t.amount_refunded > 0;
                  const isFailed = t.status === 'failed';
                  const canRefund = t.status === 'succeeded' && !t.refunded;

                  return (
                    <tr
                      key={t.id}
                      style={{ borderBottom: '1px solid var(--border)' }}
                      className="hover:bg-[rgba(34,197,94,.02)] transition-colors"
                    >
                      <td className="p-3.5 text-sm text-muted font-mono whitespace-nowrap">
                        {new Date(t.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="p-3.5 text-sm max-w-[200px] truncate">{t.description || 'Payment'}</td>
                      <td className="p-3.5 text-sm text-muted max-w-[180px] truncate">
                        {t.customer_email || '--'}
                      </td>
                      <td className={`p-3.5 text-sm font-mono font-semibold ${isRefunded ? 'text-red' : isFailed ? 'text-muted' : 'text-accent'}`}>
                        {isRefunded ? '-' : '+'}${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        {t.amount_refunded > 0 && !t.refunded && (
                          <span className="text-[.65rem] text-muted ml-1">
                            (${t.amount_refunded.toFixed(2)} refunded)
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`text-[.62rem] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                            isRefunded
                              ? 'bg-[rgba(239,68,68,.1)] text-red'
                              : isFailed
                              ? 'bg-[rgba(100,116,139,.1)] text-muted'
                              : t.status === 'succeeded'
                              ? 'bg-[rgba(34,197,94,.1)] text-accent'
                              : 'bg-[rgba(245,158,11,.1)] text-amber'
                          }`}
                        >
                          {isRefunded ? 'Refunded' : isFailed ? 'Failed' : t.status === 'succeeded' ? 'Paid' : t.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        {canRefund && (
                          <button
                            onClick={() => setRefundTarget(t)}
                            className="px-3 py-1.5 rounded-full text-[.68rem] font-semibold transition-all hover:scale-[1.05]"
                            style={{
                              border: '1px solid var(--red)',
                              color: 'var(--red)',
                              background: 'rgba(239,68,68,.05)',
                            }}
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refund Modal */}
      {refundTarget && (
        <RefundModal
          transaction={refundTarget}
          onClose={() => setRefundTarget(null)}
          onConfirm={handleRefund}
          loading={refunding}
        />
      )}
    </div>
  );
}
