import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollText, Plus, Calendar, AlertTriangle, CheckCircle, Clock, DollarSign } from 'lucide-react';

/* ── Types ── */
interface Contract {
  id: string;
  client_name: string;
  client_slug: string | null;
  contract_type: string;
  status: 'active' | 'expired' | 'pending' | 'cancelled';
  start_date: string | null;
  end_date: string | null;
  monthly_value: number | null;
  total_value: number | null;
  notes: string | null;
  file_url: string | null;
  created_at: string | null;
}

const B = '#4B9EFF';
const card = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '16px',
  boxShadow: 'var(--s-card-shadow)',
} as React.CSSProperties;

const statusCfg: Record<string, { color: string; bg: string; border: string; label: string; Icon: any }> = {
  active:    { color: '#4ADE80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)',  label: 'Active',    Icon: CheckCircle },
  pending:   { color: B,         bg: `${B}15`,                 border: `${B}30`,                label: 'Pending',   Icon: Clock },
  expired:   { color: '#F87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', label: 'Expired',   Icon: AlertTriangle },
  cancelled: { color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)', label: 'Cancelled', Icon: AlertTriangle },
};

function fmtDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtZAR(n: number | null) {
  if (!n) return '';
  return 'R' + Math.round(n).toLocaleString('en-ZA');
}

function daysUntilExpiry(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

/* ════════════════════════════════════════
   Page
════════════════════════════════════════ */
export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tableExists, setExists]  = useState(true);
  const [filter, setFilter]       = useState<'all' | 'active' | 'expired' | 'pending'>('all');
  const [expanded, setExpanded]   = useState<string | null>(null);

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const { data, error } = await (supabase as any).from('contracts').select('*').order('end_date', { ascending: true });
      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('relation') || error.code === '42P01') {
          setExists(false);
        }
      } else {
        setContracts((data as Contract[]) || []);
      }
    } catch {
      setExists(false);
    }
    setLoading(false);
  };

  const filtered = contracts.filter(c => filter === 'all' || c.status === filter);
  const totalMRR = contracts.filter(c => c.status === 'active').reduce((s, c) => s + (c.monthly_value || 0), 0);
  const expiringSoon = contracts.filter(c => { const d = daysUntilExpiry(c.end_date); return d !== null && d >= 0 && d <= 30 && c.status === 'active'; });

  /* ── Table not created yet ── */
  if (!tableExists) {
    return (
      <div className="space-y-5">
        <div style={{ ...card, borderRadius: '20px' }} className="p-8 text-center space-y-4">
          <ScrollText className="h-10 w-10 mx-auto" style={{ color: `${B}50` }} />
          <div>
            <p className="text-base font-semibold" style={{ color: 'var(--tc-70)' }}>Contracts tracker ready to activate</p>
            <p className="text-sm mt-1" style={{ color: 'var(--tc-35)' }}>Run the migration to track retainers and client agreements.</p>
          </div>
          <div className="rounded-xl p-4 text-left font-mono text-[11px] overflow-auto"
            style={{ background: 'rgba(75,158,255,0.06)', border: '1px solid rgba(75,158,255,0.15)', color: `${B}cc` }}>
            <p style={{ color: 'var(--tc-30)' }}>-- Run in Supabase SQL editor:</p>
            <p>CREATE TABLE contracts (</p>
            <p>&nbsp;&nbsp;id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),</p>
            <p>&nbsp;&nbsp;client_name    text NOT NULL,</p>
            <p>&nbsp;&nbsp;client_slug    text,</p>
            <p>&nbsp;&nbsp;contract_type  text NOT NULL DEFAULT 'retainer',</p>
            <p>&nbsp;&nbsp;status         text NOT NULL DEFAULT 'active'</p>
            <p>&nbsp;&nbsp;&nbsp;&nbsp;CHECK (status IN ('active','expired','pending','cancelled')),</p>
            <p>&nbsp;&nbsp;start_date     date,</p>
            <p>&nbsp;&nbsp;end_date       date,</p>
            <p>&nbsp;&nbsp;monthly_value  numeric,</p>
            <p>&nbsp;&nbsp;total_value    numeric,</p>
            <p>&nbsp;&nbsp;notes          text,</p>
            <p>&nbsp;&nbsp;file_url       text,</p>
            <p>&nbsp;&nbsp;created_at     timestamptz DEFAULT now()</p>
            <p>);</p>
            <p>ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;</p>
            <p>CREATE POLICY "service_role_all" ON contracts USING (true) WITH CHECK (true);</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Active',   value: contracts.filter(c => c.status === 'active').length,  color: '#4ADE80' },
          { label: 'Pending',  value: contracts.filter(c => c.status === 'pending').length, color: B },
          { label: 'Expiring', value: expiringSoon.length,                                   color: '#FBBF24' },
          { label: 'Total MRR', value: fmtZAR(totalMRR),                                    color: B },
        ].map(s => (
          <div key={s.label} style={{ ...card, borderRadius: '14px' }} className="p-4">
            <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--tc-25)' }}>{s.label}</p>
            <p className="text-2xl font-bold tabular-nums" style={{ color: s.value && s.value !== '0' && s.value !== 'R0' ? s.color : 'var(--tc-30)' }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Expiry warning ── */}
      {expiringSoon.length > 0 && (
        <div className="px-4 py-3 rounded-xl flex items-center gap-3"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: '#FBBF24' }} />
          <p className="text-[12px]" style={{ color: '#FBBF24' }}>
            {expiringSoon.length} contract{expiringSoon.length > 1 ? 's' : ''} expiring within 30 days: {expiringSoon.map(c => c.client_name).join(', ')}
          </p>
        </div>
      )}

      {/* ── Filter + add ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'active', 'pending', 'expired'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-[11px] font-medium capitalize transition-all"
            style={filter === f
              ? { background: `${B}20`, border: `1px solid ${B}40`, color: B }
              : { background: 'var(--s-hover)', border: '1px solid var(--s-pill-b)', color: 'var(--tc-35)' }}>
            {f} {f !== 'all' && `(${contracts.filter(c => c.status === f).length})`}
          </button>
        ))}
        <button
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white"
          style={{ background: B, boxShadow: `0 0 16px ${B}40` }}>
          <Plus className="h-3.5 w-3.5" />
          Add contract
        </button>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: B, borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card, borderRadius: '20px' }} className="p-12 text-center">
          <ScrollText className="h-8 w-8 mx-auto mb-3" style={{ color: `${B}40` }} />
          <p className="text-sm" style={{ color: 'var(--tc-25)' }}>
            {filter !== 'all' ? `No ${filter} contracts` : 'No contracts yet — add your first retainer'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(contract => {
            const cfg     = statusCfg[contract.status] || statusCfg.pending;
            const Icon    = cfg.Icon;
            const days    = daysUntilExpiry(contract.end_date);
            const isOpen  = expanded === contract.id;
            return (
              <div key={contract.id} style={{ ...card, cursor: 'pointer' }}
                onClick={() => setExpanded(isOpen ? null : contract.id)}>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                        <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--tc-85)' }}>{contract.client_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px]" style={{ color: 'var(--tc-35)' }}>
                            {contract.contract_type}
                          </span>
                          {contract.monthly_value && (
                            <>
                              <span style={{ color: 'var(--tc-20)', fontSize: 8 }}>·</span>
                              <span className="text-[10px] font-medium" style={{ color: B }}>
                                {fmtZAR(contract.monthly_value)}/mo
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {days !== null && days >= 0 && days <= 30 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.3)' }}>
                          {days}d left
                        </span>
                      )}
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-5 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {[
                      { label: 'Start',    value: fmtDate(contract.start_date) || 'TBD' },
                      { label: 'End',      value: fmtDate(contract.end_date) || 'TBD' },
                      { label: 'Monthly',  value: fmtZAR(contract.monthly_value) || 'TBD' },
                      { label: 'Total',    value: fmtZAR(contract.total_value) || 'TBD' },
                    ].map(f => (
                      <div key={f.label} className="pt-4">
                        <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--tc-25)' }}>{f.label}</p>
                        <p className="text-[12px] font-medium" style={{ color: 'var(--tc-70)' }}>{f.value}</p>
                      </div>
                    ))}
                    {contract.notes && (
                      <div className="col-span-2 md:col-span-4 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--tc-25)' }}>Notes</p>
                        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--tc-50)' }}>{contract.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
