import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

    return () => {
      supabase.removeChannel(channel);
    };
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

      // Also write to audit log
      await supabase.from('audit_log').insert({
        agent: 'System',
        action: newStatus === 'stopped' ? 'kill_switch_activated' : 'kill_switch_deactivated',
        details: { status: newStatus, reason: reasonText },
        status: 'success',
      });

      // Fire-and-forget filesystem write (won't block if endpoint doesn't exist yet)
      fetch('/api/kill-switch/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus === 'stopped' ? 'STOP' : 'RUNNING' }),
      }).catch(() => {});

      setStatus(newStatus);

      if (newStatus === 'stopped') {
        toast.error('KILL SWITCH ACTIVATED — All operations halted');
      } else {
        toast.success('Operations resumed — Agents back online');
      }
    } catch (err) {
      toast.error('Failed to toggle kill switch');
    } finally {
      setToggling(false);
    }
  };

  const isStopped = status === 'stopped';

  return (
    <div className="space-y-4">
      {isStopped && (
        <Alert className="border-destructive/50 bg-destructive/10 animate-pulse">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive font-mono text-xs">
            KILL SWITCH ACTIVE — ALL AGENT OPERATIONS HALTED
          </AlertDescription>
        </Alert>
      )}

      <Card className={`border-2 transition-colors duration-500 ${isStopped ? 'border-destructive/80 bg-destructive/5' : 'border-success/50 bg-card'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            {isStopped ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <Power className="h-4 w-4 text-success" />
            )}
            <CardTitle className={`text-sm font-display tracking-wide ${isStopped ? 'text-destructive' : 'text-success'}`}>
              Emergency Kill Switch
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`h-2 w-2 rounded-full ${isStopped ? 'bg-destructive' : 'bg-success animate-pulse'}`} />
            <span className={`font-mono text-[10px] uppercase tracking-widest ${isStopped ? 'text-destructive' : 'text-success'}`}>
              {isStopped ? 'STOPPED' : 'RUNNING'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={toggleKillSwitch}
            disabled={loading || toggling}
            className={`w-full py-6 text-base font-display tracking-wider transition-all duration-300 ${
              isStopped
                ? 'bg-success/20 hover:bg-success/30 text-success border border-success/50'
                : 'bg-destructive/80 hover:bg-destructive text-white border border-destructive/50'
            }`}
          >
            {toggling ? (
              <span className="font-mono text-xs animate-pulse">Processing...</span>
            ) : isStopped ? (
              <>
                <PlayCircle className="h-5 w-5 mr-2" />
                RESUME ALL OPERATIONS
              </>
            ) : (
              <>
                <Power className="h-5 w-5 mr-2" />
                STOP ALL OPERATIONS
              </>
            )}
          </Button>

          <div className="space-y-1 p-3 bg-secondary/30 rounded-md border border-border/30 font-mono text-[10px] text-muted-foreground">
            <div className="flex justify-between">
              <span>Status</span>
              <span className={isStopped ? 'text-destructive' : 'text-success'}>{isStopped ? 'STOPPED' : 'RUNNING'}</span>
            </div>
            {lastTriggered && (
              <div className="flex justify-between">
                <span>Last triggered</span>
                <span className="text-foreground/60">{new Date(lastTriggered).toLocaleString()}</span>
              </div>
            )}
            {triggeredBy && (
              <div className="flex justify-between">
                <span>Triggered by</span>
                <span className="text-foreground/60">{triggeredBy}</span>
              </div>
            )}
            {reason && isStopped && (
              <div className="flex justify-between">
                <span>Reason</span>
                <span className="text-destructive/80 max-w-[60%] text-right">{reason}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
