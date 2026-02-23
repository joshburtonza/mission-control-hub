import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from 'recharts';
import { TrendingUp, TrendingDown, Clock, CheckCircle2, AlertCircle, Home, Plus, X, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IncomeEntry {
  id: string; client: string; project: string;
  amount: number; currency: string; status: string; month: string;
}
interface DebtEntry {
  id: string; name: string; total_amount: number;
  remaining_amount: number; monthly_payment: number; notes: string | null;
}

const BLUE   = 'hsl(213,94%,57%)';
const CYAN   = 'hsl(199,89%,48%)';
const GREEN  = 'hsl(160,84%,39%)';
const AMBER  = 'hsl(38,92%,50%)';
const RED    = 'hsl(0,72%,51%)';

const clientColors: Record<string, string> = {
  'Ascend LC':          'bg-primary/15 text-primary border border-primary/20',
  'Race Technik':       'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20',
  'Favorite Logistics': 'bg-violet-500/15 text-violet-400 border border-violet-500/20',
};

function fmt(n: number) {
  return 'R' + n.toLocaleString('en-ZA', { minimumFractionDigits: 0 });
}

// Custom tooltip for charts
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 backdrop-blur-sm px-3.5 py-2.5 shadow-xl">
      <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <div className="h-1.5 w-3 rounded-full" style={{ background: p.fill || p.stroke }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-semibold text-foreground">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Radial progress ring
function RadialProgress({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg width="130" height="130" className="-rotate-90">
          {/* Track */}
          <circle cx="65" cy="65" r={r} fill="none" strokeWidth="8"
            className="stroke-muted" />
          {/* Progress */}
          <circle cx="65" cy="65" r={r} fill="none" strokeWidth="8"
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{
              filter: `drop-shadow(0 0 6px ${color})`,
              transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}%</p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function Finances() {
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [debt, setDebt]       = useState<DebtEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [newDebt, setNewDebt] = useState({ name: '', total_amount: '', remaining_amount: '', monthly_payment: '', notes: '' });

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('finances_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income_entries' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchData = async () => {
    const [incRes, debtRes] = await Promise.all([
      supabase.from('income_entries').select('*').order('month', { ascending: false }),
      supabase.from('debt_entries').select('*').order('created_at', { ascending: false }),
    ]);
    if (incRes.data)  setEntries(incRes.data as IncomeEntry[]);
    if (debtRes.data) setDebt(debtRes.data as DebtEntry[]);
    setLoading(false);
  };

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

  // Computed values
  const now       = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();

  const thisMonthEntries = entries.filter(e => e.month === thisMonth);
  const lastMonthEntries = entries.filter(e => e.month === lastMonth);

  const collected   = thisMonthEntries.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0);
  const outstanding = thisMonthEntries.filter(e => e.status !== 'paid').reduce((s, e) => s + e.amount, 0);
  const total       = collected + outstanding;
  const lastTotal   = lastMonthEntries.reduce((s, e) => s + e.amount, 0);
  const collRate    = total > 0 ? Math.round((collected / total) * 100) : 0;
  const momChange   = lastTotal > 0 ? Math.round(((total - lastTotal) / lastTotal) * 100) : 0;
  const totalDebt   = debt.reduce((s, d) => s + d.remaining_amount, 0);

  // Area chart — last 8 months
  const months = [...new Set(entries.map(e => e.month))].sort().slice(-8);
  const areaData = months.map(m => ({
    month: m.slice(5),
    paid: entries.filter(e => e.month === m && e.status === 'paid').reduce((s, e) => s + e.amount, 0),
    invoiced: entries.filter(e => e.month === m && e.status !== 'paid').reduce((s, e) => s + e.amount, 0),
  }));

  // Donut breakdown for collection
  const donutData = [
    { name: 'Collected',   value: collected,   fill: GREEN },
    { name: 'Outstanding', value: outstanding, fill: AMBER },
  ].filter(d => d.value > 0);

  // Client revenue breakdown (this month)
  const clientData = Object.entries(
    thisMonthEntries.reduce<Record<string, number>>((acc, e) => {
      acc[e.client] = (acc[e.client] || 0) + e.amount;
      return acc;
    }, {})
  ).map(([client, amount]) => ({ client: client.split(' ')[0], amount }));

  const statCards = [
    {
      label: 'Collected',
      value: fmt(collected),
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: GREEN,
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Outstanding',
      value: fmt(outstanding),
      icon: <Clock className="h-4 w-4" />,
      color: AMBER,
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'Total Invoiced',
      value: fmt(total),
      icon: <TrendingUp className="h-4 w-4" />,
      color: BLUE,
      bg: 'bg-primary/10',
      border: 'border-primary/20',
      sub: momChange !== 0 ? (
        <span className={cn('text-[10px] flex items-center gap-0.5', momChange > 0 ? 'text-success' : 'text-destructive')}>
          {momChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(momChange)}% vs last month
        </span>
      ) : null,
    },
    {
      label: 'Collection Rate',
      value: `${collRate}%`,
      icon: <AlertCircle className="h-4 w-4" />,
      color: collRate >= 80 ? GREEN : collRate >= 50 ? AMBER : RED,
      bg: collRate >= 80 ? 'bg-emerald-500/10' : 'bg-amber-500/10',
      border: collRate >= 80 ? 'border-emerald-500/20' : 'border-amber-500/20',
    },
    {
      label: 'Total Debt',
      value: fmt(totalDebt),
      icon: <Home className="h-4 w-4" />,
      color: RED,
      bg: 'bg-destructive/10',
      border: 'border-destructive/20',
    },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-xs text-muted-foreground">Loading finances…</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 chart-enter">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map(s => (
          <div key={s.label}
            className={cn('relative overflow-hidden rounded-2xl bg-card border p-5 hover-glow transition-all', s.border)}
            style={{ boxShadow: `0 4px 24px ${s.color}18` }}
          >
            {/* Radial glow behind icon */}
            <div className={cn('absolute top-0 right-0 h-16 w-16 rounded-full blur-2xl opacity-30', s.bg)} />
            <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center mb-3', s.bg)} style={{ color: s.color }}>
              {s.icon}
            </div>
            <p className="text-xl font-bold text-foreground tabular-nums">{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
            {s.sub && <div className="mt-1">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Area chart + Radial ring ── */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Area chart — spans 2 cols */}
        <div className="md:col-span-2 rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-semibold text-foreground">Revenue Overview</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Last {areaData.length} months · collected vs outstanding</p>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ background: BLUE }} /><span className="text-[10px] text-muted-foreground">Collected</span></div>
              <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ background: AMBER }} /><span className="text-[10px] text-muted-foreground">Outstanding</span></div>
            </div>
          </div>
          {areaData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={areaData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={BLUE}  stopOpacity={0.3} />
                    <stop offset="95%" stopColor={BLUE}  stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={AMBER} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={AMBER} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20% / 0.4)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(0 0% 42%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(0 0% 42%)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : String(v)} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(213 94% 57% / 0.2)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="paid" name="collected" stroke={BLUE}
                  strokeWidth={2} fill="url(#gradBlue)"
                  dot={false} activeDot={{ r: 4, fill: BLUE, strokeWidth: 0 }}
                  animationDuration={1200} animationEasing="ease-out"
                  style={{ filter: `drop-shadow(0 0 6px ${BLUE}60)` }}
                />
                <Area type="monotone" dataKey="invoiced" name="outstanding" stroke={AMBER}
                  strokeWidth={1.5} fill="url(#gradAmber)"
                  dot={false} activeDot={{ r: 3, fill: AMBER, strokeWidth: 0 }}
                  animationDuration={1400} animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Collection rate radial */}
        <div className="rounded-2xl bg-card border border-border p-5 flex flex-col items-center justify-center gap-4">
          <p className="text-sm font-semibold text-foreground self-start">Collection Rate</p>
          <RadialProgress
            value={collRate}
            label="this month"
            color={collRate >= 80 ? GREEN : collRate >= 50 ? AMBER : RED}
          />
          {donutData.length > 0 && (
            <div className="w-full space-y-2">
              {donutData.map(d => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="font-semibold text-foreground">{fmt(d.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bar chart + Client donut ── */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Monthly bar chart */}
        <div className="md:col-span-2 rounded-2xl bg-card border border-border p-5">
          <p className="text-sm font-semibold text-foreground mb-1">Monthly Breakdown</p>
          <p className="text-[11px] text-muted-foreground mb-5">Paid vs outstanding per month</p>
          {areaData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={areaData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barGap={3}>
                <defs>
                  <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={BLUE}  stopOpacity={0.9} />
                    <stop offset="100%" stopColor={CYAN}  stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="barAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={AMBER} stopOpacity={0.7} />
                    <stop offset="100%" stopColor={AMBER} stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20% / 0.4)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(0 0% 42%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(0 0% 42%)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : String(v)} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(213 94% 57% / 0.05)' }} />
                <Bar dataKey="paid"     name="collected"   fill="url(#barBlue)"  radius={[4, 4, 0, 0]}
                  animationDuration={1000} animationEasing="ease-out"
                  style={{ filter: `drop-shadow(0 -2px 6px ${BLUE}50)` }} />
                <Bar dataKey="invoiced" name="outstanding" fill="url(#barAmber)" radius={[4, 4, 0, 0]}
                  animationDuration={1200} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Client revenue split donut */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm font-semibold text-foreground mb-1">Client Split</p>
          <p className="text-[11px] text-muted-foreground mb-4">This month by client</p>
          {clientData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <defs>
                    {[BLUE, CYAN, 'hsl(271,81%,56%)'].map((c, i) => (
                      <filter key={i} id={`glow${i}`}>
                        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={c} floodOpacity="0.6" />
                      </filter>
                    ))}
                  </defs>
                  <Pie data={clientData} dataKey="amount" nameKey="client"
                    cx="50%" cy="50%" innerRadius={38} outerRadius={62}
                    strokeWidth={0} paddingAngle={3}
                    animationDuration={1200} animationEasing="ease-out"
                  >
                    {clientData.map((_, i) => (
                      <Cell key={i} fill={[BLUE, CYAN, 'hsl(271,81%,56%)'][i % 3]}
                        style={{ filter: `drop-shadow(0 0 5px ${[BLUE, CYAN, 'hsl(271,81%,56%)'][i % 3]}70)` }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {clientData.map((d, i) => (
                  <div key={d.client} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ background: [BLUE, CYAN, 'hsl(271,81%,56%)'][i % 3] }} />
                      <span className="text-muted-foreground">{d.client}</span>
                    </div>
                    <span className="font-semibold text-foreground">{fmt(d.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── This month breakdown ── */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{thisMonth} · Current Month</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{thisMonthEntries.length} entries · {fmt(total)} total</p>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            {fmt(collected)} collected
          </div>
        </div>
        {thisMonthEntries.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No entries this month</div>
        ) : (
          <div className="divide-y divide-border/50">
            {thisMonthEntries.map(entry => {
              const isPaid = entry.status === 'paid';
              const cc = clientColors[entry.client] || 'bg-muted text-muted-foreground border border-border';
              return (
                <div key={entry.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('h-2 w-2 rounded-full shrink-0', isPaid ? 'bg-success' : 'bg-warning')}
                      style={isPaid ? { boxShadow: `0 0 6px ${GREEN}` } : { boxShadow: `0 0 6px ${AMBER}` }} />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{entry.project}</p>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium', cc)}>{entry.client}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-semibold text-foreground">{fmt(entry.amount)}</p>
                    <p className={cn('text-[10px]', isPaid ? 'text-success' : 'text-warning')}>
                      {isPaid ? 'Paid' : entry.status === 'invoice_sent' ? 'Invoice Sent' : 'Pending'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Previous month ── */}
      {lastMonthEntries.length > 0 && (
        <div className="rounded-2xl bg-card border border-border overflow-hidden opacity-70">
          <div className="px-5 py-4 border-b border-border">
            <p className="text-sm font-semibold text-muted-foreground">{lastMonth} · Previous Month · {fmt(lastTotal)}</p>
          </div>
          <div className="divide-y divide-border/50">
            {lastMonthEntries.map(entry => {
              const isPaid = entry.status === 'paid';
              const cc = clientColors[entry.client] || 'bg-muted text-muted-foreground border border-border';
              return (
                <div key={entry.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', isPaid ? 'bg-success' : 'bg-warning')} />
                    <div className="min-w-0">
                      <p className="text-sm text-card-foreground truncate">{entry.project}</p>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium', cc)}>{entry.client}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-medium text-card-foreground">{fmt(entry.amount)}</p>
                    <p className={cn('text-[10px]', isPaid ? 'text-success' : 'text-warning')}>
                      {isPaid ? 'Paid' : 'Unpaid'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Debt tracker ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Debt Tracker</p>
          <button onClick={() => setShowAddDebt(true)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>

        {showAddDebt && (
          <div className="rounded-2xl bg-card border border-destructive/30 p-4 mb-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">New Debt Entry</span>
              <button onClick={() => setShowAddDebt(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Name" value={newDebt.name} onChange={e => setNewDebt(p => ({ ...p, name: e.target.value }))}
                className="col-span-2 rounded-lg bg-muted border border-border text-foreground text-xs px-2 py-1.5 focus:outline-none focus:border-primary/50" />
              <input placeholder="Total amount" type="number" value={newDebt.total_amount} onChange={e => setNewDebt(p => ({ ...p, total_amount: e.target.value }))}
                className="rounded-lg bg-muted border border-border text-foreground text-xs px-2 py-1.5 focus:outline-none focus:border-primary/50" />
              <input placeholder="Remaining" type="number" value={newDebt.remaining_amount} onChange={e => setNewDebt(p => ({ ...p, remaining_amount: e.target.value }))}
                className="rounded-lg bg-muted border border-border text-foreground text-xs px-2 py-1.5 focus:outline-none focus:border-primary/50" />
              <input placeholder="Monthly payment" type="number" value={newDebt.monthly_payment} onChange={e => setNewDebt(p => ({ ...p, monthly_payment: e.target.value }))}
                className="rounded-lg bg-muted border border-border text-foreground text-xs px-2 py-1.5 focus:outline-none focus:border-primary/50" />
              <input placeholder="Notes (optional)" value={newDebt.notes} onChange={e => setNewDebt(p => ({ ...p, notes: e.target.value }))}
                className="rounded-lg bg-muted border border-border text-foreground text-xs px-2 py-1.5 focus:outline-none focus:border-primary/50" />
            </div>
            <button onClick={handleAddDebt}
              className="w-full rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold py-2 hover:bg-destructive/90 transition-colors">
              Save Debt Entry
            </button>
          </div>
        )}

        {debt.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No debt entries — click Add to track liabilities
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border/50">
            {debt.map(d => {
              const pct  = Math.max(0, Math.min(100, d.total_amount > 0 ? ((d.total_amount - d.remaining_amount) / d.total_amount) * 100 : 0));
              const mths = d.monthly_payment > 0 ? Math.ceil(d.remaining_amount / d.monthly_payment) : null;
              return (
                <div key={d.id} className="px-5 py-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{d.name}</span>
                    <div className="text-right">
                      <span className="text-xs font-medium text-foreground">{fmt(d.monthly_payment)}/mo</span>
                      {mths && <p className="text-[10px] text-muted-foreground">{mths} months left</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{fmt(d.remaining_amount)} remaining</span>
                    <span className="text-muted-foreground font-medium">{Math.round(pct)}% paid</span>
                  </div>
                  {/* Glowing progress bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${BLUE}, ${CYAN})`,
                        boxShadow: `0 0 8px ${BLUE}70`,
                      }}
                    />
                  </div>
                  {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
