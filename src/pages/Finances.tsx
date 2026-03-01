import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import TetrisLoading from '@/components/ui/tetris-loader';
import { MiniChart } from '@/components/ui/mini-chart';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, HatchedPattern,
  type ChartConfig,
} from '@/components/ui/area-chart';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
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
interface FinanceTransaction {
  id: string; type: 'income' | 'expense'; amount: number;
  category: string | null; description: string | null;
  date: string; notes: string | null; created_at: string;
}

const INCOME_CATS  = ['Ascend LC', 'Race Technik', 'Favlog', 'Vanta Studios', 'Other'];
const EXPENSE_CATS = ['Debt Payment', 'Business Sub', 'Personal Sub', 'Drawings', 'Business Expense', 'Personal Expense', 'Other'];

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
/* ── Avalanche payoff simulator ── */
interface DebtSnapshot { balance: number; minPayment: number; }
interface AvalancheResult { months: number; totalInterest: number; debtFreeDate: string; }

function calcAvalanche(debts: DebtSnapshot[], extraMonthly: number): AvalancheResult {
  const r = 0.22 / 12; // 22% p.a.
  // sort by balance ascending (snowball: smallest balance first)
  const pool = debts
    .filter(d => d.balance > 0)
    .sort((a, b) => a.balance - b.balance)
    .map(d => ({ balance: d.balance, min: d.minPayment }));

  let extra = extraMonthly;
  let month = 0;
  let totalInterest = 0;

  while (pool.some(d => d.balance > 0) && month < 360) {
    month++;
    // apply interest to all
    for (const d of pool) {
      if (d.balance <= 0) continue;
      const interest = d.balance * r;
      totalInterest += interest;
      d.balance += interest;
    }
    // apply minimums to all
    let freedExtra = 0;
    for (const d of pool) {
      if (d.balance <= 0) continue;
      const payment = Math.min(d.min, d.balance);
      d.balance -= payment;
      if (d.balance <= 0) { d.balance = 0; freedExtra += d.min; }
    }
    extra += freedExtra;
    // apply extra to target (highest balance first, already sorted)
    let remaining = extra;
    for (const d of pool) {
      if (d.balance <= 0 || remaining <= 0) continue;
      const payment = Math.min(remaining, d.balance);
      d.balance -= payment;
      remaining -= payment;
      if (d.balance <= 0) d.balance = 0;
    }
  }

  const now = new Date();
  now.setMonth(now.getMonth() + month);
  const debtFreeDate = now.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
  return { months: month, totalInterest: Math.round(totalInterest), debtFreeDate };
}

/* ── Avalanche detailed payoff simulator (per-debt, per-month) ── */
interface DebtNamedSnapshot { name: string; balance: number; minPayment: number; }
interface MonthlyDebtRow { month: string; [debtName: string]: number | string; }
interface AvalancheDetailed {
  chartData: MonthlyDebtRow[];
  payoffMonths: Record<string, number>;
}

function calcAvalancheDetailed(debts: DebtNamedSnapshot[], extraMonthly: number): AvalancheDetailed {
  const r = 0.22 / 12;
  const pool = debts
    .filter(d => d.balance > 0)
    .sort((a, b) => a.balance - b.balance)
    .map(d => ({ name: d.name, balance: d.balance, min: d.minPayment }));

  let extra = extraMonthly;
  const payoffMonths: Record<string, number> = {};
  const allRows: MonthlyDebtRow[] = [];

  // Baseline: Mar 2026 = month index 0
  const baseYear = 2026;
  const baseMonth = 2; // March (0-indexed)

  const monthLabel = (idx: number): string => {
    const d = new Date(baseYear, baseMonth + idx, 1);
    const mon = d.toLocaleString('en-US', { month: 'short' });
    const yr  = String(d.getFullYear()).slice(2);
    return `${mon} '${yr}`;
  };

  for (let month = 0; month < 360; month++) {
    if (!pool.some(d => d.balance > 0)) break;

    // Record balances at start of month
    const row: MonthlyDebtRow = { month: monthLabel(month) };
    for (const d of pool) {
      row[d.name] = Math.max(0, Math.round(d.balance));
    }
    allRows.push(row);

    // Apply interest
    for (const d of pool) {
      if (d.balance <= 0) continue;
      d.balance += d.balance * r;
    }

    // Pay minimums; track freed minimums
    let freedExtra = 0;
    for (const d of pool) {
      if (d.balance <= 0) continue;
      const payment = Math.min(d.min, d.balance);
      d.balance -= payment;
      if (d.balance <= 0) {
        d.balance = 0;
        freedExtra += d.min;
        if (!(d.name in payoffMonths)) payoffMonths[d.name] = month + 1;
      }
    }
    extra += freedExtra;

    // Apply extra to single lowest-balance debt (snowball: re-sort active debts each month
    // to always attack the current smallest balance)
    const active = pool.filter(d => d.balance > 0).sort((a, b) => a.balance - b.balance);
    let remaining = extra;
    for (const d of active) {
      if (remaining <= 0) break;
      const payment = Math.min(remaining, d.balance);
      d.balance -= payment;
      remaining -= payment;
      if (d.balance <= 0) {
        d.balance = 0;
        if (!(d.name in payoffMonths)) payoffMonths[d.name] = month + 1;
      }
    }
  }

  // Mark any still-outstanding debts as not paid off
  for (const d of pool) {
    if (!(d.name in payoffMonths) && d.balance <= 0.01) {
      payoffMonths[d.name] = allRows.length;
    }
  }

  // Sample every 2nd month to keep chart readable (max ~40 points)
  const chartData = allRows.filter((_, i) => i % 2 === 0);

  return { chartData, payoffMonths };
}

/* ════════════════════════════════════════
   Log Event Modal
════════════════════════════════════════ */
function LogEventModal({ isDark, onClose, onSaved }: { isDark: boolean; onClose: () => void; onSaved: () => void }) {
  const [tab, setTab]           = useState<'income' | 'expense'>('income');
  const [amount, setAmount]     = useState('');
  const [category, setCategory] = useState('');
  const [description, setDesc]  = useState('');
  const [date, setDate]         = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes]       = useState('');
  const [saving, setSaving]     = useState(false);
  const overlayRef              = useRef<HTMLDivElement>(null);
  const db                      = supabase as any;

  const modalCard = {
    background:            isDark ? 'rgba(18,18,30,0.98)' : '#ffffff',
    backdropFilter:        'blur(24px)',
    WebkitBackdropFilter:  'blur(24px)',
    border:                isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
    boxShadow:             isDark ? '0 -8px 40px rgba(0,0,0,0.6)' : '0 -4px 24px rgba(0,0,0,0.12)',
  } as React.CSSProperties;

  const fld = {
    width: '100%', boxSizing: 'border-box' as const,
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    border:     isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
    borderRadius: '10px', padding: '10px 12px', outline: 'none',
    color:      isDark ? 'rgba(255,255,255,0.9)' : '#111',
    fontSize: '13px', colorScheme: isDark ? 'dark' as const : 'light' as const,
  };
  const lbl = {
    display: 'block', fontSize: '10px', textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)', marginBottom: '6px',
  };

  const save = async () => {
    if (!amount || !date) return;
    setSaving(true);
    const { error } = await db.from('finance_transactions').insert({
      type: tab, amount: parseFloat(amount),
      category: category || null, description: description || null,
      date, notes: notes || null,
    });
    setSaving(false);
    if (!error) { onSaved(); onClose(); }
  };

  const accent = tab === 'income' ? '#4ade80' : '#f87171';

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <style>{`@keyframes finSlideUp { from { transform:translateY(40px); opacity:0 } to { transform:translateY(0); opacity:1 } }`}</style>
      <div
        style={{ ...modalCard, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '520px', padding: `24px 20px calc(32px + env(safe-area-inset-bottom))`, animation: 'finSlideUp 0.22s ease', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <p style={{ fontSize: '15px', fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.9)' : '#111' }}>Log Transaction</p>
          <button onClick={onClose} style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center' }}>
            <X size={14} />
          </button>
        </div>

        {/* Income / Expense tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: '12px', padding: '4px' }}>
          {(['income', 'expense'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setCategory(''); }}
              style={{ flex: 1, padding: '8px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'all 0.15s',
                background: tab === t ? (t === 'income' ? '#4ade80' : '#f87171') : 'transparent',
                color: tab === t ? '#fff' : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'),
                boxShadow: tab === t ? (t === 'income' ? '0 0 16px rgba(74,222,128,0.4)' : '0 0 16px rgba(248,113,113,0.4)') : 'none' }}
            >{t}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Amount + Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={lbl}>Amount (ZAR) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={fld} />
            </div>
            <div>
              <label style={lbl}>Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={fld} />
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={lbl}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              style={{ ...fld, color: category ? (isDark ? 'rgba(255,255,255,0.9)' : '#111') : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'), cursor: 'pointer' }}>
              <option value="">Select...</option>
              {(tab === 'income' ? INCOME_CATS : EXPENSE_CATS).map(c => (
                <option key={c} value={c} style={{ background: isDark ? '#1a1a2e' : '#fff' }}>{c}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label style={lbl}>Description</label>
            <input type="text" value={description} onChange={e => setDesc(e.target.value)}
              placeholder={tab === 'income' ? 'e.g. March retainer' : 'e.g. FNB card payment'}
              style={fld} />
          </div>

          {/* Notes */}
          <div>
            <label style={lbl}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional..." style={{ ...fld, resize: 'none' }} />
          </div>

          {/* Save */}
          <button onClick={save} disabled={saving || !amount || !date}
            style={{ marginTop: '4px', padding: '13px', borderRadius: '12px', border: 'none', cursor: amount && date ? 'pointer' : 'not-allowed', background: accent, color: '#fff', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: amount && date ? 1 : 0.5, boxShadow: `0 4px 16px ${tab === 'income' ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.35)'}` }}
          >{saving ? 'Saving...' : `Log ${tab === 'income' ? 'Income' : 'Expense'}`}</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   Page
════════════════════════════════════════ */
export default function Finances() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const { isOwner } = useAuth();

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
  const [txns, setTxns]                 = useState<FinanceTransaction[]>([]);
  const [txnsTableExists, setTxnsTable] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // Cast for tables not yet in generated types
  const db = supabase as any;

  const load = async (showSpin = false) => {
    if (showSpin) setSpin(true);
    const [a, b, c, d, e] = await Promise.all([
      supabase.from('income_entries').select('*').order('month', { ascending: false }),
      supabase.from('debt_entries').select('*'),
      db.from('subscriptions').select('*').order('name'),
      db.from('finance_config').select('*').eq('key', 'sajonix_balance').maybeSingle(),
      db.from('finance_transactions').select('*').order('date', { ascending: false }),
    ]);
    if (a.data) setEntries(a.data as IncomeEntry[]);
    if (b.data) setDebt(b.data as unknown as DebtEntry[]);
    if (c.data) setSubs(c.data as Subscription[]);
    if (d.data) {
      setSajonixBal(parseInt(d.data.value) || 71000);
      setSajonixId(d.data.id || '');
    }
    if (e.error && (e.error.code === 'PGRST205' || e.error.code === '42P01' || e.error.message?.includes('relation'))) {
      setTxnsTable(false);
    } else if (e.data) {
      setTxns(e.data as FinanceTransaction[]);
    }
    setLoading(false);
    if (showSpin) setTimeout(() => setSpin(false), 400);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel('fin3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income_entries' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'debt_entries' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_transactions' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => load())
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
  const joshDraw       = 33000; // Josh's drawings
  // Business surplus: what stays in the business after draw + business subs
  const totalOutflow   = totalSubsMonthly + joshDraw;
  const netSurplus     = mrr - totalOutflow; // business reserves building

  // Avalanche sort — highest interest rate first
  const sortedDebt = [...debt].sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0));

  // Active tab subs
  const tabSubs  = subTab === 'business' ? bizSubs : persSubs;
  const tabTotal = subTab === 'business' ? totalBizSubs : totalPersSubs;

  /* ── Chart data ── */
  const months  = [...new Set(entries.map(e => e.month))].sort().slice(-8);
  const clients = [...new Set(entries.map(e => e.client))].slice(0, 4);
  const fmtMonthLabel = (m: string) =>
    new Date(m + '-01').toLocaleString('en-US', { month: 'short' });
  const lineData = months.map(m => {
    const row: Record<string, any> = { month: fmtMonthLabel(m) };
    clients.forEach(c => {
      row[c.split(' ')[0]] = entries.filter(e => e.month === m && e.client === c).reduce((s, e) => s + e.amount, 0);
    });
    return row;
  });
  const barData = months.map(m => ({
    month: fmtMonthLabel(m),
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
      <TetrisLoading size="sm" speed="fast" showLoadingText={false} />
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

          <div className="rounded-xl overflow-visible pt-6">
            {lineData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm" style={{ color: txt.muted }}>
                No data yet
              </div>
            ) : (() => {
              const revenueBarData = lineData.map(d => ({
                label: String(d.month),
                value: clients.reduce((s, c) => s + (Number(d[c.split(' ')[0]]) || 0), 0),
              }));
              return (
                <MiniChart
                  data={revenueBarData}
                  height={150}
                  color={B1}
                  formatter={v => fmtFull(v)}
                />
              );
            })()}
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

      {/* ══ Row 2: Monthly breakdown ══ */}
      <div className="p-6" style={card}>
        <p className="text-[10px] uppercase tracking-widest mb-5" style={{ color: txt.label }}>Monthly Breakdown</p>
        <div className="pt-6 overflow-visible">
          {barData.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-sm" style={{ color: txt.muted }}>No data</div>
          ) : (
            <MiniChart
              data={barData.map(d => ({ label: String(d.month), value: Number(d.collected) || 0 }))}
              height={140}
              color={B1}
              formatter={v => fmtFull(v)}
            />
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

      {/* ══ Row 2b: Revenue vs Business Costs ══ */}
      {(() => {
        const incExpData = months.map(m => ({
          month: fmtMonthLabel(m),
          income:   entries.filter(e => e.month === m && e.status === 'paid').reduce((s, e) => s + e.amount, 0),
          expenses: totalOutflow,
        }));
        const incExpConfig: ChartConfig = {
          income:   { label: 'Revenue',        color: B1 },
          expenses: { label: 'Costs (Subs + Drawings)', color: '#F87171' },
        };
        return (
          <div className="p-6" style={card}>
            <p className="text-[10px] uppercase tracking-widest mb-5" style={{ color: txt.label }}>Revenue vs Business Costs</p>
            {incExpData.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-sm" style={{ color: txt.muted }}>No data</div>
            ) : (
              <ChartContainer config={incExpConfig} className="h-[160px] w-full">
                <AreaChart data={incExpData} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad-inc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={B1}       stopOpacity={0.18} />
                      <stop offset="95%" stopColor={B1}       stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="grad-exp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#F87171" stopOpacity={0.14} />
                      <stop offset="95%" stopColor="#F87171" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={txt.divider} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: txt.muted }} axisLine={false} tickLine={false} />
                  <ChartTooltip content={
                    <ChartTooltipContent
                      formatter={(v, _n) => (
                        <span className="font-mono font-semibold">{fmtFull(v as number)}</span>
                      )}
                    />
                  } />
                  <Area type="monotone" dataKey="income" stroke={B1} strokeWidth={2}
                    fill="url(#grad-inc)" dot={false} activeDot={{ r: 3, fill: B1 }} />
                  <Area type="monotone" dataKey="expenses" stroke="#F87171" strokeWidth={1.5} strokeDasharray="4 3"
                    fill="url(#grad-exp)" dot={false} activeDot={{ r: 3, fill: '#F87171' }} />
                </AreaChart>
              </ChartContainer>
            )}
            <div className="flex gap-5 mt-3">
              {([['Revenue', B1], ['Costs (Subs + Drawings)', '#F87171']] as const).map(([lbl, col]) => (
                <div key={lbl} className="flex items-center gap-1.5">
                  <div className="h-[3px] w-4 rounded-full" style={{ background: col }} />
                  <span className="text-[10px]" style={{ color: txt.muted }}>{lbl}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ══ Row 3: Net Position + Sajonix Balance ══ */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Net Position */}
        <div className="p-6" style={card}>
          <p className="text-[10px] uppercase tracking-widest mb-4" style={{ color: txt.label }}>Net Position</p>
          <div className="space-y-0">
            {[
              { label: 'MRR',              value: mrr,              minus: false, highlight: false },
              { label: 'Drawings', value: joshDraw, minus: true, highlight: false },
              { label: 'Business Subs',    value: totalSubsMonthly, minus: true,  highlight: false },
              { label: 'Business Reserves', value: netSurplus,      minus: false, highlight: true  },
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

        {/* Debt Paydown Tracker — owner only */}
        {isOwner && <div style={card}>
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
        </div>}
      </div>

      {/* ══ Row 5: Subscriptions ══ */}
      <div style={card}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${txt.divider}` }}>
          <p className="text-sm font-semibold" style={{ color: txt.head }}>Subscriptions</p>
          <div className="flex items-center gap-3">
            {/* Business / Personal tabs — personal hidden from staff */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${txt.inputBorder}` }}>
              {(['business', ...(isOwner ? ['personal'] : [])] as ('business' | 'personal')[]).map(t => (
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

      {/* ══ Debt Projection — owner only ══ */}
      {isOwner && debt.length > 0 && (() => {
        const DEBT_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#c084fc'];
        // Minimums are paid from within living expenses (R36k), not from this budget.
        // The full R21k surplus goes directly to the attack target each month.
        // When a debt is paid off, its freed minimum rolls into the pool (cascade effect).
        const extraNow = 21000;

        const namedSnapshots: DebtNamedSnapshot[] = debt.map(d => ({
          name: d.name,
          balance: d.remaining_amount,
          minPayment: d.monthly_payment,
        }));

        const { chartData, payoffMonths } = calcAvalancheDetailed(namedSnapshots, extraNow);

        // Determine current snowball target: lowest remaining balance
        const avalancheTarget = [...debt].sort((a, b) => a.remaining_amount - b.remaining_amount)[0]?.name ?? '';

        // Helper: payoff month index → display date string "MMM 'YY"
        const payoffDateStr = (monthIdx: number): string => {
          const baseYear = 2026;
          const baseMonth = 2; // March
          const d = new Date(baseYear, baseMonth + monthIdx, 1);
          const mon = d.toLocaleString('en-US', { month: 'short' });
          const yr = String(d.getFullYear()).slice(2);
          return `${mon} '${yr}`;
        };

        // Progress bar colour based on payoff horizon
        const payoffColor = (monthIdx: number): string => {
          if (monthIdx <= 18) return '#4ade80';
          if (monthIdx <= 36) return '#facc15';
          return '#f87171';
        };

        return (
          <>
            {/* Part A — Per-debt payoff projection cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {debt.map((d, idx) => {
                const pctPaid = d.total_amount > 0
                  ? Math.max(0, Math.min(100, ((d.total_amount - d.remaining_amount) / d.total_amount) * 100))
                  : 0;
                const mIdx = payoffMonths[d.name] ?? 360;
                const colour = payoffColor(mIdx);
                const isTarget = d.name === avalancheTarget;
                return (
                  <div key={d.id} className="p-4 space-y-2.5" style={{
                    ...card,
                    borderRadius: '16px',
                    position: 'relative',
                  }}>
                    {isTarget && (
                      <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ background: `${B1}22`, color: B1, border: `1px solid ${B1}44` }}>
                        target
                      </span>
                    )}
                    <p className="text-[11px] font-semibold truncate pr-12" style={{ color: txt.body }}>{d.name}</p>
                    <div>
                      <p className="text-[17px] font-bold tabular-nums leading-tight" style={{ color: txt.head }}>
                        {fmtFull(d.remaining_amount)}
                      </p>
                      <p className="text-[10px] mt-0.5 font-semibold" style={{ color: colour }}>
                        Paid off {payoffDateStr(mIdx)}
                      </p>
                    </div>
                    {/* Progress bar */}
                    <div className="h-[3px] rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)' }}>
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${pctPaid}%`, background: colour, boxShadow: isDark && pctPaid > 0 ? `0 0 6px ${colour}` : 'none' }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px]" style={{ color: txt.muted }}>{fmtFull(d.monthly_payment)}/mo</p>
                      {isTarget && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: `${B1}18`, color: B1 }}>
                          attack
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Part B — Debt projection chart */}
            <div className="p-5" style={card}>
              <div className="mb-4">
                <p className="text-sm font-semibold" style={{ color: txt.head }}>Debt Paydown Projection</p>
                <p className="text-[11px] mt-0.5" style={{ color: txt.muted }}>
                  Snowball method — all surplus attacks lowest balance first
                </p>
              </div>
              {(() => {
                const debtChartConfig = debt.reduce((acc, d, idx) => {
                  acc[d.name] = { label: d.name, color: DEBT_COLORS[idx % DEBT_COLORS.length] };
                  return acc;
                }, {} as ChartConfig);
                return (
                  <ChartContainer config={debtChartConfig} className="h-[200px]">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)'} vertical={false} />
                      <XAxis dataKey="month"
                        tick={{ fontSize: 9, fill: txt.chartAxis }} axisLine={false} tickLine={false}
                        interval="preserveStartEnd" />
                      <ChartTooltip cursor={{ stroke: 'rgba(75,158,255,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }}
                        content={<ChartTooltipContent formatter={(v) => fmtFull(Number(v))} />} />
                      <defs>
                        {debt.map((d, idx) => {
                          const col = DEBT_COLORS[idx % DEBT_COLORS.length];
                          return (
                            <React.Fragment key={d.name}>
                              <HatchedPattern id={`hatch-${idx}`} color={col} animated={false} />
                              <linearGradient id={`grad-debt-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={col} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={col} stopOpacity={0} />
                              </linearGradient>
                            </React.Fragment>
                          );
                        })}
                      </defs>
                      {debt.map((d, idx) => (
                        <Area key={d.name} type="natural" dataKey={d.name} stackId="debt"
                          stroke={DEBT_COLORS[idx % DEBT_COLORS.length]} strokeWidth={0.8}
                          fill={`url(#grad-debt-${idx})`} fillOpacity={0.4}
                          dot={false} animationDuration={1200 + idx * 150} animationEasing="ease-out" />
                      ))}
                    </AreaChart>
                  </ChartContainer>
                );
              })()}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                {debt.map((d, idx) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="h-[3px] w-3 rounded-full" style={{ background: DEBT_COLORS[idx % DEBT_COLORS.length] }} />
                    <span className="text-[10px]" style={{ color: txt.muted }}>{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      })()}

      {/* ══ Row 6: Debt Attack Scenarios ══ */}
      {(() => {
        const debtSnapshots = debt.map(d => ({ balance: d.remaining_amount, minPayment: d.monthly_payment }));
        if (debtSnapshots.length === 0) return null;
        // Minimums are inside the R36k living costs — already paid.
        // Full R21k surplus = pure attack. Freed minimums cascade as each debt is cleared.
        const extraNow   = 21000;
        const extraOzayr = 21000 + 20000; // +Ozayr R20k retainer
        const minimumsOnly = calcAvalanche(debtSnapshots, 0);
        const current      = calcAvalanche(debtSnapshots, extraNow);
        const withOzayr    = calcAvalanche(debtSnapshots, extraOzayr);

        const scenarios = [
          { label: 'Minimums only',    result: minimumsOnly, extra: null },
          { label: 'Current plan',     result: current,      extra: { vs: minimumsOnly, tag: 'R21k/mo pure surplus (mins in living costs)' } },
          { label: '+Ozayr onboarded', result: withOzayr,    extra: { vs: minimumsOnly, tag: '+R20k retainer → R41k/mo attack' } },
        ];

        return (
          <div style={card}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${txt.divider}` }}>
              <p className="text-sm font-semibold" style={{ color: txt.head }}>Debt Attack Scenarios</p>
              <p className="text-[11px] mt-0.5" style={{ color: txt.muted }}>
                {fmtFull(totalDebt)} total debt at 22% p.a. Snowball method — lowest balance first.
              </p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {scenarios.map(({ label, result, extra }) => {
                const years = result.months / 12;
                const dateColor = years <= 3 ? '#4ade80' : years <= 5 ? '#facc15' : '#f87171';
                const savedMonths = extra ? extra.vs.months - result.months : 0;
                const savedInterest = extra ? extra.vs.totalInterest - result.totalInterest : 0;
                return (
                  <div key={label} className="rounded-2xl p-4 space-y-3"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                    }}>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: txt.label }}>{label}</p>
                      {extra && (
                        <p className="text-[9px] mt-0.5" style={{ color: txt.muted }}>{extra.tag}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px]" style={{ color: txt.muted }}>Debt-free by</p>
                      <p className="text-[22px] font-bold leading-tight tabular-nums" style={{ color: dateColor }}>
                        {result.debtFreeDate}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span style={{ color: txt.muted }}>Months</span>
                        <span className="font-semibold tabular-nums" style={{ color: txt.body }}>{result.months}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span style={{ color: txt.muted }}>Total interest</span>
                        <span className="font-semibold tabular-nums" style={{ color: '#f87171' }}>{fmtFull(result.totalInterest)}</span>
                      </div>
                    </div>
                    {extra && savedMonths > 0 && (
                      <div className="pt-2 space-y-1" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: '#4ade80' }} />
                          <span className="text-[11px] font-medium" style={{ color: '#4ade80' }}>
                            Saves {savedMonths} months
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: '#4ade80' }} />
                          <span className="text-[11px] font-medium" style={{ color: '#4ade80' }}>
                            Saves {fmtFull(savedInterest)} interest
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ══ Row 7: Monthly Transaction Log ══ */}
      {txnsTableExists ? (
        (() => {
          if (txns.length === 0) return (
            <div style={card} className="p-8 text-center">
              <p className="text-sm font-semibold" style={{ color: txt.body }}>No transactions logged yet</p>
              <p className="text-[11px] mt-1" style={{ color: txt.muted }}>Tap + to log your first income or expense</p>
            </div>
          );
          const byMonth: Record<string, FinanceTransaction[]> = {};
          for (const t of txns) {
            const m = t.date.slice(0, 7);
            if (!byMonth[m]) byMonth[m] = [];
            byMonth[m].push(t);
          }
          const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));
          const currentMonth = new Date().toISOString().slice(0, 7);
          return (
            <div style={card}>
              <div className="px-5 py-4" style={{ borderBottom: `1px solid ${txt.divider}` }}>
                <p className="text-sm font-semibold" style={{ color: txt.head }}>Monthly Log</p>
                <p className="text-[11px] mt-0.5" style={{ color: txt.muted }}>{txns.length} transaction{txns.length !== 1 ? 's' : ''} logged</p>
              </div>
              {months.map(m => {
                const mTxns   = byMonth[m];
                const mIn     = mTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
                const mOut    = mTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                const mNet    = mIn - mOut;
                const isOpen  = expandedMonth !== null ? expandedMonth === m : m === currentMonth;
                const label   = new Date(m + '-02').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
                return (
                  <div key={m} style={{ borderTop: `1px solid ${txt.divider}` }}>
                    <button
                      className="w-full px-5 py-3.5 flex items-center justify-between"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => setExpandedMonth(isOpen ? '' : m)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[13px] font-semibold" style={{ color: txt.body }}>{label}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: mNet >= 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: mNet >= 0 ? '#4ade80' : '#f87171', border: `1px solid ${mNet >= 0 ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}` }}>
                          {mNet >= 0 ? '+' : ''}{fmtFull(mNet)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-[11px] hidden sm:block" style={{ color: '#4ade80' }}>+{fmtFull(mIn)}</span>
                        <span className="text-[11px] hidden sm:block" style={{ color: '#f87171' }}>{fmtFull(mOut)}</span>
                        <span className="text-[10px]" style={{ color: txt.muted }}>{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-3 space-y-0">
                        {[...mTxns].sort((a, b) => b.date.localeCompare(a.date)).map(t => (
                          <div key={t.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: `1px solid ${txt.divider}` }}>
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ background: t.type === 'income' ? '#4ade80' : '#f87171' }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] truncate" style={{ color: txt.body }}>{t.description || t.category || t.type}</p>
                              {t.category && t.description && <p className="text-[10px]" style={{ color: txt.muted }}>{t.category}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[12px] font-semibold tabular-nums" style={{ color: t.type === 'income' ? '#4ade80' : '#f87171' }}>
                                {t.type === 'income' ? '+' : '-'}{fmtFull(t.amount)}
                              </p>
                              <p className="text-[9px]" style={{ color: txt.muted }}>
                                {new Date(t.date + 'T12:00:00').toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()
      ) : (
        <div style={{ ...card, borderRadius: '16px' }} className="p-5 space-y-3">
          <p className="text-[12px] font-semibold" style={{ color: txt.body }}>Enable transaction log</p>
          <p className="text-[11px]" style={{ color: txt.muted }}>Run in Supabase SQL editor to activate:</p>
          <div className="rounded-xl p-3 font-mono text-[10px] overflow-auto" style={{ background: 'rgba(75,158,255,0.06)', border: '1px solid rgba(75,158,255,0.15)', color: `${B1}cc` }}>
            <p>CREATE TABLE finance_transactions (</p>
            <p>&nbsp;&nbsp;id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),</p>
            <p>&nbsp;&nbsp;type        text NOT NULL CHECK (type IN ('income','expense')),</p>
            <p>&nbsp;&nbsp;amount      numeric NOT NULL,</p>
            <p>&nbsp;&nbsp;category    text,</p>
            <p>&nbsp;&nbsp;description text,</p>
            <p>&nbsp;&nbsp;date        date NOT NULL DEFAULT CURRENT_DATE,</p>
            <p>&nbsp;&nbsp;notes       text,</p>
            <p>&nbsp;&nbsp;created_at  timestamptz DEFAULT now()</p>
            <p>);</p>
            <p>ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;</p>
            <p>CREATE POLICY "service_role_all" ON finance_transactions USING (true) WITH CHECK (true);</p>
          </div>
        </div>
      )}

      {/* Bottom spacer for FAB */}
      <div className="h-24 md:h-16" />

      {/* ── Log Transaction FAB ── */}
      <button
        onClick={() => setShowLogModal(true)}
        className="fixed bottom-20 right-6 md:bottom-6"
        style={{ position: 'fixed', zIndex: 900, width: '52px', height: '52px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#4ade80', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(74,222,128,0.5), 0 0 0 1px rgba(74,222,128,0.3)', transition: 'transform 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        aria-label="Log transaction"
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>

      {showLogModal && (
        <LogEventModal isDark={isDark} onClose={() => setShowLogModal(false)} onSaved={() => load()} />
      )}

    </div>
  );
}
