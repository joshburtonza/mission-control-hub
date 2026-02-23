import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Clock, CheckCircle2, AlertCircle, Home, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IncomeEntry {
  id: string;
  client: string;
  project: string;
  amount: number;
  currency: string;
  status: string;
  month: string;
}

interface DebtEntry {
  id: string;
  name: string;
  total_amount: number;
  remaining_amount: number;
  monthly_payment: number;
  notes: string | null;
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  paid:          { label: 'Paid',           color: 'text-success',     dot: 'bg-success' },
  invoice_sent:  { label: 'Invoice Sent',   color: 'text-warning',     dot: 'bg-warning' },
  pending:       { label: 'Pending',        color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

const clientColors: Record<string, string> = {
  'Ascend LC':         'bg-primary/20 text-primary',
  'Race Technik':      'bg-cyan-500/20 text-cyan-400',
  'Favorite Logistics':'bg-violet-500/20 text-violet-400',
};

function fmt(n: number) {
  return 'R' + n.toLocaleString('en-ZA', { minimumFractionDigits: 0 });
}

export default function Finances() {
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [debt, setDebt] = useState<DebtEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [newDebt, setNewDebt] = useState({ name: '', total_amount: '', remaining_amount: '', monthly_payment: '', notes: '' });

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('finances_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income_entries' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    const [incomeRes, debtRes] = await Promise.all([
      supabase.from('income_entries').select('*').order('month', { ascending: false }),
      supabase.from('debt_entries').select('*').order('created_at', { ascending: false }),
    ]);
    if (incomeRes.data) setEntries(incomeRes.data as IncomeEntry[]);
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

  const now = new Date();
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
  const collectionRate = total > 0 ? Math.round((collected / total) * 100) : 0;

  // Group by month for chart
  const months = [...new Set(entries.map(e => e.month))].sort().slice(-6);
  const monthTotals = months.map(m => ({
    month: m,
    paid: entries.filter(e => e.month === m && e.status === 'paid').reduce((s, e) => s + e.amount, 0),
    invoiced: entries.filter(e => e.month === m && e.status !== 'paid').reduce((s, e) => s + e.amount, 0),
  }));
  const maxBar = Math.max(...monthTotals.map(m => m.paid + m.invoiced), 1);

  if (loading) return <div className="text-sm text-muted-foreground animate-pulse">Loading finances...</div>;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Collected',       value: fmt(collected),   icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-success',     border: 'border-success/20' },
          { label: 'Outstanding',     value: fmt(outstanding), icon: <Clock className="h-4 w-4" />,        color: 'text-warning',     border: 'border-warning/20' },
          { label: 'Total Invoiced',  value: fmt(total),       icon: <TrendingUp className="h-4 w-4" />,   color: 'text-primary',     border: 'border-primary/20' },
          { label: 'Collection Rate', value: `${collectionRate}%`, icon: <AlertCircle className="h-4 w-4" />, color: collectionRate === 100 ? 'text-success' : 'text-warning', border: 'border-border/20' },
          { label: 'Est. Take-Home',  value: '~R56k',          icon: <Home className="h-4 w-4" />,         color: 'text-primary',     border: 'border-primary/20' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-2xl bg-card p-5 border', s.border)}>
            <div className={cn('mb-3', s.color)}>{s.icon}</div>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      {monthTotals.length > 0 && (
        <div className="rounded-2xl bg-card p-5">
          <p className="text-xs font-semibold text-card-foreground/60 uppercase tracking-wider mb-5">Revenue — Last {monthTotals.length} Months</p>
          <div className="flex items-end gap-3 h-32">
            {monthTotals.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: '96px' }}>
                  {m.paid > 0 && (
                    <div
                      className="w-full rounded-t-sm bg-primary"
                      style={{ height: `${(m.paid / maxBar) * 96}px`, minHeight: '4px' }}
                    />
                  )}
                  {m.invoiced > 0 && (
                    <div
                      className="w-full rounded-t-sm bg-warning/40"
                      style={{ height: `${(m.invoiced / maxBar) * 96}px`, minHeight: '4px' }}
                    />
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground">{m.month.slice(5)}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-primary" /><span className="text-[10px] text-muted-foreground">Collected</span></div>
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-warning/40" /><span className="text-[10px] text-muted-foreground">Invoiced</span></div>
          </div>
        </div>
      )}

      {/* This month breakdown */}
      <div className="rounded-2xl bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <p className="text-xs font-semibold text-card-foreground/60 uppercase tracking-wider">
            {thisMonth} — Current Month
          </p>
        </div>
        {thisMonthEntries.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No entries this month</div>
        ) : (
          <div className="divide-y divide-white/5">
            {thisMonthEntries.map(entry => {
              const sc = statusConfig[entry.status] || statusConfig.pending;
              const cc = clientColors[entry.client] || 'bg-muted text-muted-foreground';
              return (
                <div key={entry.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('h-2 w-2 rounded-full shrink-0', sc.dot)} />
                    <div className="min-w-0">
                      <p className="text-sm text-card-foreground truncate">{entry.project}</p>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium', cc)}>{entry.client}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-semibold text-card-foreground">{fmt(entry.amount)}</p>
                    <p className={cn('text-[10px]', sc.color)}>{sc.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All entries */}
      {lastMonthEntries.length > 0 && (
        <div className="rounded-2xl bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-xs font-semibold text-card-foreground/60 uppercase tracking-wider">
              {lastMonth} — Previous Month · {fmt(lastTotal)} total
            </p>
          </div>
          <div className="divide-y divide-white/5">
            {lastMonthEntries.map(entry => {
              const sc = statusConfig[entry.status] || statusConfig.pending;
              const cc = clientColors[entry.client] || 'bg-muted text-muted-foreground';
              return (
                <div key={entry.id} className="flex items-center justify-between px-5 py-3.5 opacity-70">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('h-2 w-2 rounded-full shrink-0', sc.dot)} />
                    <div className="min-w-0">
                      <p className="text-sm text-card-foreground truncate">{entry.project}</p>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium', cc)}>{entry.client}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-semibold text-card-foreground">{fmt(entry.amount)}</p>
                    <p className={cn('text-[10px]', sc.color)}>{sc.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Debt tracker */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Debt Tracker</p>
          <button onClick={() => setShowAddDebt(true)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>

        {showAddDebt && (
          <div className="rounded-2xl bg-card border border-destructive/30 p-4 mb-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">New Debt Entry</span>
              <button onClick={() => setShowAddDebt(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Name" value={newDebt.name} onChange={e => setNewDebt(p => ({ ...p, name: e.target.value }))}
                className="col-span-2 rounded-lg bg-muted border border-border text-foreground text-xs px-2 py-1.5" />
              <input placeholder="Total amount" type="number" value={newDebt.total_amount} onChange={e => setNewDebt(p => ({ ...p, total_amount: e.target.value }))}
                className="rounded-lg bg-muted border border-border text-foreground text-xs px-2 py-1.5" />
              <input placeholder="Remaining" type="number" value={newDebt.remaining_amount} onChange={e => setNewDebt(p => ({ ...p, remaining_amount: e.target.value }))}
                className="rounded-lg bg-muted border border-border text-foreground text-xs px-2 py-1.5" />
              <input placeholder="Monthly payment" type="number" value={newDebt.monthly_payment} onChange={e => setNewDebt(p => ({ ...p, monthly_payment: e.target.value }))}
                className="rounded-lg bg-muted border border-border text-foreground text-xs px-2 py-1.5" />
              <input placeholder="Notes (optional)" value={newDebt.notes} onChange={e => setNewDebt(p => ({ ...p, notes: e.target.value }))}
                className="rounded-lg bg-muted border border-border text-foreground text-xs px-2 py-1.5" />
            </div>
            <button onClick={handleAddDebt}
              className="w-full rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold py-2 hover:bg-destructive/90 transition-colors">
              Save Debt Entry
            </button>
          </div>
        )}

        {debt.length === 0 ? (
          <div className="rounded-2xl bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No debt entries — click Add to track liabilities
          </div>
        ) : (
          <div className="rounded-2xl bg-card divide-y divide-white/5">
            {debt.map(d => {
              const pct = Math.max(0, Math.min(100, d.total_amount > 0 ? ((d.total_amount - d.remaining_amount) / d.total_amount) * 100 : 0));
              return (
                <div key={d.id} className="px-5 py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-card-foreground">{d.name}</span>
                    <span className="text-xs text-muted-foreground">{fmt(d.monthly_payment)}/mo</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{fmt(d.remaining_amount)} remaining of {fmt(d.total_amount)}</span>
                    <span className="text-muted-foreground">{Math.round(pct)}% paid</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
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
