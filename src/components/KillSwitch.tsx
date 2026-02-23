import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Power, PlayCircle, ShieldAlert } from 'lucide-react';

const B = '#4B9EFF';

const glass = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '20px',
  boxShadow: 'var(--s-card-shadow)',
} as React.CSSProperties;

export const KillSwitch: React.FC = () => {
  const [status, setStatus] = useState<'running' | 'stopped'>('running');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [lastTriggered, setLastTriggered] = useState<string | null>(null);
  const [triggeredBy, setTriggeredBy] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    fetchKillSwitchStatus();
    const channel = supabase.channel('kill_switch_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kill_switch' }, fetchKillSwitchStatus)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchKillSwitchStatus = async () => {
    const { data, error } = await supabase
      .from('kill_switch').select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001').single();
    if (!error && data) {
      setStatus((data.status as 'running' | 'stopped') || 'running');
      setLastTriggered(data.triggered_at || null);
      setTriggeredBy(data.triggered_by || null);
      setReason(data.reason || null);
    }
    setLoading(false);
  };

  const toggleKillSwitch = async () => {
    setToggling(true);
    const newStatus = status === 'running' ? 'stopped' : 'running';
    const reasonText = newStatus === 'stopped' ? 'Manual emergency stop via dashboard' : 'Operations resumed via dashboard';
    try {
      const { error } = await supabase.from('kill_switch').update({
        status: newStatus, triggered_at: new Date().toISOString(), triggered_by: 'Josh', reason: reasonText,
      }).eq('id', '00000000-0000-0000-0000-000000000001');
      if (error) throw error;
      await supabase.from('audit_log').insert({
        agent: 'System',
        action: newStatus === 'stopped' ? 'kill_switch_activated' : 'kill_switch_deactivated',
        details: { status: newStatus, reason: reasonText }, status: 'success',
      });
      fetch('/api/kill-switch/file', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus === 'stopped' ? 'STOP' : 'RUNNING' }),
      }).catch(() => {});
      setStatus(newStatus);
      if (newStatus === 'stopped') toast.error('KILL SWITCH ACTIVATED');
      else toast.success('Operations resumed');
    } catch { toast.error('Failed to toggle kill switch'); }
    finally { setToggling(false); }
  };

  const isStopped = status === 'stopped';

  return (
    <div className="space-y-3">
      {isStopped && (
        <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 animate-pulse"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <ShieldAlert className="h-4 w-4 shrink-0" style={{ color: 'var(--tc-80)' }} />
          <p className="text-xs font-semibold text-white/80 tracking-wider">
            KILL SWITCH ACTIVE — ALL OPERATIONS HALTED
          </p>
        </div>
      )}

      <div style={{
        ...glass,
        background: isStopped ? 'rgba(255,255,255,0.06)' : 'var(--s-card)',
        border: `1px solid ${isStopped ? 'rgba(255,255,255,0.18)' : 'var(--s-card-b)'}`,
        boxShadow: isStopped ? '0 0 40px rgba(255,255,255,0.08), 0 1px 0 rgba(255,255,255,0.08) inset' : glass.boxShadow,
      }} className="p-5">
        <div className="flex items-center gap-2 mb-4">
          {isStopped
            ? <ShieldAlert className="h-4 w-4" style={{ color: 'var(--tc-70)' }} />
            : <Power className="h-4 w-4" style={{ color: B }} />
          }
          <h3 className="text-sm font-semibold" style={{ color: 'var(--tc-80)' }}>
            Emergency Kill Switch
          </h3>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="h-2 w-2 rounded-full"
              style={{
                background: isStopped ? 'rgba(255,255,255,0.7)' : B,
                boxShadow: isStopped ? '0 0 6px rgba(255,255,255,0.5)' : `0 0 6px ${B}`,
                animation: isStopped ? undefined : 'pulse 2s infinite',
              }} />
            <span className="text-[10px] font-semibold tracking-wider"
              style={{ color: isStopped ? 'var(--tc-70)' : B }}>
              {isStopped ? 'STOPPED' : 'RUNNING'}
            </span>
          </div>
        </div>

        <button
          onClick={toggleKillSwitch}
          disabled={loading || toggling}
          className="w-full py-3 text-sm font-semibold tracking-wide rounded-xl transition-all"
          style={isStopped ? {
            background: `${B}20`, color: B, border: `1px solid ${B}40`,
            boxShadow: `0 0 20px ${B}25`,
          } : {
            background: 'rgba(255,255,255,0.07)', color: 'var(--tc-70)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          {toggling ? (
            <span className="animate-pulse">Processing...</span>
          ) : isStopped ? (
            <span className="flex items-center justify-center gap-2">
              <PlayCircle className="h-4 w-4" />RESUME ALL OPERATIONS
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Power className="h-4 w-4" />STOP ALL OPERATIONS
            </span>
          )}
        </button>

        <div className="mt-4 space-y-1.5 text-[10px]" style={{ color: 'var(--tc-25)' }}>
          {lastTriggered && (
            <div className="flex justify-between">
              <span>Last triggered</span>
              <span style={{ color: 'var(--tc-45)' }}>{new Date(lastTriggered).toLocaleString()}</span>
            </div>
          )}
          {triggeredBy && (
            <div className="flex justify-between">
              <span>By</span>
              <span style={{ color: 'var(--tc-45)' }}>{triggeredBy}</span>
            </div>
          )}
          {reason && isStopped && (
            <div className="flex justify-between gap-4">
              <span>Reason</span>
              <span className="text-right" style={{ color: 'var(--tc-45)' }}>{reason}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
