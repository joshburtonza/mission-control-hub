import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

export const KillSwitch: React.FC = () => {
  const [status, setStatus] = useState<'running' | 'stopped'>('running');
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchKillSwitchStatus();
    const subscription = supabase
      .from('kill_switch')
      .on('*', () => {
        fetchKillSwitchStatus();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchKillSwitchStatus = async () => {
    const { data, error } = await supabase
      .from('kill_switch')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    if (!error && data) {
      setStatus(data.status);
      setReason(data.reason || '');
    }
    setLoading(false);
  };

  const toggleKillSwitch = async () => {
    const newStatus = status === 'running' ? 'stopped' : 'running';
    const { error } = await supabase
      .from('kill_switch')
      .update({
        status: newStatus,
        triggered_at: new Date().toISOString(),
        triggered_by: 'Josh',
        reason: newStatus === 'stopped' ? 'Manual emergency stop' : 'Resume operations'
      })
      .eq('id', '00000000-0000-0000-0000-000000000001');

    if (!error) {
      setStatus(newStatus);
      // Also write to file system
      const fileStatus = newStatus === 'stopped' ? 'STOP' : 'RUNNING';
      fetch('/api/kill-switch/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: fileStatus })
      });
    }
  };

  return (
    <div className="space-y-4">
      {status === 'stopped' && (
        <Alert className="border-red-500/50 bg-red-950/30">
          <AlertDescription className="text-red-400">
            ⚠️ KILL SWITCH ACTIVE - ALL OPERATIONS HALTED
          </AlertDescription>
        </Alert>
      )}

      <Card className={`border-2 ${status === 'stopped' ? 'border-red-500' : 'border-green-500'}`}>
        <CardHeader>
          <CardTitle className={status === 'stopped' ? 'text-red-400' : 'text-green-400'}>
            Emergency Kill Switch
          </CardTitle>
          <CardDescription className="text-gray-400">
            Status: {status === 'running' ? '🟢 RUNNING' : '🔴 STOPPED'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={toggleKillSwitch}
            disabled={loading}
            className={`w-full text-lg font-bold py-6 ${
              status === 'running'
                ? 'bg-red-900 hover:bg-red-800 text-red-100'
                : 'bg-green-900 hover:bg-green-800 text-green-100'
            }`}
          >
            {status === 'running' ? '🛑 STOP ALL OPERATIONS' : '▶️ RESUME OPERATIONS'}
          </Button>

          {status === 'stopped' && reason && (
            <div className="p-3 bg-gray-950 rounded text-sm text-gray-400">
              <p className="text-xs uppercase text-gray-500">Reason</p>
              <p className="text-red-300">{reason}</p>
            </div>
          )}

          <div className="text-xs text-gray-500 p-3 bg-gray-950 rounded font-mono">
            <p>Kill switch file: /Users/henryburton/.openclaw/KILL_SWITCH</p>
            <p>Status: {status === 'stopped' ? 'STOP' : 'RUNNING'}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-black border-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-300 text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-gray-500 space-y-1">
            <p>Last triggered: {status === 'stopped' ? 'Active' : 'Not active'}</p>
            <p>Triggered by: Josh</p>
            <p>All agents: {status === 'stopped' ? 'OFFLINE' : 'ONLINE'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
