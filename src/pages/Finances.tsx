import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, Plus, X, RefreshCw, Edit2, Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types ── */
interface IncomeEntry {
  id: string; client: string; project: string;
  amount: number; currency: string; status: string; month: string;
}
interface DebtEntry {
  id: string; name: string; total_amount: number;
  remaining_amount: number; monthly_payment: number;
  interest_rate?: number; notes: string | null;
}
interface Subscription {
  id: string; name: string; category: string; amount: number;
  currency: string; billing_cycle: string; status: string; notes: string | null;
}

/* ── Palette — electric blue only ── */
const B1 = '#4B9EFF';
const B2 = '#4B9EFFaa';
const B3 = '#4B9EFF55';

/* ── Formatters ── */
function fmtShort(n: number) {
  if (n >= 1_000_000) return 'R' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return 'R' + (n / 1_000).toFixed(1) + 'k';
  return 'R' + n;
}
function fmtFull(n: number) {
  return 'R' + Math.round(n).toLocaleString('en-ZA', { minimumFractionDigits: 0 });
}

/* ── Animated counter ── */
function AnimNum({ value }: { value: number }) {
  const [v, setV] = useState(0);
  const raf = useRef<number>();
  useEffect(() => {
    const start = v, end = value, dur = 900, t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      setV(Math.round(start + (end - start) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  if (v >= 1_000_000) return <>R{(v / 1_000_000).toFixed(1)}M</>;
  if (v >= 1_000)     return <>R{Math.round(v / 1000).toLocaleString()},{String(v % 1000).padStart(3, '0')}</>;
  return <>R{v}</>;
}

/* ── Tooltip ── */
function Tip({ active, payload, label, isDark }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3.5 py-2.5"
      style={{
        background: isDark ? '#111827' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(75,158,255,0.2)' : 'rgba(75,158,255,0.3)'}`,
        boxShadow: `0 4px 20px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.12)'}`,
      }}>
      <p className="text-[9px] uppercase tracking-widest mb-1.5"
        style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)' }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-[11px]">
          <div className="h-[3px] w-3 rounded-full" style={{ background: p.stroke || p.fill || B1 }} />
          <span className="capitalize" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)' }}>{p.name}</span>
          <span className="font-semibold ml-auto pl-3" style={{ color: isDark ? '#fff' : '#111' }}>{fmtFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Months to payoff accounting for compound interest ── */
function calcMonths(remaining: number, monthly: number, annualRate: number): number | null {
  if (monthly <= 0) return null;
  const r = annualRate / 12 / 100;
  if (r === 0) return Math.ceil(remaining / monthly);
  const interest = remaining * r;
  if (monthly <= interest) return null;
  return Math.ceil(-Math.log(1 - interest / monthly) / Math.log(1 + r));
}

/* ════════════════════════════════════════
   Page
════════════════════════════════════════ */
export default function Finances() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  const [entries, setEntries]           = useState<IncomeEntry[]>([]);
  const [debt, setDebt]                 = useState<DebtEntry[]>([]);
  const [subs, setSubs]                 = useState<Subscription[]>([]);
  const [sajonixBal, setSajonixBal]     = useState(71000);
  const [sajonixId, setSajonixId]       = useState('');
  const [editBal, setEditBal]           = useState(false);
  const [balInput, setBalInput]         = useState('');
  const [loading, setLoading]           = useState(true);
  const [spin, setSpin]                 = useState(false);
  const [subTab, setSubTab]             = useState<'business' | 'personal'>('business');
  const [showAddDebt, setShowAddDebt]   = useState(false);
  const [newDebt, setNewDebt]           = useState({ name: '', total_amount: '', remaining_amount: '', monthly_payment: '', interest_rate: '', notes: '' });
  const [showAddSub, setShowAddSub]     = useState(false);
  const [newSub, setNewSub]             = useState({ name: '', amount: '', notes: '' });
  const [editSubId, setEditSubId]       = useState<string | null>(null);
  const [editSubData, setEditSubData]   = useState({ name: '', amount: '', notes: '' });

  // Cast for tables not yet in generated types
  const db = supabase as any;

  const load = async (showSpin = false) => {
    if (showSpin) setSpin(true);
    const [a, b, c, d] = await Promise.all([
      supabase.from('income_entries').select('*').order('month', { ascending: false }),
      supabase.from('debt_entries').select('*'),
      db.from('subscriptions').select('*').order('name'),
      db.from('finance_config').select('*').eq('key', 'sajonix_balance').maybeSingle(),
    ]);
    if (a.data) setEntries(a.data as IncomeEntry[]);
    if (b.data) setDebt(b.data as unknown as DebtEntry[]);
    if (c.data) setSubs(c.data as Subscription[]);
    if (d.data) {
      setSajonixBal(parseInt(d.data.value) || 71000);
      setSajonixId(d.data.id || '');
    }
    setLoading(false);
    if (showSpin) setTimeout(() => setSpin(false), 400);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel('fin3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income_entries' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debt_entries' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addDebt = async () => {
    if (!newDebt.name || !newDebt.total_amount) return;
    const { data } = await supabase.from('debt_entries').insert({
      name: newDebt.name,
      total_amount: parseFloat(newDebt.total_amount),
      remaining_amount: parseFloat(newDebt.remaining_amount || newDebt.total_amount),
      monthly_payment: parseFloat(newDebt.monthly_payment || '0'),
      interest_rate: parseFloat(newDebt.interest_rate || '0'),
      notes: newDebt.notes || null,
    } as any).select().single();
    if (data) {
      setDebt(p => [...p, data as unknown as DebtEntry]);
      setShowAddDebt(false);
      setNewDebt({ name: '', total_amount: '', remaining_amount: '', monthly_payment: '', interest_rate: '', notes: '' });
    }
  };

  const addSub = async () => {
    if (!newSub.name || !newSub.amount) return;
    const { data } = await db.from('subscriptions').insert({
      name: newSub.name,
      category: subTab,
      amount: parseFloat(newSub.amount),
      notes: newSub.notes || null,
    }).select().single();
    if (data) {
      setSubs(p => [...p, data as Subscription].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAddSub(false);
      setNewSub({ name: '', amount: '', notes: '' });
    }
  };

  const deleteSub = async (id: string) => {
    await db.from('subscriptions').delete().eq('id', id);
    setSubs(p => p.filter(s => s.id !== id));
  };

  const updateSub = async () => {
    if (!editSubId) return;
    const { data } = await db.from('subscriptions').update({
      name: editSubData.name,
      amount: parseFloat(editSubData.amount),
      notes: editSubData.notes || null,
    }).eq('id', editSubId).select().single();
    if (data) {
      setSubs(p => p.map(s => s.id === editSubId ? data as Subscription : s));
      setEditSubId(null);
    }
  };

  const saveSajonixBalance = async () => {
    const val = parseInt(balInput);
    if (isNaN(val)) return;
    if (sajonixId) {
      await db.from('finance_config').update({ value: String(val), updated_at: new Date().toISOString() }).eq('id', sajonixId);
    } else {
      const { data } = await db.from('finance_config').upsert({ key: 'sajonix_balance', value: String(val) }).select().single();
      if (data) setSajonixId(data.id);
    }
    setSajonixBal(val);
    setEditBal(false);
  };

  /* ── Derived ── */
  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const thisM       = entries.filter(e => e.month === thisMonth);
  const lastM       = entries.filter(e => e.month === lastMonth);
  const collected   = thisM.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0);
  const outstanding = thisM.filter(e => e.status !== 'paid').reduce((s, e) => s + e.amount, 0);
  const total       = collected + outstanding;
  const lastTotal   = lastM.reduce((s, e) => s + e.amount, 0);
  const allTime     = entries.reduce((s, e) => s + e.amount, 0);
  const collRate    = total > 0 ? Math.round((collected / total) * 100) : 0;
  const mom         = lastTotal > 0 ? Math.round(((total - lastTotal) / lastTotal) * 100) : 0;
  const totalDebt   = debt.reduce((s, d) => s + d.remaining_amount, 0);

  // Subscriptions
  const activeSubs        = subs.filter(s => s.status === 'active');
  const bizSubs           = activeSubs.filter(s => s.category === 'business');
  const persSubs          = activeSubs.filter(s => s.category === 'personal');
  const totalBizSubs      = bizSubs.reduce((s, sub) => s + sub.amount, 0);
  const totalPersSubs     = persSubs.reduce((s, sub) => s + sub.amount, 0);
  const totalSubsMonthly  = activeSubs.reduce((s, sub) => s + sub.amount, 0);

  // Debt summary
  const totalDebtMinimums    = debt.reduce((s, d) => s + d.monthly_payment, 0);
  // Default to 22% SA credit card rate if column not yet in DB
  const totalMonthlyInterest = debt.reduce((s, d) => s + d.remaining_amount * ((d.interest_rate ?? 22) / 12 / 100), 0);

  // Net position
  const mrr          = total;
  const joshDraw     = 36000; // Josh's draw ~R33-40k, using midpoint
  const totalOutflow = totalSubsMonthly + totalDebtMinimums + joshDraw;
  const netSurplus   = mrr - totalOutflow;

  // Avalanche sort — highest interest rate first
  const sortedDebt = [...debt].sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0));

  // Active tab subs
  const tabSubs  = subTab === 'business' ? bizSubs : persSubs;
  const tabTotal = subTab === 'business' ? totalBizSubs : totalPersSubs;

  /* ── Chart data ── */
  const months  = [...new Set(entries.map(e => e.month))].sort().slice(-8);
  const clients = [...new Set(entries.map(e => e.client))].slice(0, 4);
  const lineData = months.map(m => {
    const row: Record<string, any> = { month: m.slice(5) };
    clients.forEach(c => {
      row[c.split(' ')[0]] = entries.filter(e => e.month === m && e.client === c).reduce((s, e) => s + e.amount, 0);
    });
    return row;
  });
  const barData = months.map(m => ({
    month: m.slice(5),
    collected:   entries.filter(e => e.month === m && e.status === 'paid').reduce((s, e) => s + e.amount, 0),
    outstanding: entries.filter(e => e.month === m && e.status !== 'paid').reduce((s, e) => s + e.amount, 0),
  }));
  const clientTotals = clients.map(c => ({
    name: c,
    amount: thisM.filter(e => e.client === c).reduce((s, e) => s + e.amount, 0),
    paid:   thisM.filter(e => e.client === c && e.status === 'paid').reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.amount > 0);

  const lineColors = [B1, B2, B3, '#4B9EFF33'];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-5 w-5 rounded-full border-2 animate-spin"
        style={{ borderColor: B1, borderTopColor: 'transparent' }} />
    </div>
  );

  /* ── Shared styles ── */
  const card = isDark ? {
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '20px',
    boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 32px rgba(0,0,0,0.4)',
  } as React.CSSProperties : {
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  } as React.CSSProperties;

  const dotGrid = {
    backgroundImage: isDark
      ? 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)'
      : 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)',
    backgroundSize: '22px 22px',
  } as React.CSSProperties;

  const txt = {
    label:       isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.4)',
    body:        isDark ? 'rgba(255,255,255,0.7)'  : 'rgba(0,0,0,0.7)',
    muted:       isDark ? 'rgba(255,255,255,0.2)'  : 'rgba(0,0,0,0.3)',
    head:        isDark ? '#ffffff'                 : '#111111',
    sub:         isDark ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.5)',
    divider:     isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    inputBg:     isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    inputBorder: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)',
    chartAxis:   isDark ? 'rgba(255,255,255,0.2)'  : 'rgba(0,0,0,0.35)',
    chartGrid:   isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)',
    ringTrack:   isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    summaryBg:   isDark ? 'rgba(255,255,255,0.015)': 'rgba(0,0,0,0.02)',
  };

  return (
    <div className="space-y-4">

      {/* ══ Row 1: Main chart card + ring ══ */}
      <div className="grid md:grid-cols-3 gap-4">

        {/* Main multi-line chart — 2 cols */}
        <div className="md:col-span-2 p-6" style={card}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: txt.label }}>Revenue Report</p>
              <div className="flex items-center gap-2 mt-0.5">
                {mom !== 0 && (
                  <span className="text-[11px]" style={{ color: mom > 0 ? B1 : txt.muted }}>
                    {mom > 0
                      ? <TrendingUp className="inline h-3 w-3 mr-0.5" />
                      : <TrendingDown className="inline h-3 w-3 mr-0.5" />}
                    {mom > 0 ? '+' : ''}{mom}% vs last month
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => load(true)}
              className="p-1.5 rounded-lg transition-all"
              style={{ color: txt.muted }}>
              <RefreshCw className={cn('h-3.5 w-3.5', spin && 'animate-spin')} />
            </button>
          </div>

          <div className="rounded-xl overflow-hidden" style={dotGrid}>
            {lineData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm" style={{ color: txt.muted }}>
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={lineData} margin={{ top: 16, right: 16, left: -28, bottom: 0 }}>
                  <defs>
                    {[0, 1, 2, 3].map(i => (
                      <linearGradient key={i} id={`lg${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4B9EFF" stopOpacity={isDark ? Math.max(0.06, 0.35 - i * 0.08) : Math.max(0.04, 0.25 - i * 0.06)} />
                        <stop offset="100%" stopColor="#4B9EFF" stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid stroke={txt.chartGrid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: txt.chartAxis }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<Tip isDark={isDark} />} cursor={{ stroke: 'rgba(75,158,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  {clients.map((c, i) => {
                    const key = c.split(' ')[0];
                    return (
                      <Area key={c} type="monotone" dataKey={key}
                        stroke={lineColors[i] || B3} strokeWidth={i === 0 ? 2.5 : 1.5}
                        fill={`url(#lg${i})`}
                        dot={false}
                        activeDot={{ r: 4, fill: lineColors[i] || B3, strokeWidth: 0 }}
                        animationDuration={1200 + i * 200} animationEasing="ease-out"
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex gap-8 mt-5 pb-1">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full" style={{ background: B1, boxShadow: `0 0 6px ${B1}` }} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: txt.label }}>Monthly</span>
              </div>
              <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: txt.head }}>
                <AnimNum value={total} />
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: txt.muted }}>{collRate}% collected</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full" style={{ background: B2 }} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: txt.label }}>All Time</span>
              </div>
              <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: txt.head }}>
                <AnimNum value={allTime} />
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: txt.muted }}>{months.length} months tracked</p>
            </div>
          </div>

          {clientTotals.length > 0 && (
            <div className="mt-4 pt-4 space-y-2.5" style={{ borderTop: `1px solid ${txt.divider}` }}>
              {clientTotals.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ background: lineColors[i] || B3 }} />
                    <span className="text-xs" style={{ color: txt.sub }}>{c.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px]" style={{ color: txt.muted }}>
                      {c.amount > 0 ? Math.round((c.paid / c.amount) * 100) : 0}% paid
                    </span>
                    <span className="text-xs font-semibold tabular-nums w-20 text-right" style={{ color: txt.body }}>
                      {fmtFull(c.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Collection ring card */}
        <div className="p-6 flex flex-col" style={card}>
          <p className="text-[10px] uppercase tracking-widest mb-5" style={{ color: txt.label }}>Collection Rate</p>

          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <div className="relative">
              <svg width={130} height={130} className="-rotate-90">
                <circle cx={65} cy={65} r={52} fill="none" strokeWidth="5" stroke={txt.ringTrack} />
                <circle cx={65} cy={65} r={52} fill="none" strokeWidth="5"
                  stroke={B1} strokeLinecap="round"
                  strokeDasharray={`${(collRate / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                  style={{ filter: isDark ? `drop-shadow(0 0 8px ${B1})` : 'none', transition: 'stroke-dasharray 1.3s cubic-bezier(0.4,0,0.2,1)' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tabular-nums" style={{ color: txt.head }}>{collRate}<span className="text-lg">%</span></span>
                <span className="text-[9px] uppercase tracking-wider" style={{ color: txt.muted }}>this month</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            {[
              { label: 'Collected',   val: collected,   bright: true  },
              { label: 'Outstanding', val: outstanding, bright: false },
              { label: 'Total Debt',  val: totalDebt,   bright: false },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center py-2"
                style={{ borderTop: `1px solid ${txt.divider}` }}>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full"
                    style={{ background: r.bright ? B1 : txt.muted,
                             boxShadow: r.bright && isDark ? `0 0 5px ${B1}` : 'none' }} />
                  <span className="text-[11px]" style={{ color: txt.sub }}>{r.label}</span>
                </div>
                <span className="text-[11px] font-semibold tabular-nums"
                  style={{ color: r.bright ? txt.head : txt.sub }}>
                  {fmtFull(r.val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ Row 2: Bar chart ══ */}
      <div className="p-6" style={card}>
        <p className="text-[10px] uppercase tracking-widest mb-5" style={{ color: txt.label }}>Monthly Breakdown</p>
        <div className="rounded-xl overflow-hidden" style={dotGrid}>
          {barData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm" style={{ color: txt.muted }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }} barGap={3} barCategoryGap="28%">
                <defs>
                  <linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={B1} stopOpacity={1} />
                    <stop offset="100%" stopColor={B1} stopOpacity={0.3} />
                  </linearGradient>
                  <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={B1} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={B1} stopOpacity={0.04} />
                  </linearGradient>
                  <filter id="barshadow">
                    <feDropShadow dx="0" dy="-4" stdDeviation="6" floodColor={B1} floodOpacity={isDark ? '0.5' : '0.3'} />
                  </filter>
                </defs>
                <CartesianGrid stroke={txt.chartGrid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: txt.chartAxis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: txt.chartAxis }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip content={<Tip isDark={isDark} />} cursor={{ fill: isDark ? 'rgba(75,158,255,0.04)' : 'rgba(75,158,255,0.06)' }} />
                <Bar dataKey="collected"   name="collected"   fill="url(#bg1)" radius={[5, 5, 1, 1]}
                  animationDuration={1000} animationEasing="ease-out"
                  style={{ filter: 'url(#barshadow)' }} />
                <Bar dataKey="outstanding" name="outstanding" fill="url(#bg2)" radius={[5, 5, 1, 1]}
                  animationDuration={1200} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="flex gap-5 mt-3">
          {[['Collected', B1, true], ['Outstanding', B3, false]].map(([lbl, col, glow]: any) => (
            <div key={lbl} className="flex items-center gap-1.5">
              <div className="h-[3px] w-4 rounded-full" style={{
                background: col,
                boxShadow: glow && isDark ? `0 0 6px ${col}` : 'none',
              }} />
              <span className="text-[10px]" style={{ color: txt.muted }}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ Row 3: Net Position + Sajonix Balance ══ */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Net Position */}
        <div className="p-6" style={card}>
          <p className="text-[10px] uppercase tracking-widest mb-4" style={{ color: txt.label }}>Net Position</p>
          <div className="space-y-0">
            {[
              { label: 'MRR',           value: mrr,          minus: false, highlight: false },
              { label: "Josh's Draw",   value: joshDraw,     minus: true,  highlight: false },
              { label: 'Subscriptions', value: totalSubsMonthly, minus: true, highlight: false },
              { label: 'Debt Minimums', value: totalDebtMinimums, minus: true, highlight: false },
              { label: 'Net Surplus',   value: netSurplus,   minus: false, highlight: true  },
            ].map((row, i) => (
              <div key={row.label}
                className="flex justify-between items-center py-2"
                style={{ borderTop: i > 0 ? `1px solid ${txt.divider}` : undefined }}>
                <span className="text-[12px]"
                  style={{ color: row.highlight ? (netSurplus >= 0 ? '#4ADE80' : '#F87171') : txt.sub }}>
                  {row.label}
                </span>
                <span className={row.highlight ? 'text-[17px]' : 'text-[13px]'} style={{
                  fontWeight: row.highlight ? 700 : 600,
                  color: row.highlight ? (netSurplus >= 0 ? '#4ADE80' : '#F87171') : row.minus ? '#F87171cc' : txt.head,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {row.minus ? '-' : ''}{fmtFull(Math.abs(row.value))}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${txt.divider}` }}>
            <div className="flex justify-between text-[10px]" style={{ color: txt.muted }}>
              <span>Interest burning/mo (22%)</span>
              <span style={{ color: '#F87171' }}>{fmtFull(Math.round(totalMonthlyInterest))}</span>
            </div>
          </div>
        </div>

        {/* Sajonix Cash */}
        <div className="p-6 flex flex-col" style={card}>
          <p className="text-[10px] uppercase tracking-widest mb-4" style={{ color: txt.label }}>Sajonix Cash</p>
          <div className="flex-1 flex flex-col justify-center">
            {editBal ? (
              <div className="flex items-center gap-2">
                <input
                  value={balInput}
                  onChange={e => setBalInput(e.target.value)}
                  type="number"
                  className="flex-1 rounded-lg text-2xl font-bold px-3 py-2 focus:outline-none tabular-nums"
                  style={{ background: txt.inputBg, border: `1px solid ${B1}50`, color: txt.head }}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveSajonixBalance();
                    if (e.key === 'Escape') setEditBal(false);
                  }}
                />
                <button onClick={saveSajonixBalance}
                  className="p-2 rounded-lg shrink-0"
                  style={{ background: B1, color: '#fff' }}>
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setEditBal(false)}
                  className="p-2 rounded-lg shrink-0"
                  style={{ background: txt.inputBg, color: txt.muted }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-bold tabular-nums" style={{ color: txt.head }}>
                    <AnimNum value={sajonixBal} />
                  </p>
                  <p className="text-[11px] mt-2" style={{ color: txt.muted }}>Current account balance</p>
                </div>
                <button
                  onClick={() => { setBalInput(String(sajonixBal)); setEditBal(true); }}
                  className="p-2 rounded-lg mb-1 opacity-60 hover:opacity-100 transition-opacity"
                  style={{ color: txt.muted }}>
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ Row 4: This month entries + Debt Paydown ══ */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* This month entries */}
        <div style={card}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${txt.divider}` }}>
            <p className="text-sm font-semibold" style={{ color: txt.head }}>{thisMonth}</p>
            <p className="text-[10px]" style={{ color: txt.muted }}>{thisM.length} entries · {fmtFull(total)}</p>
          </div>
          {thisM.length === 0 ? (
            <div className="p-10 text-center text-sm" style={{ color: txt.muted }}>No entries this month</div>
          ) : (
            <div>
              {thisM.map(e => {
                const paid = e.status === 'paid';
                return (
                  <div key={e.id} className="flex items-center justify-between px-5 py-3 transition-colors"
                    style={{ borderBottom: `1px solid ${txt.divider}` }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: paid ? B1 : txt.muted,
                                 boxShadow: paid && isDark ? `0 0 5px ${B1}` : 'none' }} />
                      <div className="min-w-0">
                        <p className="text-[13px] truncate" style={{ color: txt.body }}>{e.project}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: txt.muted }}>{e.client}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-[13px] font-semibold tabular-nums" style={{ color: txt.head }}>{fmtFull(e.amount)}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: paid ? B1 : txt.muted }}>
                        {paid ? 'Paid' : e.status === 'invoice_sent' ? 'Sent' : 'Pending'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Debt Paydown Tracker */}
        <div style={card}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${txt.divider}` }}>
            <p className="text-sm font-semibold" style={{ color: txt.head }}>Debt Paydown</p>
            <button onClick={() => setShowAddDebt(v => !v)}
              className="flex items-center gap-1 text-[11px] font-medium"
              style={{ color: B1 }}>
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>

          {/* Debt summary strip */}
          <div className="px-5 py-3 grid grid-cols-3 gap-2 text-center"
            style={{ borderBottom: `1px solid ${txt.divider}`, background: txt.summaryBg }}>
            {[
              { label: 'Total Owed',  value: fmtFull(totalDebt)                     },
              { label: 'Min/mo',      value: fmtFull(totalDebtMinimums)              },
              { label: 'Interest/mo', value: fmtFull(Math.round(totalMonthlyInterest)) },
            ].map(s => (
              <div key={s.label}>
                <p className="text-[9px] uppercase tracking-wider" style={{ color: txt.label }}>{s.label}</p>
                <p className="text-[12px] font-semibold tabular-nums mt-0.5" style={{ color: s.label === 'Interest/mo' ? '#F87171' : txt.body }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Add debt form */}
          {showAddDebt && (
            <div className="p-4 space-y-2.5" style={{ borderBottom: `1px solid ${txt.divider}` }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: txt.body }}>New debt entry</span>
                <button onClick={() => setShowAddDebt(false)} style={{ color: txt.muted }}><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { ph: 'Name',            key: 'name',             span: true  },
                  { ph: 'Total amount',    key: 'total_amount',     type: 'number' },
                  { ph: 'Remaining',       key: 'remaining_amount', type: 'number' },
                  { ph: 'Monthly payment', key: 'monthly_payment',  type: 'number' },
                  { ph: 'Interest rate %', key: 'interest_rate',    type: 'number' },
                  { ph: 'Notes',           key: 'notes' },
                ].map(f => (
                  <input key={f.key} placeholder={f.ph} type={f.type || 'text'}
                    value={(newDebt as any)[f.key]}
                    onChange={ev => setNewDebt(p => ({ ...p, [f.key]: ev.target.value }))}
                    className={cn(f.span ? 'col-span-2' : '', 'rounded-lg text-xs px-3 py-1.5 focus:outline-none')}
                    style={{ background: txt.inputBg, border: `1px solid ${txt.inputBorder}`, color: txt.body }}
                  />
                ))}
              </div>
              <button onClick={addDebt} className="w-full rounded-lg text-white text-xs font-semibold py-2 transition-all"
                style={{ background: B1, boxShadow: isDark ? `0 0 14px ${B1}50` : 'none' }}>
                Save
              </button>
            </div>
          )}

          {sortedDebt.length === 0 ? (
            <div className="p-10 text-center text-sm" style={{ color: txt.muted }}>No debts tracked</div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
              {sortedDebt.map((d, idx) => {
                const rate    = d.interest_rate ?? 22;
                const pct     = d.total_amount > 0 ? Math.max(0, Math.min(100, ((d.total_amount - d.remaining_amount) / d.total_amount) * 100)) : 0;
                const mths    = calcMonths(d.remaining_amount, d.monthly_payment, rate);
                const intCost = Math.round(d.remaining_amount * (rate / 12 / 100));
                const isTop   = idx === 0 && sortedDebt.length > 1;
                return (
                  <div key={d.id} className="px-5 py-4 space-y-2"
                    style={{ borderBottom: `1px solid ${txt.divider}` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[13px] font-semibold truncate" style={{ color: txt.body }}>{d.name}</span>
                        {isTop && (
                          <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                            style={{ background: `${B1}22`, color: B1, border: `1px solid ${B1}44` }}>
                            avalanche
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-medium" style={{ color: txt.sub }}>{fmtFull(d.monthly_payment)}/mo</p>
                        <p className="text-[9px]" style={{ color: txt.muted }}>{d.interest_rate ?? 22}% p.a.</p>
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px]" style={{ color: txt.muted }}>
                      <span>{fmtFull(d.remaining_amount)} remaining</span>
                      <div className="flex items-center gap-2">
                        <span style={{ color: '#F87171' }}>{fmtFull(intCost)}/mo interest</span>
                        {mths && <span>· {mths}mo left</span>}
                      </div>
                    </div>
                    <div className="h-[3px] rounded-full overflow-hidden" style={{ background: txt.ringTrack }}>
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${pct}%`, background: B1, boxShadow: isDark && pct > 0 ? `0 0 8px ${B1}` : 'none' }} />
                    </div>
                    {d.notes && <p className="text-[10px]" style={{ color: txt.muted }}>{d.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ Row 5: Subscriptions ══ */}
      <div style={card}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${txt.divider}` }}>
          <p className="text-sm font-semibold" style={{ color: txt.head }}>Subscriptions</p>
          <div className="flex items-center gap-3">
            {/* Business / Personal tabs */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${txt.inputBorder}` }}>
              {(['business', 'personal'] as const).map(t => (
                <button key={t} onClick={() => { setSubTab(t); setShowAddSub(false); }}
                  className="text-[11px] px-3 py-1 capitalize transition-all"
                  style={{
                    background: subTab === t ? B1 : 'transparent',
                    color: subTab === t ? '#fff' : txt.muted,
                  }}>
                  {t}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAddSub(v => !v)}
              className="flex items-center gap-1 text-[11px] font-medium"
              style={{ color: B1 }}>
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
        </div>

        {/* Add subscription form */}
        {showAddSub && (
          <div className="px-5 py-4 space-y-2.5" style={{ borderBottom: `1px solid ${txt.divider}` }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium capitalize" style={{ color: txt.body }}>New {subTab} subscription</span>
              <button onClick={() => setShowAddSub(false)} style={{ color: txt.muted }}><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex gap-2">
              <input placeholder="Name" value={newSub.name}
                onChange={e => setNewSub(p => ({ ...p, name: e.target.value }))}
                className="flex-1 rounded-lg text-xs px-3 py-1.5 focus:outline-none"
                style={{ background: txt.inputBg, border: `1px solid ${txt.inputBorder}`, color: txt.body }}
              />
              <input placeholder="R/mo" type="number" value={newSub.amount}
                onChange={e => setNewSub(p => ({ ...p, amount: e.target.value }))}
                className="w-24 rounded-lg text-xs px-3 py-1.5 focus:outline-none"
                style={{ background: txt.inputBg, border: `1px solid ${txt.inputBorder}`, color: txt.body }}
              />
              <input placeholder="Notes (optional)" value={newSub.notes}
                onChange={e => setNewSub(p => ({ ...p, notes: e.target.value }))}
                className="w-36 rounded-lg text-xs px-3 py-1.5 focus:outline-none"
                style={{ background: txt.inputBg, border: `1px solid ${txt.inputBorder}`, color: txt.body }}
              />
              <button onClick={addSub}
                className="px-4 rounded-lg text-white text-xs font-semibold py-1.5"
                style={{ background: B1, boxShadow: isDark ? `0 0 12px ${B1}50` : 'none' }}>
                Add
              </button>
            </div>
          </div>
        )}

        {/* Subscriptions list */}
        {tabSubs.length === 0 ? (
          <div className="p-10 text-center text-sm" style={{ color: txt.muted }}>No {subTab} subscriptions</div>
        ) : (
          <>
            {tabSubs.map(sub => (
              <div key={sub.id} className="flex items-center gap-3 px-5 py-3"
                style={{ borderBottom: `1px solid ${txt.divider}` }}>
                {editSubId === sub.id ? (
                  <>
                    <input value={editSubData.name}
                      onChange={e => setEditSubData(p => ({ ...p, name: e.target.value }))}
                      className="flex-1 rounded-lg text-xs px-2 py-1 focus:outline-none"
                      style={{ background: txt.inputBg, border: `1px solid ${B1}40`, color: txt.body }}
                    />
                    <input value={editSubData.amount} type="number"
                      onChange={e => setEditSubData(p => ({ ...p, amount: e.target.value }))}
                      className="w-20 rounded-lg text-xs px-2 py-1 focus:outline-none"
                      style={{ background: txt.inputBg, border: `1px solid ${B1}40`, color: txt.body }}
                    />
                    <input value={editSubData.notes} placeholder="Notes"
                      onChange={e => setEditSubData(p => ({ ...p, notes: e.target.value }))}
                      className="w-28 rounded-lg text-xs px-2 py-1 focus:outline-none"
                      style={{ background: txt.inputBg, border: `1px solid ${B1}40`, color: txt.body }}
                    />
                    <button onClick={updateSub} className="p-1 rounded shrink-0" style={{ color: B1 }}>
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditSubId(null)} className="p-1 rounded shrink-0" style={{ color: txt.muted }}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: B1 }} />
                    <span className="text-[13px] flex-1" style={{ color: txt.body }}>{sub.name}</span>
                    {sub.notes && (
                      <span className="text-[10px] hidden sm:block" style={{ color: txt.muted }}>{sub.notes}</span>
                    )}
                    <span className="text-[13px] font-semibold tabular-nums w-24 text-right shrink-0" style={{ color: txt.head }}>
                      {fmtFull(sub.amount)}/mo
                    </span>
                    <button
                      onClick={() => {
                        setEditSubId(sub.id);
                        setEditSubData({ name: sub.name, amount: String(sub.amount), notes: sub.notes || '' });
                      }}
                      className="p-1 rounded shrink-0 opacity-40 hover:opacity-80 transition-opacity"
                      style={{ color: txt.muted }}>
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button onClick={() => deleteSub(sub.id)}
                      className="p-1 rounded shrink-0 opacity-40 hover:opacity-80 transition-opacity"
                      style={{ color: txt.muted }}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            ))}
            {/* Category total */}
            <div className="px-5 py-3 flex justify-between items-center"
              style={{ background: txt.summaryBg }}>
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: txt.label }}>
                {subTab} total
              </span>
              <span className="text-[14px] font-bold tabular-nums" style={{ color: txt.head }}>
                {fmtFull(tabTotal)}/mo
              </span>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
