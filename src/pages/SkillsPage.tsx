import React, { useState } from 'react';
import {
  Zap, MessageSquare, Brain, Mail, Calendar, BarChart3,
  Search, Users, FileText, Mic, Globe, Database,
  TrendingUp, Clock, Bell, Shield, ChevronRight, Bot,
} from 'lucide-react';

const B = '#4B9EFF';

const CARD: React.CSSProperties = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '16px',
  boxShadow: 'var(--s-card-shadow)',
};

type SkillStatus = 'active' | 'beta' | 'idle';

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  status: SkillStatus;
  icon: React.ElementType;
  color: string;
  trigger?: string;
  details?: string[];
}

const SKILLS: Skill[] = [
  // ── Intelligence ─────────────────────────────
  {
    id: 'morning-brief',
    name: 'Morning Brief',
    category: 'Intelligence',
    status: 'active',
    icon: Brain,
    color: '#f59e0b',
    description: 'Daily AI-synthesised briefing delivered to Telegram at 7am — news, SWOT, client intel, content ideas.',
    trigger: 'Daily 07:00 SAST',
    details: ['GPT-4o-mini news + SWOT sub-tasks', 'GPT-5.2 final synthesis', 'OpenAI TTS nova voice', 'Telegram audio + text delivery'],
  },
  {
    id: 'meet-intel',
    name: 'Meeting Intelligence',
    category: 'Intelligence',
    status: 'active',
    icon: Mic,
    color: '#a78bfa',
    description: 'Watches Gemini Notes emails, fetches full transcript from Drive, runs Claude Opus analysis, sends Telegram debrief.',
    trigger: 'Every 15 min',
    details: ['Google Drive transcript fetch', 'Claude Opus analysis', 'Telegram debrief card', 'Creates research tasks automatically'],
  },
  {
    id: 'research-digest',
    name: 'Research Digest',
    category: 'Intelligence',
    status: 'active',
    icon: Search,
    color: '#60a5fa',
    description: 'Two-pass research pipeline: drops articles/URLs into queue → extracts intel → identifies gaps → creates implementation tasks.',
    trigger: 'Every 30 min',
    details: ['Claude Sonnet extraction', 'Gap identification', 'Auto-creates tasks in Supabase', 'Feeds task worker pipeline'],
  },
  {
    id: 'weekly-report',
    name: 'Weekly Report',
    category: 'Intelligence',
    status: 'active',
    icon: BarChart3,
    color: '#4ade80',
    description: 'Comprehensive weekly performance report across all clients — o3 second opinion + GPT-5.2 synthesis.',
    trigger: 'Tuesdays 09:30 SAST',
    details: ['Per-client activity summary', 'Revenue + pipeline metrics', 'o3 second opinion', 'GPT-5.2 final write'],
  },

  // ── Communication ─────────────────────────────
  {
    id: 'telegram-gateway',
    name: 'Telegram Gateway',
    category: 'Communication',
    status: 'active',
    icon: MessageSquare,
    color: '#38bdf8',
    description: 'Natural language interface for Josh via Telegram. Voice notes, commands, task creation, finance logging — all conversational.',
    trigger: 'Always on (KeepAlive)',
    details: [
      '/brief, /tasks, /clients, /log commands',
      'Deepgram nova-2 voice transcription',
      'Claude Sonnet conversational replies',
      'Afrikaans voice note support',
      'Finance NLU with confirm/cancel flow',
    ],
  },
  {
    id: 'sophia-csm',
    name: 'Sophia CSM',
    category: 'Communication',
    status: 'active',
    icon: Mail,
    color: '#fb7185',
    description: 'AI client success manager — proactive GPT-4o emails to active clients, Telegram escalations, approval queue.',
    trigger: 'Every 2 hours',
    details: ['GPT-4o client emails from sophia@amalfiai.com', 'Auto-send with 30-min hold window', 'Telegram escalation for edge cases', 'Sentiment tracking per client'],
  },
  {
    id: 'alex-outreach',
    name: 'Alex Outreach',
    category: 'Communication',
    status: 'active',
    icon: TrendingUp,
    color: '#4B9EFF',
    description: 'Cold outreach agent — GPT-4o personalised 3-step sequences from alex@amalfiai.com. Gmail warmup ramp.',
    trigger: 'Daily (capped by warmup)',
    details: ['Apollo + Hunter.io lead enrichment', 'GPT-4o personalised intro emails', 'Automated day-4 follow-up and day-9 breakup', 'Gmail warmup: 10→50/day over 5 weeks'],
  },

  // ── Automation ─────────────────────────────
  {
    id: 'task-worker',
    name: 'Autonomous Task Worker',
    category: 'Automation',
    status: 'active',
    icon: Zap,
    color: '#facc15',
    description: 'Picks up oldest todo task assigned to Claude every 10 min, implements with full Claude Code access, marks done.',
    trigger: 'Every 10 min',
    details: ['Claude Code --dangerously-skip-permissions', 'Repo routing (qms-guard, chrome-auto-care, favlog)', 'Reads client CONTEXT.md before implementing', 'Git commit + push on completion'],
  },
  {
    id: 'calendar-events',
    name: 'Calendar Events',
    category: 'Automation',
    status: 'active',
    icon: Calendar,
    color: '#34d399',
    description: 'Mission Control calendar — log events, set reminders, manage scheduling. Agent modal for quick event creation.',
    trigger: 'On-demand',
    details: ['Supabase events table', 'Real-time sync', 'Agent-powered quick add modal', 'Reminder push to Telegram'],
  },
  {
    id: 'error-monitor',
    name: 'Error Monitor',
    category: 'Automation',
    status: 'active',
    icon: Bell,
    color: '#f87171',
    description: 'Watches all *.err.log files every 10 min. Alerts Josh on Telegram if new errors detected.',
    trigger: 'Every 10 min',
    details: ['Scans all LaunchAgent error logs', 'Deduplication via seen-errors cache', 'Telegram alert with snippet', 'Zero-noise unless something breaks'],
  },
  {
    id: 'data-os-sync',
    name: 'Data OS Sync',
    category: 'Automation',
    status: 'active',
    icon: Database,
    color: '#818cf8',
    description: 'Nightly sync of all client data into Supabase — GitHub activity, task progress, financial snapshots.',
    trigger: 'Nightly 23:00 SAST',
    details: ['GitHub repo stats per client', 'Task completion metrics', 'Financial snapshot archiving', 'CURRENT_STATE.md regeneration'],
  },

  // ── Client OS ─────────────────────────────
  {
    id: 'race-technik-ai',
    name: 'Race Technik AI (Maya)',
    category: 'Client OS',
    status: 'active',
    icon: Bot,
    color: '#FF6B35',
    description: 'Dedicated AI instance on Race Technik Mac Mini — booking poller, payment tracker, supplier reorder, financial snapshots.',
    trigger: 'Always on',
    details: ['Maya persona (MiniMax TTS)', '@RaceTechnikAiBot Telegram', 'Booking + payment pollers every 5-10 min', 'Supplier auto-reorder emails', '21 LaunchAgents deployed'],
  },

  // ── Content & Media ─────────────────────────────
  {
    id: 'content-engine',
    name: 'Content Engine',
    category: 'Content',
    status: 'beta',
    icon: FileText,
    color: '#c084fc',
    description: 'AI content generation pipeline — social posts, LinkedIn thought leadership, pitch decks via Gamma API.',
    trigger: 'On-demand',
    details: ['GPT-4o-mini content drafts', 'Gamma API pitch decks (chimney-smoke theme)', 'PDF generation + Telegram delivery', 'Client approval flow'],
  },
  {
    id: 'voice-output',
    name: 'Voice Output (TTS)',
    category: 'Content',
    status: 'active',
    icon: Mic,
    color: '#f472b6',
    description: 'OpenAI TTS (nova voice) for all audio output. GPT-4o-mini speech optimisation pass before synthesis.',
    trigger: 'On-demand',
    details: ['tts-1-hd model, nova voice', 'Speech rewrite pass (gpt-4o-mini)', 'Outputs .opus for Telegram voice', 'MiniMax as fallback'],
  },

  // ── Research & Data ─────────────────────────────
  {
    id: 'flight-search',
    name: 'Flight Search',
    category: 'Research',
    status: 'active',
    icon: Globe,
    color: '#22d3ee',
    description: 'Smart flight search via Telegram. Handles FlySafair direct API and Lift via headless Chrome. City alias NLP.',
    trigger: '/flight command',
    details: ['FlySafair direct API (no browser)', 'Lift via Chrome + Imperva WAF bypass', 'City alias NLP (jozi, PE, etc.)', 'Multi-passenger support'],
  },
  {
    id: 'vanta-security',
    name: 'Vanta Security Monitor',
    category: 'Research',
    status: 'idle',
    icon: Shield,
    color: '#6366f1',
    description: 'Vanta compliance monitoring dashboard — tracks security posture, open findings, and control status.',
    trigger: 'On-demand',
    details: ['Vanta API integration', 'Security findings tracker', 'Compliance score monitoring'],
  },
  {
    id: 'memory-writer',
    name: 'Memory Writer',
    category: 'Intelligence',
    status: 'active',
    icon: Brain,
    color: '#94a3b8',
    description: 'Claude Haiku processes interaction logs and updates user_models + agent_memory tables in Supabase.',
    trigger: 'Nightly',
    details: ['Haiku (cheap + fast)', 'interaction_log → user_models', 'Semantic memory organisation', 'Cross-session context persistence'],
  },
];

const CATEGORIES = ['All', ...Array.from(new Set(SKILLS.map(s => s.category)))];

const STATUS_META: Record<SkillStatus, { label: string; color: string; dot: string }> = {
  active: { label: 'Active', color: '#4ade80', dot: '#4ade80' },
  beta:   { label: 'Beta',   color: '#facc15', dot: '#facc15' },
  idle:   { label: 'Idle',   color: '#94a3b8', dot: '#94a3b8' },
};

function SkillCard({ skill }: { skill: Skill }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = skill.icon;
  const status = STATUS_META[skill.status];

  return (
    <div
      style={{ ...CARD, cursor: 'pointer' }}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${skill.color}18`, border: `1px solid ${skill.color}30` }}
          >
            <Icon className="h-4 w-4" style={{ color: skill.color }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-bold truncate" style={{ color: 'var(--tc-88)' }}>{skill.name}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--tc-35)' }}>{skill.category}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                <span
                  className="flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: `${status.color}15`, color: status.color, border: `1px solid ${status.color}30` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot, boxShadow: skill.status === 'active' ? `0 0 4px ${status.dot}` : 'none' }} />
                  {status.label}
                </span>
                <ChevronRight
                  className="h-3.5 w-3.5 transition-transform"
                  style={{ color: 'var(--tc-25)', transform: expanded ? 'rotate(90deg)' : undefined }}
                />
              </div>
            </div>

            <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--tc-50)' }}>
              {skill.description}
            </p>

            {skill.trigger && (
              <div className="flex items-center gap-1.5 mt-2">
                <Clock className="h-3 w-3 shrink-0" style={{ color: 'var(--tc-25)' }} />
                <span className="text-[10px]" style={{ color: 'var(--tc-35)' }}>{skill.trigger}</span>
              </div>
            )}
          </div>
        </div>

        {/* Expanded details */}
        {expanded && skill.details && skill.details.length > 0 && (
          <div className="mt-3 ml-13 pl-1" style={{ borderTop: '1px solid var(--s-divider)', paddingTop: '12px' }}>
            <ul className="space-y-1.5">
              {skill.details.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px]" style={{ color: 'var(--tc-45)' }}>
                  <span className="shrink-0 mt-0.5" style={{ color: skill.color }}>·</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SkillsPage() {
  const [cat, setCat] = useState('All');

  const activeCount = SKILLS.filter(s => s.status === 'active').length;
  const betaCount   = SKILLS.filter(s => s.status === 'beta').length;

  const filtered = cat === 'All' ? SKILLS : SKILLS.filter(s => s.category === cat);

  return (
    <div className="space-y-5 pb-24 sm:pb-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--tc-85)' }}>Skills</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--tc-35)' }}>
            {activeCount} active · {betaCount} beta · {SKILLS.length} total
          </p>
        </div>
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center"
          style={{ background: `${B}12`, border: `1px solid ${B}25` }}
        >
          <Zap className="h-5 w-5" style={{ color: B }} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Active',  value: activeCount,                             color: '#4ade80' },
          { label: 'Beta',    value: betaCount,                               color: '#facc15' },
          { label: 'Total',   value: SKILLS.length,                           color: 'var(--tc-65)' },
        ].map(s => (
          <div key={s.label} style={CARD} className="flex flex-col items-center py-3 gap-0.5">
            <span className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</span>
            <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--tc-30)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className="text-[10px] font-medium px-3 py-1.5 rounded-full transition-all"
            style={cat === c
              ? { background: `${B}18`, border: `1px solid ${B}45`, color: B }
              : { background: 'var(--s-hover)', border: '1px solid var(--s-pill-b)', color: 'var(--tc-40)' }}
          >
            {c}
            {c !== 'All' && (
              <span className="ml-1 opacity-60">
                ({SKILLS.filter(s => s.category === c).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Skills grid */}
      <div className="space-y-2">
        {filtered.map(skill => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
      </div>

    </div>
  );
}
