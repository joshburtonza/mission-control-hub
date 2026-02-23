import { Bot, Play, Pause, RotateCcw, Terminal } from "lucide-react";

const B = '#4B9EFF';

const glass = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '20px',
  boxShadow: 'var(--s-card-shadow)',
} as React.CSSProperties;

export type AgentStatus = "online" | "offline" | "error" | "idle";

interface AgentCardProps {
  name: string;
  status: AgentStatus;
  lastActivity: string;
  currentTask: string;
  type: string;
}

export function AgentCard({ name, status, lastActivity, currentTask, type }: AgentCardProps) {
  const isOnline  = status === 'online';
  const isIdle    = status === 'idle';
  const statusLabel = status.toUpperCase();

  return (
    <div style={glass} className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: isOnline ? `${B}15` : 'var(--s-hover)', border: `1px solid ${isOnline ? `${B}30` : 'var(--s-card-b)'}` }}>
            <Bot className="h-5 w-5" style={{ color: isOnline ? B : 'var(--tc-30)' }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/85">{name}</p>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">{type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full"
            style={{
              background: isOnline ? B : isIdle ? 'var(--tc-50)' : 'var(--tc-15)',
              boxShadow: isOnline ? `0 0 5px ${B}` : 'none',
            }} />
          <span className="text-[10px] font-medium tracking-wider"
            style={{ color: isOnline ? B : isIdle ? 'var(--tc-50)' : 'var(--tc-20)' }}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="space-y-3 border-t border-white/[0.05] pt-3">
        <div>
          <p className="text-[9px] text-white/25 uppercase tracking-widest mb-1">Current Task</p>
          <p className="text-xs text-white/55 truncate">{currentTask}</p>
        </div>
        <div>
          <p className="text-[9px] text-white/25 uppercase tracking-widest mb-1">Last Activity</p>
          <p className="text-xs text-white/40">{lastActivity}</p>
        </div>
      </div>

      <div className="flex gap-1.5 mt-3 pt-3 border-t border-white/[0.05]">
        {[
          { icon: <Play className="h-3 w-3" />, label: 'Start' },
          { icon: <Pause className="h-3 w-3" />, label: 'Pause' },
          { icon: <RotateCcw className="h-3 w-3" />, label: 'Restart' },
          { icon: <Terminal className="h-3 w-3" />, label: 'Logs' },
        ].map(btn => (
          <button key={btn.label}
            className="flex items-center gap-1 h-7 px-2 rounded-lg text-[10px] font-medium transition-all"
            style={{ background: 'var(--s-hover)', color: 'var(--tc-35)', border: '1px solid var(--s-card-b)' }}>
            {btn.icon} {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
