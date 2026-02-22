import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, Power, PlayCircle, ShieldAlert } from 'lucide-react';

export const KillSwitch: React.FC = () => {
  const [status, setStatus] = useState<'running' | 'stopped'>('running');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [lastTriggered, setLastTriggered] = useState<string | null>(null);
  const [triggeredBy, setTriggeredBy] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    fetchKillSwitchStatus();

    const channel = supabase
      .channel('kill_switch_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kill_switch' }, () => {
        fetchKillSwitchStatus();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchKillSwitchStatus = async () => {
    const { data, error } = await supabase
      .from('kill_switch')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

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
      const { error } = await supabase
        .from('kill_switch')
        .update({
          status: newStatus,
          triggered_at: new Date().toISOString(),
          triggered_by: 'Josh',
          reason: reasonText,
        })
        .eq('id', '00000000-0000-0000-0000-000000000001');

      if (error) throw error;

      await supabase.from('audit_log').insert({
        agent: 'System',
        action: newStatus === 'stopped' ? 'kill_switch_activated' : 'kill_switch_deactivated',
        details: { status: newStatus, reason: reasonText },
        status: 'success',
      });

      fetch('/api/kill-switch/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus === 'stopped' ? 'STOP' : 'RUNNING' }),
      }).catch(() => {});

      setStatus(newStatus);

      if (newStatus === 'stopped') {
        toast.error('KILL SWITCH ACTIVATED');
      } else {
        toast.success('Operations resumed');
      }
    } catch {
      toast.error('Failed to toggle kill switch');
    } finally {
      setToggling(false);
    }
  };

  const isStopped = status === 'stopped';

  return (
    <div className="space-y-4">
      {isStopped && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 flex items-center gap-2 animate-pulse">
          <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs font-medium text-destructive">
            KILL SWITCH ACTIVE — ALL OPERATIONS HALTED
          </p>
        </div>
      )}

      <div className={`rounded-2xl p-5 transition-colors duration-500 ${
        isStopped
          ? "bg-destructive/10 ring-2 ring-destructive/40"
          : "bg-card"
      }`}>
        <div className="flex items-center gap-2 mb-4">
          {isStopped ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <Power className="h-4 w-4 text-success" />
          )}
          <h3 className={`text-sm font-semibold ${isStopped ? "text-destructive" : "text-success"}`}>
            Emergency Kill Switch
          </h3>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className={`h-2 w-2 rounded-full ${isStopped ? 'bg-destructive' : 'bg-success animate-pulse'}`} />
            <span className={`text-[10px] font-medium tracking-wider ${isStopped ? 'text-destructive' : 'text-success'}`}>
              {isStopped ? 'STOPPED' : 'RUNNING'}
            </span>
          </div>
        </div>

        <Button
          onClick={toggleKillSwitch}
          disabled={loading || toggling}
          className={`w-full py-5 text-sm font-semibold tracking-wide rounded-xl transition-all ${
            isStopped
              ? 'bg-success/20 hover:bg-success/30 text-success border border-success/40'
              : 'bg-destructive/80 hover:bg-destructive text-white border border-destructive/40'
          }`}
        >
          {toggling ? (
            <span className="animate-pulse">Processing...</span>
          ) : isStopped ? (
            <>
              <PlayCircle className="h-4 w-4 mr-2" />
              RESUME ALL OPERATIONS
            </>
          ) : (
            <>
              <Power className="h-4 w-4 mr-2" />
              STOP ALL OPERATIONS
            </>
          )}
        </Button>

        <div className="mt-4 space-y-1.5 text-[10px] text-card-foreground/40">
          {lastTriggered && (
            <div className="flex justify-between">
              <span>Last triggered</span>
              <span className="text-card-foreground/60">{new Date(lastTriggered).toLocaleString()}</span>
            </div>
          )}
          {triggeredBy && (
            <div className="flex justify-between">
              <span>By</span>
              <span className="text-card-foreground/60">{triggeredBy}</span>
            </div>
          )}
          {reason && isStopped && (
            <div className="flex justify-between">
              <span>Reason</span>
              <span className="text-destructive/80 text-right max-w-[60%]">{reason}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
