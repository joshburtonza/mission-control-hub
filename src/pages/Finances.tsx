import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp, DollarSign, Flame, Plus, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface IncomeEntry {
  id: string;
  client: string;
  project: string;
  amount: number;
  status: 'pending' | 'invoice_sent' | 'paid';
  month: string;
  notes?: string | null;
}

interface DebtEntry {
  id: string;
  name: string;
  total_amount: number;
  remaining_amount: number;
  monthly_payment: number;
  notes?: string | null;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const SURPLUS = 13000;
const CURRENT_MONTH = '2026-02';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:      { label: 'Pending',      color: 'bg-gray-800/50 text-gray-400 border-gray-700/50' },
  invoice_sent: { label: 'Invoice Sent', color: 'bg-warning/10 text-warning border-warning/30' },
  paid:         { label: 'Paid ✓',       color: 'bg-success/10 text-success border-success/30' },
};

const CLIENT_COLORS: Record<string, string> = {
  'Ascend LC':          'text-cyan-400',
  'Favorite Logistics': 'text-purple-400',
  'Race Technik':       'text-orange-400',
};

const CONTRACT_TERMS = [
  { client: 'Ascend LC',          color: 'text-cyan-400',   terms: 'R30k pm · 5-7 months · QMS Guard' },
  { client: 'Race Technik',        color: 'text-orange-400', terms: 'R21.5k pm · Ongoing dev · Detailing Platform' },
  { client: 'Favorite Logistics',  color: 'text-purple-400', terms: 'R20k pm · Until June 2026 · FLAIR ERP' },
];

const fmt = (n: number) => `R ${Number(n).toLocaleString('en-ZA')}`;

// ─── CHART TOOLTIP ────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/60 rounded-md px-3 py-2 font-mono text-xs shadow-xl">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === 'mrr' ? 'Actual' : 'Projected'}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function Finances() {
  const [income, setIncome]   = useState<IncomeEntry[]>([]);
  const [debts,  setDebts]    = useState<DebtEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showDebtForm,   setShowDebtForm]   = useState(false);
  const [expandedDebt,   setExpandedDebt]   = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [incomeForm, setIncomeForm] = useState({
    client: 'Ascend LC', project: '', amount: '', status: 'pending' as IncomeEntry['status'], month: CURRENT_MONTH,
  });
  const [debtForm, setDebtForm] = useState({
    name: '', total_amount: '', remaining_amount: '', monthly_payment: '', notes: '',
  });

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchAll = async () => {
    const [incRes, debtRes] = await Promise.all([
      (supabase as any).from('income_entries').select('*').order('month', { ascending: true }).order('client'),
      (supabase as any).from('debt_entries').select('*').order('created_at'),
    ]);
    if (incRes.data)  setIncome(incRes.data as IncomeEntry[]);
    if (debtRes.data) setDebts(debtRes.data as DebtEntry[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const ch = (supabase as any)
      .channel('finances_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income_entries' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debt_entries' },   fetchAll)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, []);

  // ── Computed ─────────────────────────────────────────────────────────────────

  const thisMonth   = income.filter(e => e.month === CURRENT_MONTH);
  const mrr         = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
  const collected   = thisMonth.filter(e => e.status === 'paid').reduce((s, e) => s + Number(e.amount), 0);

  const totalDebt      = debts.reduce((s, d) => s + Number(d.total_amount), 0);
  const totalRemaining = debts.reduce((s, d) => s + Number(d.remaining_amount), 0);
  const totalPaid      = totalDebt - totalRemaining;
  const debtPct        = totalDebt > 0 ? Math.round((totalPaid / totalDebt) * 100) : 0;
  const monthlyDebt    = debts.reduce((s, d) => s + Number(d.monthly_payment), 0);
  const monthsLeft     = totalRemaining > 0 && monthlyDebt > 0 ? Math.ceil(totalRemaining / monthlyDebt) : 0;

  // Build growth chart from real income data grouped by month
  const monthlyTotals: Record<string, number> = {};
  income.forEach(e => {
    monthlyTotals[e.month] = (monthlyTotals[e.month] || 0) + Number(e.amount);
  });
  const growthData = [
    ...Object.entries(monthlyTotals).sort().map(([m, v]) => ({
      month: new Date(m + '-01').toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' }),
      mrr: v, projected: null,
    })),
    { month: 'Mar 26', mrr: null, projected: mrr > 0 ? Math.round(mrr * 1.2) : null },
    { month: 'Apr 26', mrr: null, projected: mrr > 0 ? Math.round(mrr * 1.44) : null },
    { month: 'May 26', mrr: null, projected: mrr > 0 ? Math.round(mrr * 1.728) : null },
  ];

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const addIncome = async () => {
    const amt = parseFloat(incomeForm.amount);
    if (!incomeForm.project || !amt) { toast.error('Fill all fields'); return; }
    setSaving(true);
    const { error } = await (supabase as any).from('income_entries').insert({
      client: incomeForm.client, project: incomeForm.project,
      amount: amt, status: incomeForm.status, month: incomeForm.month,
    });
    if (error) { toast.error('Failed to add entry'); }
    else {
      toast.success('Income entry added');
      setIncomeForm({ client: 'Ascend LC', project: '', amount: '', status: 'pending', month: CURRENT_MONTH });
      setShowIncomeForm(false);
    }
    setSaving(false);
  };

  const addDebt = async () => {
    const t = parseFloat(debtForm.total_amount), r = parseFloat(debtForm.remaining_amount), m = parseFloat(debtForm.monthly_payment);
    if (!debtForm.name || !t || !r || !m) { toast.error('Fill all fields'); return; }
    setSaving(true);
    const { error } = await (supabase as any).from('debt_entries').insert({
      name: debtForm.name, total_amount: t, remaining_amount: r, monthly_payment: m, notes: debtForm.notes || null,
    });
    if (error) { toast.error('Failed to add debt'); }
    else {
      toast.success('Debt added');
      setDebtForm({ name: '', total_amount: '', remaining_amount: '', monthly_payment: '', notes: '' });
      setShowDebtForm(false);
    }
    setSaving(false);
  };

  const cycleStatus = async (entry: IncomeEntry) => {
    const order: IncomeEntry['status'][] = ['pending', 'invoice_sent', 'paid'];
    const next = order[(order.indexOf(entry.status) + 1) % order.length];
    const { error } = await (supabase as any).from('income_entries').update({ status: next }).eq('id', entry.id);
    if (error) toast.error('Failed to update');
    else toast.success('Status updated');
  };

  const deleteDebt = async (id: string) => {
    const { error } = await (supabase as any).from('debt_entries').delete().eq('id', id);
    if (error) toast.error('Failed to delete');
    else toast.success('Debt removed');
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="font-mono text-xs text-muted-foreground animate-pulse">Loading finances...</p>
      </div>
    );
  }

  const noData = income.length === 0 && debts.length === 0;

  return (
    <div className="space-y-6 pb-24 sm:pb-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan">Finances</h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">Income · Growth · Debt Killer · Live from Supabase</p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchAll}
          className="h-7 w-7 p-0 border-border/40 text-muted-foreground hover:text-primary">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Missing tables warning */}
      {noData && (
        <div className="border border-warning/40 bg-warning/5 rounded-md p-4">
          <p className="font-mono text-xs text-warning font-semibold mb-1">⚠ No data yet</p>
          <p className="font-mono text-[10px] text-muted-foreground">
            Run the finances SQL migration in Supabase to seed income data, then add your debt entries below.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'MRR',           value: fmt(mrr),           color: 'text-primary',     border: 'border-primary/30' },
          { label: 'Collected',     value: fmt(collected),     color: 'text-success',     border: 'border-success/30' },
          { label: 'Ad Hoc Buffer', value: fmt(SURPLUS),       color: 'text-cyan-400',    border: 'border-cyan-700/30' },
          { label: 'Total Debt',    value: fmt(totalRemaining), color: 'text-destructive', border: 'border-destructive/30' },
        ].map(k => (
          <div key={k.label} className={`bg-card border ${k.border} rounded-md p-3`}>
            <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
            <p className={`font-display text-lg font-bold ${k.color} mt-0.5`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Growth Chart */}
      {growthData.length > 1 && (
        <div className="bg-card border border-border/40 rounded-md p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="font-mono text-xs font-semibold text-foreground">Revenue Growth</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="h-2 w-4 bg-primary/60 rounded-sm" />
                <span className="font-mono text-[9px] text-muted-foreground">Actual</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-px w-4 border-t border-dashed border-muted-foreground" />
                <span className="font-mono text-[9px] text-muted-foreground">Projected (+20%)</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={growthData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `R${(v/1000).toFixed(0)}k`} tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="mrr"       stroke="#06b6d4" strokeWidth={2} fill="url(#mrrGrad)" connectNulls={false} dot={{ fill: '#06b6d4', r: 3 }} />
              <Area type="monotone" dataKey="projected" stroke="#6b7280" strokeWidth={1} strokeDasharray="4 4" fill="none" dot={false} connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Income Tracker */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <p className="font-mono text-xs font-semibold text-foreground">Income — {CURRENT_MONTH}</p>
          </div>
          <Button onClick={() => setShowIncomeForm(!showIncomeForm)}
            className="h-7 px-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-mono text-[10px]">
            <Plus className="h-3 w-3 mr-1" /> Add Entry
          </Button>
        </div>

        {/* Contract terms */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {CONTRACT_TERMS.map(c => (
            <div key={c.client} className="bg-secondary/20 border border-border/20 rounded px-2.5 py-1.5">
              <p className={`font-mono text-[9px] font-semibold ${c.color}`}>{c.client}</p>
              <p className="font-mono text-[9px] text-muted-foreground">{c.terms}</p>
            </div>
          ))}
        </div>

        {showIncomeForm && (
          <Card className="border-primary/30 bg-card">
            <CardContent className="p-3 space-y-2">
              <div className="flex justify-between items-center">
                <p className="font-mono text-[10px] text-primary uppercase tracking-wider">New Income Entry</p>
                <button onClick={() => setShowIncomeForm(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={incomeForm.client} onChange={e => setIncomeForm(f => ({ ...f, client: e.target.value }))}
                  className="bg-secondary/30 border border-border/50 rounded px-2 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary/50">
                  {['Ascend LC', 'Favorite Logistics', 'Race Technik'].map(c => <option key={c}>{c}</option>)}
                </select>
                <Input placeholder="Project" value={incomeForm.project} onChange={e => setIncomeForm(f => ({ ...f, project: e.target.value }))}
                  className="bg-secondary/30 border-border/50 font-mono text-xs h-8" />
                <Input placeholder="Amount (ZAR)" type="number" value={incomeForm.amount} onChange={e => setIncomeForm(f => ({ ...f, amount: e.target.value }))}
                  className="bg-secondary/30 border-border/50 font-mono text-xs h-8" />
                <select value={incomeForm.status} onChange={e => setIncomeForm(f => ({ ...f, status: e.target.value as any }))}
                  className="bg-secondary/30 border border-border/50 rounded px-2 py-1.5 font-mono text-xs text-foreground focus:outline-none focus:border-primary/50">
                  <option value="pending">Pending</option>
                  <option value="invoice_sent">Invoice Sent</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <Button onClick={addIncome} disabled={saving}
                className="w-full h-8 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-mono text-[10px]">
                {saving ? 'Saving...' : 'Add Entry'}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {thisMonth.length === 0 ? (
            <div className="border border-border/20 rounded-md p-6 text-center">
              <p className="font-mono text-xs text-muted-foreground">No income entries for {CURRENT_MONTH} yet</p>
              <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">Run the finances SQL migration in Supabase</p>
            </div>
          ) : (
            thisMonth.map(entry => {
              const sc = STATUS_CONFIG[entry.status];
              const cc = CLIENT_COLORS[entry.client] ?? 'text-foreground';
              return (
                <div key={entry.id} className="flex items-center gap-3 bg-card border border-border/30 rounded-md px-3 py-2.5 hover:border-primary/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className={`font-mono text-sm font-semibold ${cc}`}>{entry.client}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{entry.project}</p>
                  </div>
                  <p className="font-mono text-sm text-foreground font-semibold">{fmt(Number(entry.amount))}</p>
                  <button onClick={() => cycleStatus(entry)}>
                    <Badge className={cn('font-mono text-[8px] border cursor-pointer hover:opacity-80', sc.color)}>
                      {sc.label}
                    </Badge>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Debt Killer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <p className="font-mono text-xs font-semibold text-foreground">Debt Killer</p>
            {monthsLeft > 0 && (
              <Badge className="font-mono text-[8px] bg-orange-900/30 text-orange-300 border-orange-700/30">
                {monthsLeft} months to freedom
              </Badge>
            )}
          </div>
          <Button onClick={() => setShowDebtForm(!showDebtForm)}
            className="h-7 px-3 bg-orange-900/20 hover:bg-orange-900/30 text-orange-300 border border-orange-700/30 font-mono text-[10px]">
            <Plus className="h-3 w-3 mr-1" /> Add Debt
          </Button>
        </div>

        {debts.length > 0 && (
          <div className="bg-card border border-border/40 rounded-md p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Total Progress</p>
              <p className="font-mono text-xs text-orange-300">{debtPct}% eliminated</p>
            </div>
            <div className="w-full bg-secondary/40 rounded-full h-3 mb-2 overflow-hidden">
              <div className="h-3 rounded-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-500"
                style={{ width: `${debtPct}%` }} />
            </div>
            <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
              <span>Paid: {fmt(totalPaid)}</span>
              <span>Remaining: {fmt(totalRemaining)}</span>
              <span>Monthly: {fmt(monthlyDebt)}</span>
            </div>
          </div>
        )}

        {debts.length === 0 && (
          <div className="border border-border/20 rounded-md p-6 text-center">
            <p className="font-mono text-xs text-muted-foreground">No debts added yet</p>
            <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">Add your real debt figures using the button above</p>
          </div>
        )}

        {showDebtForm && (
          <Card className="border-orange-700/30 bg-card">
            <CardContent className="p-3 space-y-2">
              <div className="flex justify-between items-center">
                <p className="font-mono text-[10px] text-orange-300 uppercase tracking-wider">Add Debt</p>
                <button onClick={() => setShowDebtForm(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Debt name" value={debtForm.name} onChange={e => setDebtForm(f => ({ ...f, name: e.target.value }))} className="bg-secondary/30 border-border/50 font-mono text-xs h-8" />
                <Input placeholder="Total amount" type="number" value={debtForm.total_amount} onChange={e => setDebtForm(f => ({ ...f, total_amount: e.target.value }))} className="bg-secondary/30 border-border/50 font-mono text-xs h-8" />
                <Input placeholder="Remaining" type="number" value={debtForm.remaining_amount} onChange={e => setDebtForm(f => ({ ...f, remaining_amount: e.target.value }))} className="bg-secondary/30 border-border/50 font-mono text-xs h-8" />
                <Input placeholder="Monthly payment" type="number" value={debtForm.monthly_payment} onChange={e => setDebtForm(f => ({ ...f, monthly_payment: e.target.value }))} className="bg-secondary/30 border-border/50 font-mono text-xs h-8" />
              </div>
              <Input placeholder="Notes (optional)" value={debtForm.notes} onChange={e => setDebtForm(f => ({ ...f, notes: e.target.value }))} className="bg-secondary/30 border-border/50 font-mono text-xs h-8" />
              <Button onClick={addDebt} disabled={saving}
                className="w-full h-8 bg-orange-900/20 hover:bg-orange-900/30 text-orange-300 border border-orange-700/30 font-mono text-[10px]">
                {saving ? 'Saving...' : 'Add Debt'}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {debts.map(debt => {
            const pct = debt.total_amount > 0
              ? Math.round(((Number(debt.total_amount) - Number(debt.remaining_amount)) / Number(debt.total_amount)) * 100)
              : 0;
            const isExpanded = expandedDebt === debt.id;
            const mLeft = debt.monthly_payment > 0 ? Math.ceil(Number(debt.remaining_amount) / Number(debt.monthly_payment)) : 0;
            return (
              <div key={debt.id} className="bg-card border border-border/30 rounded-md overflow-hidden">
                <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/20 transition-colors text-left"
                  onClick={() => setExpandedDebt(isExpanded ? null : debt.id)}>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-foreground">{debt.name}</p>
                    <div className="w-full bg-secondary/40 rounded-full h-1.5 mt-1.5">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-orange-700 to-orange-500"
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs text-orange-300">{fmt(Number(debt.remaining_amount))}</p>
                    <p className="font-mono text-[9px] text-muted-foreground">{pct}% done</p>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </button>
                {isExpanded && (
                  <div className="border-t border-border/20 px-3 py-2 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Original', value: fmt(Number(debt.total_amount)) },
                        { label: 'Monthly',  value: fmt(Number(debt.monthly_payment)) },
                        { label: 'ETA',      value: mLeft > 0 ? `${mLeft} months` : 'Paid off!' },
                      ].map(s => (
                        <div key={s.label}>
                          <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                          <p className="font-mono text-xs text-foreground">{s.value}</p>
                        </div>
                      ))}
                    </div>
                    {debt.notes && <p className="font-mono text-[10px] text-muted-foreground">{debt.notes}</p>}
                    <Button size="sm" onClick={() => deleteDebt(debt.id)}
                      className="h-6 text-[9px] font-mono bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30">
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
