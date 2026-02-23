import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, Plus, X, DollarSign, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────── Types ─────────────── */
interface IncomeEntry {
  id: string; client: string; project: string;
  amount: number; currency: string; status: string; month: string;
}
interface DebtEntry {
  id: string; name: string; total_amount: number;
  remaining_amount: number; monthly_payment: number; notes: string | null;
}

/* ─────────────── Constants ─────────────── */
const BLUE = '#4B9EFF';  // electric blue
const BLUE_DIM = '#4B9EFF55';
const BLUE_FILL = '#4B9EFF22';

function fmt(n: number) {
  if (n >= 1_000_000) return 'R' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return 'R' + (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'k';
  return 'R' + n.toLocaleString('en-ZA', { minimumFractionDigits: 0 });
}
function fmtFull(n: number) {
  return 'R' + n.toLocaleString('en-ZA', { minimumFractionDigits: 0 });
}

/* ─────────────── Custom tooltip ─────────────── */
function BlueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-black/90 backdrop-blur-md px-4 py-3 shadow-2xl"
      style={{ boxShadow: `0 0 24px ${BLUE}30` }}>
      <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2.5 text-sm">
          <div className="h-1 w-4 rounded-full" style={{ background: p.fill || p.stroke || BLUE }} />
          <span className="text-white/60 text-xs capitalize">{p.name}</span>
          <span className="font-bold text-white ml-auto pl-4">{fmtFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────── Animated counter ─────────────── */
function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>();

  useEffect(() => {
    const start = display;
    const end   = value;
    const dur   = 800;
    const t0    = performance.now();
    const tick  = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + (end - start) * ease));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);

  if (value >= 1_000_000) return <>{prefix}R{(display / 1_000_000).toFixed(1)}M</>;
  if (value >= 1_000)     return <>{prefix}R{(display / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k</>;
  return <>{prefix}R{display.toLocaleString('en-ZA')}</>;
}

/* ─────────────── Radial ring ─────────────── */
function Ring({ pct }: { pct: number }) {
  const r    = 44;
  const circ = 2 * Math.PI * r;
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(pct), 100);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <svg width="110" height="110" className="-rotate-90">
      <circle cx="55" cy="55" r={r} fill="none" strokeWidth="6"
        stroke="rgba(255,255,255,0.06)" />
      <circle cx="55" cy="55" r={r} fill="none" strokeWidth="6"
        stroke={BLUE} strokeLinecap="round"
        strokeDasharray={`${(drawn / 100) * circ} ${circ}`}
        style={{
          filter: `drop-shadow(0 0 8px ${BLUE})`,
          transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)',
        }}
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   Main component
══════════════════════════════════════════════ */
export default function Finances() {
  const [entries, setEntries]         = useState<IncomeEntry[]>([]);
  const [debt, setDebt]               = useState<DebtEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [newDebt, setNewDebt] = useState({
    name: '', total_amount: '', remaining_amount: '', monthly_payment: '', notes: '',
  });

  const fetchData = async (showSpin = false) => {
    if (showSpin) setRefreshing(true);
    const [incRes, debtRes] = await Promise.all([
      supabase.from('income_entries').select('*').order('month', { ascending: false }),
      supabase.from('debt_entries').select('*').order('created_at', { ascending: false }),
    ]);
    if (incRes.data)  setEntries(incRes.data as IncomeEntry[]);
    if (debtRes.data) setDebt(debtRes.data as DebtEntry[]);
    setLoading(false);
    if (showSpin) setTimeout(() => setRefreshing(false), 400);
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('fin_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income_entries' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debt_entries' },   () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const handleAddDebt = async () => {
    if (!newDebt.name || !newDebt.total_amount) return;
    const { data } = await supabase.from('debt_entries').insert({
      name: newDebt.name,
      total_amount: parseFloat(newDebt.total_amount),
      remaining_amount: parseFloat(newDebt.remaining_amount || newDebt.total_amount),
      monthly_payment: parseFloat(newDebt.monthly_payment || '0'),
      notes: newDebt.notes || null,
    }).select().single();
    if (data) {
      setDebt(prev => [data as DebtEntry, ...prev]);
      setShowAddDebt(false);
      setNewDebt({ name: '', total_amount: '', remaining_amount: '', monthly_payment: '', notes: '' });
    }
  };

  /* ── Computed ── */
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const thisM = entries.filter(e => e.month === thisMonth);
  const lastM = entries.filter(e => e.month === lastMonth);

  const collected   = thisM.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0);
  const outstanding = thisM.filter(e => e.status !== 'paid').reduce((s, e) => s + e.amount, 0);
  const total       = collected + outstanding;
  const lastTotal   = lastM.reduce((s, e) => s + e.amount, 0);
  const collRate    = total > 0 ? Math.round((collected / total) * 100) : 0;
  const mom         = lastTotal > 0 ? Math.round(((total - lastTotal) / lastTotal) * 100) : 0;
  const totalDebt   = debt.reduce((s, d) => s + d.remaining_amount, 0);

  /* ── Chart data — last 8 months ── */
  const months = [...new Set(entries.map(e => e.month))].sort().slice(-8);
  const chartData = months.map(m => ({
    month: m.slice(5),
    collected: entries.filter(e => e.month === m && e.status === 'paid').reduce((s, e) => s + e.amount, 0),
    outstanding: entries.filter(e => e.month === m && e.status !== 'paid').reduce((s, e) => s + e.amount, 0),
  }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-6 w-6 rounded-full border-2 animate-spin"
        style={{ borderColor: BLUE, borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── Hero area chart ── */}
      <div className="rounded-2xl overflow-hidden" style={{
        background: 'linear-gradient(180deg, rgba(75,158,255,0.06) 0%, transparent 100%)',
        border: '1px solid rgba(75,158,255,0.12)',
        boxShadow: `0 0 40px ${BLUE}10`,
      }}>
        <div className="px-6 pt-6 pb-2 flex items-start justify-between">
          <div>
            <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Revenue trend</p>
            <p className="text-3xl font-bold text-white tabular-nums">{fmtFull(total)}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {mom !== 0 && (
                <>
                  {mom > 0
                    ? <TrendingUp className="h-3 w-3" style={{ color: BLUE }} />
                    : <TrendingDown className="h-3 w-3 text-white/40" />}
                  <span className="text-xs" style={{ color: mom > 0 ? BLUE : 'rgba(255,255,255,0.4)' }}>
                    {mom > 0 ? '+' : ''}{mom}% vs last month
                  </span>
                </>
              )}
            </div>
          </div>
          <button onClick={() => fetchData(true)}
            className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={BLUE} stopOpacity={0.35} />
                <stop offset="60%"  stopColor={BLUE} stopOpacity={0.08} />
                <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="areaFill2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={BLUE} stopOpacity={0.12} />
                <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
              </linearGradient>
              <filter id="glow">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={BLUE} floodOpacity="0.8" />
              </filter>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.25)' }}
              axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<BlueTooltip />} cursor={{ stroke: `${BLUE}40`, strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area type="monotone" dataKey="collected" name="collected"
              stroke={BLUE} strokeWidth={2.5} fill="url(#areaFill)"
              dot={false} activeDot={{ r: 5, fill: BLUE, strokeWidth: 0, style: { filter: `drop-shadow(0 0 6px ${BLUE})` } }}
              animationDuration={1400} animationEasing="ease-out"
              style={{ filter: 'url(#glow)' }}
            />
            <Area type="monotone" dataKey="outstanding" name="outstanding"
              stroke={`${BLUE}55`} strokeWidth={1.5} fill="url(#areaFill2)"
              dot={false} activeDot={{ r: 3, fill: BLUE, strokeWidth: 0 }}
              animationDuration={1600} animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Collected',     val: collected,   pct: null },
          { label: 'Outstanding',   val: outstanding, pct: null },
          { label: 'Total Invoiced',val: total,       pct: null },
          { label: 'Debt Remaining',val: totalDebt,   pct: null },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-5 relative overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
            {/* Corner glow */}
            <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-20 blur-2xl"
              style={{ background: BLUE }} />
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">{s.label}</p>
            <p className="text-2xl font-bold text-white tabular-nums leading-none">
              <AnimatedNumber value={s.val} />
            </p>
          </div>
        ))}
      </div>

      {/* ── Bar chart + Collection ring ── */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Bar chart — 2 cols */}
        <div className="md:col-span-2 rounded-2xl p-6"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs text-white/30 uppercase tracking-widest mb-5">Monthly Breakdown</p>
          {chartData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm text-white/20">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }} barGap={4} barCategoryGap="30%">
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={BLUE} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={BLUE} stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="barGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={BLUE} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={BLUE} stopOpacity={0.05} />
                  </linearGradient>
                  <filter id="barGlow">
                    <feDropShadow dx="0" dy="-3" stdDeviation="5" floodColor={BLUE} floodOpacity="0.5" />
                  </filter>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.25)' }}
                  axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.25)' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip content={<BlueTooltip />} cursor={{ fill: 'rgba(75,158,255,0.04)' }} />
                <Bar dataKey="collected" name="collected" fill="url(#barGrad)"
                  radius={[6, 6, 2, 2]} animationDuration={1000} animationEasing="ease-out"
                  style={{ filter: 'url(#barGlow)' }} />
                <Bar dataKey="outstanding" name="outstanding" fill="url(#barGrad2)"
                  radius={[6, 6, 2, 2]} animationDuration={1200} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* Legend */}
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-4 rounded-full" style={{ background: BLUE }} />
              <span className="text-[10px] text-white/30">Collected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-4 rounded-full" style={{ background: BLUE_DIM }} />
              <span className="text-[10px] text-white/30">Outstanding</span>
            </div>
          </div>
        </div>

        {/* Collection rate ring */}
        <div className="rounded-2xl p-6 flex flex-col items-center justify-center gap-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs text-white/30 uppercase tracking-widest self-start">Collection Rate</p>
          <div className="relative flex items-center justify-center">
            <Ring pct={collRate} />
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-bold text-white tabular-nums">{collRate}%</span>
              <span className="text-[9px] text-white/30 uppercase tracking-wider">this month</span>
            </div>
          </div>
          <div className="w-full space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-white/40">Collected</span>
              <span className="text-white font-semibold tabular-nums">{fmtFull(collected)}</span>
            </div>
            <div className="h-px bg-white/5" />
            <div className="flex justify-between items-center">
              <span className="text-white/40">Outstanding</span>
              <span className="text-white/60 font-semibold tabular-nums">{fmtFull(outstanding)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── This month entries ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">{thisMonth}</p>
            <p className="text-[10px] text-white/30 mt-0.5">{thisM.length} entries · {fmtFull(total)} total</p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
            <DollarSign className="h-3 w-3" />
            {fmtFull(collected)} in
          </div>
        </div>
        {thisM.length === 0 ? (
          <div className="p-10 text-center text-sm text-white/20">No entries this month</div>
        ) : (
          <div className="divide-y divide-white/5">
            {thisM.map(entry => {
              const paid = entry.status === 'paid';
              return (
                <div key={entry.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{
                        background: paid ? BLUE : 'rgba(255,255,255,0.2)',
                        boxShadow: paid ? `0 0 6px ${BLUE}` : 'none',
                      }} />
                    <div className="min-w-0">
                      <p className="text-sm text-white/80 truncate">{entry.project}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{entry.client}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-semibold text-white tabular-nums">{fmtFull(entry.amount)}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: paid ? BLUE : 'rgba(255,255,255,0.3)' }}>
                      {paid ? 'Paid' : entry.status === 'invoice_sent' ? 'Invoice sent' : 'Pending'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Debt tracker ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-white/30 uppercase tracking-widest">Debt Tracker</p>
          <button onClick={() => setShowAddDebt(true)}
            className="flex items-center gap-1 text-xs font-medium transition-colors"
            style={{ color: BLUE }}>
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>

        {showAddDebt && (
          <div className="rounded-2xl p-4 mb-3 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">New Debt Entry</span>
              <button onClick={() => setShowAddDebt(false)} className="text-white/30 hover:text-white/60"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { ph: 'Name', key: 'name', span: true },
                { ph: 'Total amount', key: 'total_amount', type: 'number' },
                { ph: 'Remaining',    key: 'remaining_amount', type: 'number' },
                { ph: 'Monthly payment', key: 'monthly_payment', type: 'number' },
                { ph: 'Notes (optional)', key: 'notes' },
              ].map(f => (
                <input key={f.key} placeholder={f.ph} type={f.type || 'text'}
                  value={(newDebt as any)[f.key]}
                  onChange={e => setNewDebt(p => ({ ...p, [f.key]: e.target.value }))}
                  className={cn(f.span ? 'col-span-2' : '', 'rounded-lg text-white text-xs px-3 py-2 focus:outline-none transition-colors placeholder:text-white/20')}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              ))}
            </div>
            <button onClick={handleAddDebt}
              className="w-full rounded-xl text-white text-xs font-semibold py-2 transition-all"
              style={{ background: BLUE, boxShadow: `0 0 16px ${BLUE}50` }}>
              Save
            </button>
          </div>
        )}

        {debt.length === 0 ? (
          <div className="rounded-2xl px-4 py-8 text-center text-sm text-white/20"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            No debts tracked
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden divide-y divide-white/5"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {debt.map(d => {
              const pct  = Math.max(0, Math.min(100, d.total_amount > 0
                ? ((d.total_amount - d.remaining_amount) / d.total_amount) * 100 : 0));
              const mths = d.monthly_payment > 0 ? Math.ceil(d.remaining_amount / d.monthly_payment) : null;
              return (
                <div key={d.id} className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{d.name}</span>
                    <div className="text-right">
                      <span className="text-xs text-white/60 font-medium">{fmtFull(d.monthly_payment)}/mo</span>
                      {mths && <p className="text-[10px] text-white/25">{mths}mo left</p>}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-white/30">
                    <span>{fmtFull(d.remaining_amount)} remaining</span>
                    <span>{Math.round(pct)}% paid</span>
                  </div>
                  {/* Glowing bar */}
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${pct}%`,
                        background: BLUE,
                        boxShadow: `0 0 10px ${BLUE}`,
                      }} />
                  </div>
                  {d.notes && <p className="text-xs text-white/25">{d.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
