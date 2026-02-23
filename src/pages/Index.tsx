import { useState, useEffect } from "react";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { EmailQueue } from "@/components/EmailQueue";
import { KillSwitch } from "@/components/KillSwitch";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Zap, Mail, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Agent {
  id: string; name: string; role: string;
  status: string | null; current_task: string | null; last_activity: string | null;
}

const B = '#4B9EFF';

const card = {
  background: '#0d0d0d',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '20px',
} as React.CSSProperties;

const roleLabels: Record<string, string> = {
  csm: 'Customer Success', outreach: 'Cold Outreach',
  automation: 'Automation', monitor: 'Monitor',
};

export default function Index() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel('dash_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchAll = async () => {
    const [agRes, emailRes] = await Promise.all([
      supabase.from('agents').select('*').order('created_at'),
      supabase.from('email_queue').select('id').in('status', ['awaiting_approval', 'auto_pending']),
    ]);
    if (!agRes.error) setAgents(agRes.data || []);
    if (!emailRes.error) setPendingCount(emailRes.data?.length || 0);
    setLoading(false);
  };

  const online  = agents.filter(a => a.status === 'online').length;
  const idle    = agents.filter(a => a.status === 'idle').length;
  const offline = agents.filter(a => a.status === 'offline' || !a.status).length;

  return (
    <div className="space-y-5">
      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Agents Online',   value: online,        active: online > 0 },
          { label: 'Agents Idle',     value: idle,          active: false },
          { label: 'Agents Offline',  value: offline,       active: false },
          { label: 'Pending Approvals', value: pendingCount, active: pendingCount > 0 },
        ].map(s => (
          <div key={s.label} style={card} className="p-5 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full blur-2xl"
              style={{ background: s.active ? `${B}20` : 'transparent' }} />
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">{s.label}</p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: s.active ? B : 'rgba(255,255,255,0.7)' }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Agents ── */}
      <div>
        <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">
          Agents — {online} online
        </p>
        {loading ? (
          <div className="h-5 w-5 rounded-full border-2 animate-spin mx-auto"
            style={{ borderColor: B, borderTopColor: 'transparent' }} />
        ) : agents.length === 0 ? (
          <div style={card} className="p-10 text-center text-sm text-white/20">
            No agents configured
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {agents.map(agent => {
              const isOnline = agent.status === 'online';
              const isIdle   = agent.status === 'idle';
              return (
                <div key={agent.id} style={card} className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                        style={{ background: isOnline ? `${B}15` : 'rgba(255,255,255,0.04)', border: `1px solid ${isOnline ? `${B}30` : 'rgba(255,255,255,0.06)'}` }}>
                        <Bot className="h-4 w-4" style={{ color: isOnline ? B : 'rgba(255,255,255,0.3)' }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{agent.name}</p>
                        <p className="text-[11px] text-white/30">{roleLabels[agent.role] || agent.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background: isOnline ? B : isIdle ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)',
                          boxShadow: isOnline ? `0 0 5px ${B}` : 'none',
                        }} />
                      <span className="text-[10px] font-medium uppercase tracking-wider"
                        style={{ color: isOnline ? B : isIdle ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)' }}>
                        {agent.status || 'offline'}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-white/5 pt-3">
                    <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1">Current task</p>
                    <p className="text-xs text-white/50 truncate">{agent.current_task || 'No active task'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Email queue + Kill switch ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><EmailQueue /></div>
        <div className="lg:col-span-1"><KillSwitch /></div>
      </div>

      {/* ── Activity feed ── */}
      <ActivityFeed />
    </div>
  );
}
