import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, Plus, X, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types ── */
interface IncomeEntry {
  id: string; client: string; project: string;
  amount: number; currency: string; status: string; month: string;
}
interface DebtEntry {
  id: string; name: string; total_amount: number;
  remaining_amount: number; monthly_payment: number; notes: string | null;
}

/* ── Palette — electric blue only ── */
const B1 = '#4B9EFF';       // solid blue
const B2 = '#4B9EFFaa';     // 67%
const B3 = '#4B9EFF55';     // 33%
const B4 = '#4B9EFF22';     // fill

/* ── Formatters ── */
function fmtShort(n: number) {
  if (n >= 1_000_000) return 'R' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return 'R' + (n / 1_000).toFixed(1) + 'k';
  return 'R' + n;
}
function fmtFull(n: number) {
  return 'R' + n.toLocaleString('en-ZA', { minimumFractionDigits: 0 });
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
  }, [value]);
  if (v >= 1_000_000) return <>${(v / 1_000_000).toFixed(1)}M</>;
  if (v >= 1_000)     return <>R{Math.round(v / 1000).toLocaleString()},{String(v % 1000).padStart(3, '0')}</>;
  return <>R{v}</>;
}

/* ── Tooltip (theme-aware) ── */
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

/* ── Custom endpoint dot (shows value label at last point) ── */
function EndDot({ cx, cy, value, isLast, color }: any) {
  if (!isLast || !cx || !cy) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      <text x={cx + 8} y={cy + 4} fill={color} fontSize={10} fontWeight={700}>
        {fmtShort(value)}
      </text>
    </g>
  );
}

/* ── SVG ring ── */
function Ring({ pct, size = 110 }: { pct: number; size?: number }) {
  const r = size * 0.4, circ = 2 * Math.PI * r;
  const [d, setD] = useState(0);
  useEffect(() => { const t = setTimeout(() => setD(pct), 150); return () => clearTimeout(t); }, [pct]);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth="5" stroke="rgba(255,255,255,0.05)" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth="5"
        stroke={B1} strokeLinecap="round"
        strokeDasharray={`${(d/100)*circ} ${circ}`}
        style={{ filter: `drop-shadow(0 0 8px ${B1})`, transition: 'stroke-dasharray 1.3s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

/* ════════════════════════════════════════
   Page
════════════════════════════════════════ */
export default function Finances() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  const [entries, setEntries]         = useState<IncomeEntry[]>([]);
  const [debt, setDebt]               = useState<DebtEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [spin, setSpin]               = useState(false);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [newDebt, setNewDebt] = useState({ name:'', total_amount:'', remaining_amount:'', monthly_payment:'', notes:'' });

  const load = async (showSpin = false) => {
    if (showSpin) setSpin(true);
    const [a, b] = await Promise.all([
      supabase.from('income_entries').select('*').order('month', { ascending: false }),
      supabase.from('debt_entries').select('*').order('created_at', { ascending: false }),
    ]);
    if (a.data) setEntries(a.data as IncomeEntry[]);
    if (b.data) setDebt(b.data as DebtEntry[]);
    setLoading(false);
    if (showSpin) setTimeout(() => setSpin(false), 400);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel('fin2')
      .on('postgres_changes', { event:'*', schema:'public', table:'income_entries' }, () => load())
      .on('postgres_changes', { event:'*', schema:'public', table:'debt_entries'   }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const addDebt = async () => {
    if (!newDebt.name || !newDebt.total_amount) return;
    const { data } = await supabase.from('debt_entries').insert({
      name: newDebt.name,
      total_amount: parseFloat(newDebt.total_amount),
      remaining_amount: parseFloat(newDebt.remaining_amount || newDebt.total_amount),
      monthly_payment: parseFloat(newDebt.monthly_payment || '0'),
      notes: newDebt.notes || null,
    }).select().single();
    if (data) {
      setDebt(p => [data as DebtEntry, ...p]);
      setShowAddDebt(false);
      setNewDebt({ name:'', total_amount:'', remaining_amount:'', monthly_payment:'', notes:'' });
    }
  };

  /* ── Derived ── */
  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const lastMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth()-1, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();

  const thisM = entries.filter(e => e.month === thisMonth);
  const lastM = entries.filter(e => e.month === lastMonth);

  const collected   = thisM.filter(e => e.status==='paid').reduce((s,e) => s+e.amount, 0);
  const outstanding = thisM.filter(e => e.status!=='paid').reduce((s,e) => s+e.amount, 0);
  const total       = collected + outstanding;
  const lastTotal   = lastM.reduce((s,e) => s+e.amount, 0);
  const allTime     = entries.reduce((s,e) => s+e.amount, 0);
  const collRate    = total > 0 ? Math.round((collected/total)*100) : 0;
  const mom         = lastTotal > 0 ? Math.round(((total-lastTotal)/lastTotal)*100) : 0;
  const totalDebt   = debt.reduce((s,d) => s+d.remaining_amount, 0);

  /* ── Chart data ── */
  const months = [...new Set(entries.map(e => e.month))].sort().slice(-8);

  // Per-client trend lines (3 clients → 3 series)
  const clients = [...new Set(entries.map(e => e.client))].slice(0, 3);
  const lineData = months.map(m => {
    const row: Record<string, any> = { month: m.slice(5) };
    clients.forEach(c => {
      row[c.split(' ')[0]] = entries.filter(e => e.month===m && e.client===c).reduce((s,e) => s+e.amount, 0);
    });
    return row;
  });
  const chartData = lineData;

  // Bar data
  const barData = months.map(m => ({
    month: m.slice(5),
    collected:   entries.filter(e => e.month===m && e.status==='paid').reduce((s,e) => s+e.amount, 0),
    outstanding: entries.filter(e => e.month===m && e.status!=='paid').reduce((s,e) => s+e.amount, 0),
  }));

  // Client totals (this month)
  const clientTotals = clients.map(c => ({
    name: c,
    amount: thisM.filter(e => e.client===c).reduce((s,e) => s+e.amount, 0),
    paid:   thisM.filter(e => e.client===c && e.status==='paid').reduce((s,e) => s+e.amount, 0),
  })).filter(c => c.amount > 0);

  const lineColors = [B1, B2, B3];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-5 w-5 rounded-full border-2 animate-spin"
        style={{ borderColor: B1, borderTopColor:'transparent' }} />
    </div>
  );

  /* shared card style */
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

  /* dot grid pattern for chart backgrounds */
  const dotGrid = {
    backgroundImage: isDark
      ? 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)'
      : 'radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)',
    backgroundSize: '22px 22px',
  } as React.CSSProperties;

  /* theme-aware text helpers */
  const txt = {
    label: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.4)',
    body:  isDark ? 'rgba(255,255,255,0.7)'  : 'rgba(0,0,0,0.7)',
    muted: isDark ? 'rgba(255,255,255,0.2)'  : 'rgba(0,0,0,0.3)',
    head:  isDark ? '#ffffff'                 : '#111111',
    sub:   isDark ? 'rgba(255,255,255,0.5)'  : 'rgba(0,0,0,0.5)',
    divider: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    inputBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    inputBorder: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)',
    rowHover: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
    chartAxis: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.35)',
    chartGrid: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)',
    ringTrack: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
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

          {/* Chart with dot-grid background */}
          <div className="rounded-xl overflow-hidden" style={dotGrid}>
            {chartData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm" style={{ color: txt.muted }}>
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={chartData} margin={{ top: 16, right: 16, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lg0" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4B9EFF" stopOpacity={isDark ? 0.35 : 0.25} />
                      <stop offset="100%" stopColor="#4B9EFF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4B9EFF" stopOpacity={isDark ? 0.15 : 0.12} />
                      <stop offset="100%" stopColor="#4B9EFF" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4B9EFF" stopOpacity={isDark ? 0.08 : 0.06} />
                      <stop offset="100%" stopColor="#4B9EFF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={txt.chartGrid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: txt.chartAxis }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<Tip isDark={isDark} />} cursor={{ stroke: 'rgba(75,158,255,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  {clients.map((c, i) => {
                    const key = c.split(' ')[0];
                    const colors = ['#4B9EFF', '#4B9EFFaa', '#4B9EFF55'];
                    return (
                      <Area key={c} type="monotone" dataKey={key}
                        stroke={colors[i]} strokeWidth={i === 0 ? 2.5 : 1.5}
                        fill={`url(#lg${i})`}
                        dot={false}
                        activeDot={{ r: 4, fill: colors[i], strokeWidth: 0 }}
                        animationDuration={1200 + i * 200} animationEasing="ease-out"
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Big numbers below chart */}
          <div className="flex gap-8 mt-5 pb-1">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full" style={{ background: B1, boxShadow:`0 0 6px ${B1}` }} />
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

          {/* Client breakdown table */}
          {clientTotals.length > 0 && (
            <div className="mt-4 pt-4 space-y-2.5" style={{ borderTop: `1px solid ${txt.divider}` }}>
              {clientTotals.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ background: lineColors[i] }} />
                    <span className="text-xs" style={{ color: txt.sub }}>{c.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px]" style={{ color: txt.muted }}>
                      {c.amount > 0 ? Math.round((c.paid/c.amount)*100) : 0}% paid
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
                  strokeDasharray={`${(collRate/100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
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
              { label: 'Collected',   val: collected,   bright: true },
              { label: 'Outstanding', val: outstanding, bright: false },
              { label: 'Debt',        val: totalDebt,   bright: false },
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
                    <feDropShadow dx="0" dy="-4" stdDeviation="6" floodColor={B1} floodOpacity={isDark ? "0.5" : "0.3"} />
                  </filter>
                </defs>
                <CartesianGrid stroke={txt.chartGrid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize:10, fill:txt.chartAxis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:txt.chartAxis }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : String(v)} />
                <Tooltip content={<Tip isDark={isDark} />} cursor={{ fill: isDark ? 'rgba(75,158,255,0.04)' : 'rgba(75,158,255,0.06)' }} />
                <Bar dataKey="collected"   name="collected"   fill="url(#bg1)" radius={[5,5,1,1]}
                  animationDuration={1000} animationEasing="ease-out"
                  style={{ filter:'url(#barshadow)' }} />
                <Bar dataKey="outstanding" name="outstanding" fill="url(#bg2)" radius={[5,5,1,1]}
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

      {/* ══ Row 3: Entries + Debt side by side ══ */}
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

        {/* Debt tracker */}
        <div style={card}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${txt.divider}` }}>
            <p className="text-sm font-semibold" style={{ color: txt.head }}>Debt Tracker</p>
            <button onClick={() => setShowAddDebt(true)}
              className="flex items-center gap-1 text-[11px] font-medium transition-colors"
              style={{ color: B1 }}>
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>

          {showAddDebt && (
            <div className="p-4 space-y-2.5" style={{ borderBottom: `1px solid ${txt.divider}` }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: txt.body }}>New entry</span>
                <button onClick={() => setShowAddDebt(false)} style={{ color: txt.muted }}><X className="h-3.5 w-3.5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { ph:'Name',             key:'name',            span:true  },
                  { ph:'Total',            key:'total_amount',    type:'number' },
                  { ph:'Remaining',        key:'remaining_amount',type:'number' },
                  { ph:'Monthly payment',  key:'monthly_payment', type:'number' },
                  { ph:'Notes',            key:'notes' },
                ].map(f => (
                  <input key={f.key} placeholder={f.ph} type={f.type||'text'}
                    value={(newDebt as any)[f.key]}
                    onChange={ev => setNewDebt(p => ({...p,[f.key]:ev.target.value}))}
                    className={cn(f.span?'col-span-2':'','rounded-lg text-xs px-3 py-1.5 focus:outline-none')}
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

          {debt.length === 0 ? (
            <div className="p-10 text-center text-sm" style={{ color: txt.muted }}>No debts tracked</div>
          ) : (
            <div>
              {debt.map(d => {
                const pct  = Math.max(0, Math.min(100, d.total_amount > 0 ? ((d.total_amount - d.remaining_amount) / d.total_amount) * 100 : 0));
                const mths = d.monthly_payment > 0 ? Math.ceil(d.remaining_amount / d.monthly_payment) : null;
                return (
                  <div key={d.id} className="px-5 py-4 space-y-2.5" style={{ borderBottom: `1px solid ${txt.divider}` }}>
                    <div className="flex items-start justify-between">
                      <span className="text-[13px] font-semibold" style={{ color: txt.body }}>{d.name}</span>
                      <div className="text-right">
                        <p className="text-[11px] font-medium" style={{ color: txt.sub }}>{fmtFull(d.monthly_payment)}/mo</p>
                        {mths && <p className="text-[9px]" style={{ color: txt.muted }}>{mths}mo left</p>}
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px]" style={{ color: txt.muted }}>
                      <span>{fmtFull(d.remaining_amount)} remaining</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <div className="h-[3px] rounded-full overflow-hidden" style={{ background: txt.ringTrack }}>
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width:`${pct}%`, background: B1, boxShadow: isDark ? `0 0 8px ${B1}` : 'none' }} />
                    </div>
                    {d.notes && <p className="text-[10px]" style={{ color: txt.muted }}>{d.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
