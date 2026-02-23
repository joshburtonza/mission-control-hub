import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bot, Play, Pause, RotateCcw, Terminal, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Agent { id: string; name: string; role: string; status: string | null; current_task: string | null; last_activity: string | null; }
interface Task  { id: string; agent: string | null; task_type: string | null; status: string | null; payload: any; created_at: string | null; }

const B = '#4B9EFF';
const card = { background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px' } as React.CSSProperties;
const roleLabels: Record<string, string> = { csm: 'Customer Success', outreach: 'Cold Outreach', automation: 'Automation', monitor: 'Monitor' };
const agentDesc: Record<string, string> = {
  'Sophia CSM':    'Monitors 3 client inboxes, drafts warm SA responses, routes escalations',
  'Alex Outreach': 'Sends up to 300 cold emails/month with smart warm-up schedule',
  'System Monitor':'Heartbeat checks every 30 min, repo sync Tuesdays, cron management',
};

export default function Agents() {
  const [agents, setAgents]         = useState<Agent[]>([]);
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<Agent | null>(null);
  const [updating, setUpdating]     = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const ch1 = supabase.channel('ag1').on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, fetchData).subscribe();
    const ch2 = supabase.channel('ag2').on('postgres_changes', { event: '*', schema: 'public', table: 'task_queue' }, fetchData).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, []);

  const fetchData = async () => {
    const [aRes, tRes] = await Promise.all([
      supabase.from('agents').select('*').order('created_at'),
      supabase.from('task_queue').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (!aRes.error) setAgents(aRes.data || []);
    if (!tRes.error) setTasks(tRes.data || []);
    setLoading(false);
  };

  const updateStatus = async (agent: Agent, status: string) => {
    setUpdating(agent.id);
    try {
      await supabase.from('agents').update({ status, last_activity: new Date().toISOString() }).eq('id', agent.id);
      await supabase.from('audit_log').insert({ agent: agent.name, action: 'agent_status_changed', details: { from: agent.status, to: status }, status: 'success' });
      toast.success(`${agent.name} → ${status.toUpperCase()}`);
    } catch { toast.error('Failed to update'); }
    finally { setUpdating(null); }
  };

  const agTasks = (name: string) => tasks.filter(t => t.agent === name);

  const stats = [
    { label: 'Online', value: agents.filter(a => a.status==='online').length, active: true },
    { label: 'Idle',   value: agents.filter(a => a.status==='idle').length,   active: false },
    { label: 'Offline',value: agents.filter(a => !a.status || a.status==='offline').length, active: false },
    { label: 'Active Tasks', value: tasks.filter(t => t.status==='executing').length, active: true },
  ];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} style={card} className="p-5">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">{s.label}</p>
            <p className="text-3xl font-bold tabular-nums" style={{ color: s.active && s.value > 0 ? B : 'rgba(255,255,255,0.5)' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Agent cards */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: B, borderTopColor: 'transparent' }} /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {agents.map(agent => {
            const isOnline = agent.status === 'online';
            const isSelected = selected?.id === agent.id;
            const at = agTasks(agent.name);
            return (
              <div key={agent.id} onClick={() => setSelected(isSelected ? null : agent)}
                className="cursor-pointer transition-all p-5"
                style={{ ...card, borderColor: isSelected ? `${B}40` : 'rgba(255,255,255,0.06)', boxShadow: isSelected ? `0 0 0 1px ${B}20` : 'none' }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                      style={{ background: isOnline ? `${B}15` : 'rgba(255,255,255,0.04)', border: `1px solid ${isOnline ? `${B}30` : 'rgba(255,255,255,0.06)'}` }}>
                      <Bot className="h-5 w-5" style={{ color: isOnline ? B : 'rgba(255,255,255,0.3)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{agent.name}</p>
                      <p className="text-[11px] text-white/30">{roleLabels[agent.role] || agent.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full"
                      style={{ background: isOnline ? B : agent.status==='idle' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)', boxShadow: isOnline ? `0 0 5px ${B}` : 'none' }} />
                    <span className="text-[10px] uppercase font-medium"
                      style={{ color: isOnline ? B : agent.status==='idle' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)' }}>
                      {agent.status || 'offline'}
                    </span>
                  </div>
                </div>

                {agentDesc[agent.name] && <p className="text-[11px] text-white/30 leading-relaxed mb-3">{agentDesc[agent.name]}</p>}

                <div className="mb-3 border-t border-white/5 pt-3">
                  <p className="text-[10px] text-white/20 uppercase tracking-widest mb-0.5">Current task</p>
                  <p className="text-xs text-white/50 truncate">{agent.current_task || 'No active task'}</p>
                </div>

                <div className="grid grid-cols-3 gap-1.5 mb-3 text-center">
                  {[['Active', at.filter(t => t.status==='executing').length],['Queued', at.filter(t => t.status==='queued').length],['Done', at.filter(t => t.status==='completed').length]].map(([l, v]: any) => (
                    <div key={l} className="rounded-xl py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-[9px] text-white/20 uppercase">{l}</p>
                      <p className="text-sm font-bold" style={{ color: v > 0 ? B : 'rgba(255,255,255,0.3)' }}>{v}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                  {[['Start','online'],['Pause','idle'],['Restart','online']].map(([label, status]) => (
                    <button key={label} disabled={updating === agent.id || (label==='Start' && agent.status==='online') || (label==='Pause' && agent.status==='idle')}
                      onClick={() => updateStatus(agent, status)}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all disabled:opacity-25"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task history for selected agent */}
      {selected && (
        <div style={{ background: '#111', border: `1px solid ${B}25`, borderRadius: '20px' }} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4" style={{ color: B }} />
              <p className="text-sm font-semibold text-white">{selected.name} — Task History</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-white/25 hover:text-white/50"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-1 max-h-64 overflow-auto">
            {agTasks(selected.name).length === 0 ? (
              <p className="text-xs text-white/20 py-4 text-center">No tasks yet</p>
            ) : (
              agTasks(selected.name).map(task => {
                const done = task.status==='completed', exec=task.status==='executing', fail=task.status==='failed';
                return (
                  <div key={task.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ background: exec ? B : done ? `${B}60` : 'rgba(255,255,255,0.15)', boxShadow: exec ? `0 0 5px ${B}` : 'none' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/60 truncate">{task.task_type}</p>
                      <p className="text-[10px] text-white/20">{task.created_at ? new Date(task.created_at).toLocaleString() : ''}</p>
                    </div>
                    <span className="text-[9px] font-medium px-2 py-0.5 rounded-lg"
                      style={exec ? { background:`${B}20`, color:B } : done ? { background:`${B}10`, color:`${B}80` } : { background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.3)' }}>
                      {task.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
