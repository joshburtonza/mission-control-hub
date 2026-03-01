import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Plus, RefreshCw, Building2, ChevronRight, X, Search,
  Mail, Globe, Tag, TrendingUp, Users, MessageSquare, Star,
  Send, Clock, CheckCheck, CalendarCheck, Trash2, Linkedin,
  MapPin, Briefcase, BarChart2, ChevronDown, ArrowUpDown,
  ArrowUp, ArrowDown, Filter,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

interface OutreachLog {
  id: string;
  lead_id: string;
  step: number;
  subject: string;
  body: string;
  sent_at: string;
  gmail_message_id: string | null;
}

interface Lead {
  id: string;
  client_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string;
  title: string | null;
  linkedin_url: string | null;
  apollo_id: string | null;
  company: string | null;
  website: string | null;
  industry: string | null;
  employee_count: number | null;
  location_city: string | null;
  location_country: string | null;
  quality_score: number;
  enriched_at: string | null;
  linkedin_status: string | null;
  source: string | null;
  status: string;
  email_status: string | null;
  last_contacted_at: string | null;
  reply_received_at: string | null;
  reply_sentiment: string | null;
  notes: string | null;
  assigned_to: string | null;
  tags: string[] | null;
  created_at: string;
}

type SortKey = 'quality_score' | 'last_contacted_at' | 'created_at' | 'company' | 'status';
type SortDir = 'asc' | 'desc';

// ── Constants ─────────────────────────────────────────────────────────────────

const B = '#4B9EFF';

const CARD: React.CSSProperties = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '16px',
  boxShadow: 'var(--s-card-shadow)',
};

const PIPELINE_STAGES = [
  { key: 'new',               label: 'New',         active: false },
  { key: 'contacted',         label: 'Contacted',   active: true  },
  { key: 'sequence_complete', label: 'Seq. Done',   active: true  },
  { key: 'replied',           label: 'Replied',     active: true  },
  { key: 'qualified',         label: 'Qualified',   active: true  },
  { key: 'proposal',          label: 'Proposal',    active: true  },
  { key: 'closed_won',        label: 'Won',         active: true  },
  { key: 'closed_lost',       label: 'Lost',        active: false },
];

const SOURCE_LABELS: Record<string, string> = {
  manual:    'Manual',
  telegram:  'Telegram',
  tiktok:    'TikTok',
  referral:  'Referral',
  cold_list: 'Google Places',
  linkedin:  'LinkedIn',
  apollo:    'Apollo',
};

const VIEWS = ['Pipeline', 'By Industry', 'By Source', 'Sent'] as const;
type View = typeof VIEWS[number];

const STEP_META: Record<number, { label: string; color: string }> = {
  1: { label: 'Intro',      color: B },
  2: { label: 'Follow-up',  color: '#a78bfa' },
  3: { label: 'Breakup',    color: '#94a3b8' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeSince(ts: string | null) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function fullName(lead: Lead) {
  return [lead.first_name, lead.last_name].filter(Boolean).join(' ');
}

function initials(lead: Lead) {
  const f = lead.first_name?.[0] || '';
  const l = lead.last_name?.[0] || '';
  return (f + l).toUpperCase() || '?';
}

function locationStr(lead: Lead) {
  if (lead.location_city && lead.location_country) return `${lead.location_city}, ${lead.location_country}`;
  return lead.location_city || lead.location_country || null;
}

function empLabel(n: number | null) {
  if (!n) return null;
  if (n < 10)   return '1–9';
  if (n < 50)   return '10–49';
  if (n < 200)  return '50–199';
  if (n < 500)  return '200–499';
  if (n < 1000) return '500–999';
  return '1000+';
}

function scoreColor(score: number): string {
  if (score >= 70) return '#4ade80';
  if (score >= 50) return B;
  if (score >= 30) return '#facc15';
  return '#f87171';
}

function scoreBg(score: number): string {
  const c = scoreColor(score);
  return `${c}18`;
}

function countryFlag(country: string | null): string {
  if (!country) return '';
  const map: Record<string, string> = {
    'South Africa': '🇿🇦', 'United Kingdom': '🇬🇧', 'United States': '🇺🇸',
    'Australia': '🇦🇺', 'Canada': '🇨🇦', 'Germany': '🇩🇪',
    'Netherlands': '🇳🇱', 'France': '🇫🇷', 'India': '🇮🇳',
  };
  return map[country] || '';
}

// ── ScoreBadge ────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <span
      className="text-[9px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
      style={{ background: scoreBg(score), color, border: `1px solid ${color}30` }}
    >
      {score}
    </span>
  );
}

// ── Email status dot ──────────────────────────────────────────────────────────

const EMAIL_STATUS_META: Record<string, { dot: string; label: string; title: string }> = {
  valid:       { dot: '#4ade80', label: 'verified',    title: 'Email verified valid' },
  catch_all:   { dot: '#facc15', label: 'catch-all',   title: 'Domain accepts all addresses' },
  unverified:  { dot: '#94a3b8', label: 'unverified',  title: 'MX exists, not deeply checked' },
  risky:       { dot: '#f87171', label: 'risky',       title: 'Marked risky — will not send' },
  invalid:     { dot: '#f87171', label: 'invalid',     title: 'Dead email — will not send' },
};

function EmailStatusDot({ status }: { status: string | null }) {
  if (!status) return null;
  const meta = EMAIL_STATUS_META[status];
  if (!meta) return null;
  return (
    <span title={meta.title} className="flex items-center gap-1 text-[9px]" style={{ color: meta.dot }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const stage = PIPELINE_STAGES.find(s => s.key === status);
  const isActive = stage?.active ?? false;
  return (
    <span
      className="text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{
        background: isActive ? `${B}12` : 'var(--s-hover)',
        color: isActive ? `${B}cc` : 'var(--tc-30)',
        border: `1px solid ${isActive ? `${B}30` : 'var(--s-pill-b)'}`,
      }}
    >
      {stage?.label || status}
    </span>
  );
}

// ── ClientSwitcher ────────────────────────────────────────────────────────────

function ClientSwitcher({
  clients,
  clientId,
  onChange,
}: {
  clients: Client[];
  clientId: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = clients.find(c => c.id === clientId);
  const label = current?.name || 'All Clients';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-8 px-3 rounded-full text-xs font-semibold transition-all"
        style={{ background: `${B}15`, border: `1px solid ${B}35`, color: B }}
      >
        <Building2 className="h-3.5 w-3.5" />
        {label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div
          className="absolute top-10 left-0 z-50 min-w-[160px] rounded-xl overflow-hidden"
          style={{ background: 'rgba(10,11,20,0.97)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(24px)' }}
        >
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors"
            style={{
              color: !clientId ? B : 'var(--tc-55)',
              background: !clientId ? `${B}12` : 'transparent',
            }}
          >
            All Clients
          </button>
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => { onChange(c.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors"
              style={{
                color: clientId === c.id ? B : 'var(--tc-55)',
                background: clientId === c.id ? `${B}12` : 'transparent',
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── StageFilterSidebar ────────────────────────────────────────────────────────

function StageFilterSidebar({
  leads,
  activeStage,
  activeSources,
  onStageChange,
  onSourceToggle,
}: {
  leads: Lead[];
  activeStage: string | null;
  activeSources: Set<string>;
  onStageChange: (stage: string | null) => void;
  onSourceToggle: (source: string) => void;
}) {
  const stageCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.status] = (c[l.status] || 0) + 1;
    return c;
  }, [leads]);

  const sources = useMemo(() => {
    const s = new Set<string>();
    for (const l of leads) if (l.source) s.add(l.source);
    return [...s].sort();
  }, [leads]);

  return (
    <div className="hidden lg:flex flex-col gap-4 w-48 shrink-0">
      {/* Stage filter */}
      <div style={CARD} className="p-3 space-y-1">
        <p className="text-[9px] uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--tc-30)' }}>Stage</p>
        <button
          onClick={() => onStageChange(null)}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] transition-all"
          style={!activeStage
            ? { background: `${B}15`, color: B, border: `1px solid ${B}30` }
            : { color: 'var(--tc-45)', border: '1px solid transparent' }}
        >
          <span>All</span>
          <span className="text-[10px] tabular-nums" style={{ color: !activeStage ? B : 'var(--tc-25)' }}>{leads.length}</span>
        </button>
        {PIPELINE_STAGES.filter(s => (stageCounts[s.key] || 0) > 0).map(stage => (
          <button
            key={stage.key}
            onClick={() => onStageChange(activeStage === stage.key ? null : stage.key)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] transition-all"
            style={activeStage === stage.key
              ? { background: `${B}15`, color: B, border: `1px solid ${B}30` }
              : { color: 'var(--tc-45)', border: '1px solid transparent' }}
          >
            <span>{stage.label}</span>
            <span className="text-[10px] tabular-nums" style={{ color: activeStage === stage.key ? B : 'var(--tc-25)' }}>
              {stageCounts[stage.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Source filter */}
      {sources.length > 0 && (
        <div style={CARD} className="p-3 space-y-1">
          <p className="text-[9px] uppercase tracking-widest mb-2 px-1" style={{ color: 'var(--tc-30)' }}>Source</p>
          {sources.map(src => {
            const checked = activeSources.size === 0 || activeSources.has(src);
            return (
              <button
                key={src}
                onClick={() => onSourceToggle(src)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] transition-all"
                style={{ color: checked ? 'var(--tc-65)' : 'var(--tc-30)', border: '1px solid transparent' }}
              >
                <span
                  className="w-3 h-3 rounded-sm border shrink-0 flex items-center justify-center"
                  style={{ background: checked ? `${B}20` : 'transparent', borderColor: checked ? B : 'var(--s-pill-b)' }}
                >
                  {checked && <span className="text-[7px] font-bold" style={{ color: B }}>✓</span>}
                </span>
                {SOURCE_LABELS[src] || src}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── StatsBar ──────────────────────────────────────────────────────────────────

function StatsBar({ leads }: { leads: Lead[] }) {
  const stats = useMemo(() => {
    const total     = leads.length;
    const contacted = leads.filter(l => l.last_contacted_at).length;
    const replied   = leads.filter(l => l.reply_received_at).length;
    const won       = leads.filter(l => l.status === 'closed_won').length;
    const replyRate = total > 0 ? Math.round((replied / total) * 100) : 0;
    return { total, contacted, replied, won, replyRate };
  }, [leads]);

  const items = [
    { label: 'Total',      value: stats.total,     glow: false },
    { label: 'Contacted',  value: stats.contacted,  glow: false },
    { label: 'Replied',    value: stats.replied,    glow: true  },
    { label: 'Won',        value: stats.won,        glow: true  },
    { label: 'Reply rate', value: `${stats.replyRate}%`, glow: stats.replyRate > 0 },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {items.map(s => (
        <div key={s.label} style={CARD} className="flex flex-col items-center justify-center py-3 px-2 gap-0.5">
          <span
            className="text-xl font-bold tabular-nums"
            style={{ color: s.glow ? B : 'var(--tc-85)', textShadow: s.glow ? `0 0 16px ${B}88` : 'none' }}
          >
            {s.value}
          </span>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--tc-30)' }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── SortButton ────────────────────────────────────────────────────────────────

function SortButton({ label, sortKey, current, dir, onClick }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      className="flex items-center gap-1 text-[10px] font-medium"
      style={{ color: active ? B : 'var(--tc-35)' }}
      onClick={() => onClick(sortKey)}
    >
      {label}
      {active ? (
        dir === 'desc' ? <ArrowDown className="h-2.5 w-2.5" /> : <ArrowUp className="h-2.5 w-2.5" />
      ) : (
        <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
      )}
    </button>
  );
}

// ── LeadTable ─────────────────────────────────────────────────────────────────

function LeadTable({
  leads,
  logSteps,
  onSelect,
  sortKey,
  sortDir,
  onSort,
}: {
  leads: Lead[];
  logSteps: Record<string, number[]>;
  onSelect: (lead: Lead) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  if (leads.length === 0) {
    return (
      <div style={{ ...CARD, borderRadius: '20px' }} className="flex flex-col items-center justify-center py-16 gap-3">
        <Users className="h-8 w-8" style={{ color: 'var(--tc-15)' }} />
        <p className="text-sm" style={{ color: 'var(--tc-25)' }}>No leads match this filter</p>
      </div>
    );
  }

  return (
    <div style={CARD} className="overflow-hidden">
      {/* Table header */}
      <div
        className="grid px-4 py-2 gap-3 text-[9px] uppercase tracking-widest border-b"
        style={{
          gridTemplateColumns: '32px 1fr 140px 100px 52px 80px 60px 20px',
          color: 'var(--tc-30)',
          borderColor: 'var(--s-divider)',
        }}
      >
        <div />
        <div className="flex items-center gap-3">
          Name
          <SortButton label="Company" sortKey="company" current={sortKey} dir={sortDir} onClick={onSort} />
        </div>
        <div>Location / Industry</div>
        <div className="flex items-center gap-2">
          <SortButton label="Score" sortKey="quality_score" current={sortKey} dir={sortDir} onClick={onSort} />
          <span className="opacity-40">·</span>
          <SortButton label="Stage" sortKey="status" current={sortKey} dir={sortDir} onClick={onSort} />
        </div>
        <div>Email</div>
        <div>
          <SortButton label="Last Touch" sortKey="last_contacted_at" current={sortKey} dir={sortDir} onClick={onSort} />
        </div>
        <div>Seq</div>
        <div />
      </div>

      {/* Rows */}
      <div className="divide-y" style={{ borderColor: 'var(--s-divider)' }}>
        {leads.map(lead => {
          const hasReply = !!lead.reply_received_at;
          const steps = logSteps[lead.id] || [];
          const loc = locationStr(lead);
          const flag = countryFlag(lead.location_country);

          return (
            <div
              key={lead.id}
              className="grid items-center px-4 py-2.5 gap-3 cursor-pointer transition-colors"
              style={{
                gridTemplateColumns: '32px 1fr 140px 100px 52px 80px 60px 20px',
                background: hasReply ? `${B}05` : 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--s-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = hasReply ? `${B}05` : 'transparent')}
              onClick={() => onSelect(lead)}
            >
              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                style={{ background: `${B}15`, border: `1px solid ${B}30`, color: B }}
              >
                {initials(lead)}
              </div>

              {/* Name + title + company */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--tc-85)' }}>{fullName(lead)}</span>
                  {hasReply && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: `${B}15`, color: B, border: `1px solid ${B}30` }}>
                      replied
                    </span>
                  )}
                  {(lead.email_status === 'invalid' || lead.email_status === 'risky') && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                      {lead.email_status}
                    </span>
                  )}
                </div>
                <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--tc-35)' }}>
                  {lead.title && <span>{lead.title} · </span>}
                  <span style={{ color: 'var(--tc-50)' }}>{lead.company || lead.email}</span>
                </p>
              </div>

              {/* Location + industry */}
              <div className="min-w-0 space-y-0.5">
                {loc && (
                  <p className="text-[10px] truncate" style={{ color: 'var(--tc-40)' }}>
                    {flag && <span className="mr-1">{flag}</span>}{loc}
                  </p>
                )}
                {lead.industry && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full inline-block max-w-full truncate"
                    style={{ background: `${B}10`, color: `${B}aa`, border: `1px solid ${B}20` }}
                  >
                    {lead.industry}
                  </span>
                )}
              </div>

              {/* Score + stage */}
              <div className="space-y-1 min-w-0">
                {lead.quality_score > 0 && <ScoreBadge score={lead.quality_score} />}
                <div><StatusPill status={lead.status} /></div>
              </div>

              {/* Email status */}
              <div>
                <EmailStatusDot status={lead.email_status} />
                {lead.email_status === 'valid' && (
                  <span className="w-1.5 h-1.5 rounded-full block mt-1" style={{ background: '#4ade80' }} title="verified" />
                )}
              </div>

              {/* Last touch */}
              <div className="text-[10px]" style={{ color: 'var(--tc-30)' }}>
                {timeSince(lead.last_contacted_at || lead.created_at)}
              </div>

              {/* Sequence dots */}
              <div className="flex items-center gap-0.5">
                {[1, 2, 3].map(s => {
                  const done = steps.includes(s);
                  const meta = STEP_META[s];
                  return (
                    <div
                      key={s}
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold"
                      title={meta.label}
                      style={{
                        background: done ? `${meta.color}20` : 'var(--s-hover)',
                        border: `1px solid ${done ? meta.color + '45' : 'var(--s-pill-b)'}`,
                        color: done ? meta.color : 'var(--tc-15)',
                      }}
                    >
                      {done ? '✓' : s}
                    </div>
                  );
                })}
              </div>

              {/* Chevron */}
              <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tc-20)' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── LeadDetailSheet ───────────────────────────────────────────────────────────

function LeadDetailSheet({
  lead,
  onClose,
  onStatusChange,
}: {
  lead: Lead;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [logs, setLogs] = useState<OutreachLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [introQueued, setIntroQueued] = useState(false);
  const [introSending, setIntroSending] = useState(false);
  const [notes, setNotes] = useState(lead.notes || '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  useEffect(() => {
    (supabase as any)
      .from('outreach_log')
      .select('*')
      .eq('lead_id', lead.id)
      .order('step', { ascending: true })
      .then(({ data }: any) => {
        setLogs(data || []);
        setLogsLoading(false);
      });
  }, [lead.id]);

  const stepsComplete = logs.length;

  const nextStepDue = useMemo(() => {
    if (!logs.length) return null;
    const last = logs[logs.length - 1];
    const daysSince = Math.floor((Date.now() - new Date(last.sent_at).getTime()) / 86400000);
    if (last.step === 1 && daysSince < 4) return { step: 2, daysLeft: 4 - daysSince };
    if (last.step === 2 && daysSince < 9) return { step: 3, daysLeft: 9 - daysSince };
    return null;
  }, [logs]);

  const handleSendIntro = async () => {
    setIntroSending(true);
    try {
      const { error } = await (supabase as any).from('task_queue').insert({
        task_type: 'sophia_outbound_intro',
        status: 'pending',
        agent: 'sophia',
        payload: { lead_id: lead.id, first_name: lead.first_name, email: lead.email },
      });
      if (error) throw error;
      setIntroQueued(true);
      toast.success('Intro email queued for ' + lead.first_name);
    } catch (e: any) {
      toast.error('Failed to queue intro: ' + (e?.message || 'unknown error'));
    } finally {
      setIntroSending(false);
    }
  };

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    await (supabase as any).from('leads').update({ notes }).eq('id', lead.id);
    setNotesSaving(false);
    toast.success('Notes saved');
  };

  const nextStatuses = PIPELINE_STAGES.map(s => s.key).filter(s => s !== lead.status);
  const loc = locationStr(lead);
  const flag = countryFlag(lead.location_country);
  const name = fullName(lead);

  const inputStyle: React.CSSProperties = {
    background: 'var(--s-input)',
    border: '1px solid var(--s-input-b)',
    color: 'var(--tc-80)',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-250"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col overflow-hidden"
        style={{
          width: '420px',
          background: 'rgba(8,9,18,0.95)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-24px 0 64px rgba(0,0,0,0.5)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Header */}
        <div className="p-5 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-base font-bold"
                style={{ background: `${B}18`, border: `2px solid ${B}35`, color: B }}
              >
                {initials(lead)}
              </div>
              <div>
                <h2 className="text-sm font-bold" style={{ color: 'var(--tc-90)' }}>{name}</h2>
                {lead.title && (
                  <p className="text-[11px]" style={{ color: 'var(--tc-50)' }}>{lead.title}</p>
                )}
                {lead.company && (
                  <p className="text-[11px]" style={{ color: 'var(--tc-40)' }}>{lead.company}</p>
                )}
              </div>
            </div>
            <button onClick={handleClose} style={{ color: 'var(--tc-30)' }}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick links */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <StatusPill status={lead.status} />
            {lead.linkedin_url && (
              <a
                href={lead.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-medium"
                style={{ background: '#0077B515', color: '#0077B5', border: '1px solid #0077B530' }}
                onClick={e => e.stopPropagation()}
              >
                <Linkedin className="h-3 w-3" />
                LinkedIn
              </a>
            )}
            {lead.website && (
              <a
                href={lead.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-medium"
                style={{ background: 'var(--s-hover)', color: 'var(--tc-45)', border: '1px solid var(--s-pill-b)' }}
                onClick={e => e.stopPropagation()}
              >
                <Globe className="h-3 w-3" />
                Website
              </a>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Enrichment card */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--tc-30)' }}>Enrichment</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
              {lead.industry && (
                <div>
                  <span style={{ color: 'var(--tc-30)' }}>Industry</span>
                  <p style={{ color: 'var(--tc-65)' }}>{lead.industry}</p>
                </div>
              )}
              {lead.employee_count != null && (
                <div>
                  <span style={{ color: 'var(--tc-30)' }}>Employees</span>
                  <p style={{ color: 'var(--tc-65)' }}>{empLabel(lead.employee_count)} ({lead.employee_count})</p>
                </div>
              )}
              {loc && (
                <div>
                  <span style={{ color: 'var(--tc-30)' }}>Location</span>
                  <p style={{ color: 'var(--tc-65)' }}>{flag} {loc}</p>
                </div>
              )}
              {lead.quality_score > 0 && (
                <div>
                  <span style={{ color: 'var(--tc-30)' }}>Score</span>
                  <div className="mt-0.5"><ScoreBadge score={lead.quality_score} /></div>
                </div>
              )}
              {lead.enriched_at && (
                <div className="col-span-2">
                  <span style={{ color: 'var(--tc-30)' }}>Enriched</span>
                  <p style={{ color: 'var(--tc-40)' }}>{timeSince(lead.enriched_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--tc-30)' }}>Contact</p>
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tc-30)' }} />
              <span className="text-[11px] truncate" style={{ color: 'var(--tc-65)' }}>{lead.email}</span>
              <EmailStatusDot status={lead.email_status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {lead.last_contacted_at && (
                <div style={{ color: 'var(--tc-35)' }}>
                  Last contact: <span style={{ color: 'var(--tc-60)' }}>{timeSince(lead.last_contacted_at)}</span>
                </div>
              )}
              {lead.reply_received_at && (
                <div style={{ color: 'var(--tc-35)' }}>
                  Replied: <span style={{ color: B }}>{timeSince(lead.reply_received_at)}</span>
                </div>
              )}
              {lead.reply_sentiment && (
                <div style={{ color: 'var(--tc-35)' }}>
                  Sentiment:{' '}
                  <span style={{ color: lead.reply_sentiment === 'positive' ? '#4ade80' : lead.reply_sentiment === 'negative' ? '#f87171' : 'var(--tc-60)' }}>
                    {lead.reply_sentiment}
                  </span>
                </div>
              )}
              <div style={{ color: 'var(--tc-35)' }}>
                Added: <span style={{ color: 'var(--tc-50)' }}>{timeSince(lead.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Outreach sequence */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Send className="h-3.5 w-3.5" style={{ color: B }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tc-50)' }}>
                  Outreach Sequence
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map(s => {
                  const done = logs.some(l => l.step === s);
                  const meta = STEP_META[s];
                  return (
                    <div
                      key={s}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                      title={meta.label}
                      style={{
                        background: done ? `${meta.color}20` : 'var(--s-hover)',
                        border: `1px solid ${done ? meta.color + '50' : 'var(--s-pill-b)'}`,
                        color: done ? meta.color : 'var(--tc-20)',
                      }}
                    >
                      {done ? '✓' : s}
                    </div>
                  );
                })}
              </div>
            </div>

            {logsLoading ? (
              <div className="flex items-center gap-2 py-2" style={{ color: 'var(--tc-25)' }}>
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span className="text-[11px]">Loading...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="rounded-xl py-4 px-4 flex flex-col items-center gap-3" style={{ border: '1px solid var(--s-divider)' }}>
                <p className="text-[11px]" style={{ color: 'var(--tc-25)' }}>No emails sent yet</p>
                {introQueued ? (
                  <div className="flex items-center gap-1.5" style={{ color: '#4ade80' }}>
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium">Intro email queued</span>
                  </div>
                ) : (
                  <button
                    onClick={handleSendIntro}
                    disabled={introSending}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-semibold transition-all"
                    style={{
                      background: introSending ? 'var(--s-hover)' : `${B}18`,
                      border: `1px solid ${B}35`,
                      color: introSending ? 'var(--tc-30)' : B,
                    }}
                  >
                    <CalendarCheck className="h-3.5 w-3.5" />
                    {introSending ? 'Queuing...' : 'Send Intro Email'}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map(log => {
                  const meta = STEP_META[log.step] || { label: `Step ${log.step}`, color: B };
                  const isExpanded = expandedLog === log.id;
                  const sentDate = new Date(log.sent_at);
                  const sentStr = sentDate.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })
                    + ' · ' + sentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={log.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${meta.color}25`, background: `${meta.color}06` }}>
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold"
                          style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }}
                        >
                          {log.step}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--tc-80)' }}>{log.subject}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-medium" style={{ color: meta.color }}>{meta.label}</span>
                            <span className="text-[9px]" style={{ color: 'var(--tc-25)' }}>{sentStr}</span>
                          </div>
                        </div>
                        <ChevronRight
                          className="h-3 w-3 shrink-0 transition-transform"
                          style={{ color: 'var(--tc-25)', transform: isExpanded ? 'rotate(90deg)' : undefined }}
                        />
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1" style={{ borderTop: `1px solid ${meta.color}18` }}>
                          <p className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--tc-50)' }}>
                            {log.body}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {nextStepDue && (
                  <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ border: '1px solid var(--s-divider)', background: 'var(--s-hover)' }}>
                    <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tc-30)' }} />
                    <p className="text-[11px]" style={{ color: 'var(--tc-35)' }}>
                      Step {nextStepDue.step} ({STEP_META[nextStepDue.step]?.label}) ready in{' '}
                      <span style={{ color: 'var(--tc-65)' }}>{nextStepDue.daysLeft}d</span>
                    </p>
                  </div>
                )}

                {stepsComplete === 3 && (
                  <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ border: '1px solid rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.05)' }}>
                    <CheckCheck className="h-3.5 w-3.5 shrink-0" style={{ color: '#4ade80' }} />
                    <p className="text-[11px]" style={{ color: '#4ade80' }}>Full 3-step sequence complete</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--tc-30)' }}>Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes..."
              className="w-full px-3 py-2.5 rounded-xl text-xs focus:outline-none resize-none"
              style={inputStyle}
            />
            {notes !== (lead.notes || '') && (
              <button
                onClick={handleSaveNotes}
                disabled={notesSaving}
                className="mt-1.5 text-[10px] px-3 py-1.5 rounded-lg font-semibold"
                style={{ background: `${B}18`, border: `1px solid ${B}35`, color: B }}
              >
                {notesSaving ? 'Saving…' : 'Save notes'}
              </button>
            )}
          </div>

          {/* Stage mover */}
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--tc-30)' }}>Move to stage</p>
            <div className="flex flex-wrap gap-1.5">
              {nextStatuses.map(s => {
                const stage = PIPELINE_STAGES.find(p => p.key === s);
                return (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(lead.id, s); handleClose(); }}
                    className="text-[10px] px-2.5 py-1 rounded-full transition-colors"
                    style={{ border: '1px solid var(--s-pill-b)', color: 'var(--tc-40)', background: 'var(--s-hover)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = B; (e.currentTarget as HTMLElement).style.borderColor = `${B}50`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--tc-40)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--s-pill-b)'; }}
                  >
                    {stage?.label || s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Add Lead Modal ────────────────────────────────────────────────────────────

function AddLeadModal({
  onClose,
  onAdded,
  clientId,
}: {
  onClose: () => void;
  onAdded: () => void;
  clientId: string | null;
}) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', company: '',
    website: '', source: 'manual', notes: '', industry: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.first_name || !form.email) {
      toast.error('First name and email are required');
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from('leads').insert({
      first_name: form.first_name.trim(),
      last_name:  form.last_name.trim() || null,
      email:      form.email.trim().toLowerCase(),
      company:    form.company.trim() || null,
      website:    form.website.trim() || null,
      source:     form.source,
      notes:      form.notes.trim() || null,
      industry:   form.industry.trim() || null,
      status:     'new',
      client_id:  clientId,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes('unique') ? 'Lead with this email already exists' : 'Failed to add lead');
      return;
    }
    toast.success('Lead added');
    onAdded();
    onClose();
  };

  const inputCls = 'w-full px-3 py-2 rounded-xl text-xs focus:outline-none transition-colors';
  const inputStyle: React.CSSProperties = {
    background: 'var(--s-input)',
    border: '1px solid var(--s-input-b)',
    color: 'var(--tc-80)',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md p-6 space-y-3 rounded-t-2xl sm:rounded-2xl"
        style={{ background: 'rgba(10,11,20,0.97)', backdropFilter: 'blur(32px)', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold" style={{ color: 'var(--tc-85)' }}>Add Lead</h2>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First name *" className={inputCls} style={inputStyle} />
          <input value={form.last_name}  onChange={e => set('last_name', e.target.value)}  placeholder="Last name"   className={inputCls} style={inputStyle} />
        </div>
        {[
          { k: 'email', placeholder: 'Email *', type: 'email' },
          { k: 'company', placeholder: 'Company' },
          { k: 'website', placeholder: 'Website' },
          { k: 'industry', placeholder: 'Industry / vertical' },
        ].map(({ k, placeholder, type }) => (
          <input
            key={k}
            type={type || 'text'}
            value={(form as any)[k]}
            onChange={e => set(k, e.target.value)}
            placeholder={placeholder}
            className={inputCls}
            style={inputStyle}
          />
        ))}
        <select value={form.source} onChange={e => set('source', e.target.value)} className={inputCls} style={inputStyle}>
          {Object.entries(SOURCE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className={inputCls + ' resize-none'}
          style={inputStyle}
        />
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-9 rounded-xl text-xs transition-colors" style={{ background: 'var(--s-hover)', border: '1px solid var(--s-card-b)', color: 'var(--tc-50)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 h-9 rounded-xl text-xs font-semibold transition-all" style={{ background: `${B}20`, border: `1px solid ${B}45`, color: B }}>
            {saving ? 'Saving…' : 'Add Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── IndustryGroup ─────────────────────────────────────────────────────────────

function IndustryGroup({ name, leads, onSelect }: {
  name: string; leads: Lead[]; onSelect: (lead: Lead) => void;
}) {
  const [open, setOpen] = useState(false);
  const replied   = leads.filter(l => l.reply_received_at).length;
  const qualified = leads.filter(l => ['qualified','proposal','closed_won'].includes(l.status)).length;

  return (
    <div style={CARD}>
      <button className="w-full flex items-center justify-between px-4 py-3 gap-3" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${B}12`, border: `1px solid ${B}25` }}>
            <Briefcase className="h-3.5 w-3.5" style={{ color: B }} />
          </div>
          <div className="text-left">
            <p className="text-[13px] font-semibold capitalize" style={{ color: 'var(--tc-85)' }}>{name}</p>
            <p className="text-[10px]" style={{ color: 'var(--tc-30)' }}>{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {replied > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${B}12`, color: `${B}cc`, border: `1px solid ${B}25` }}>
              {replied} replied
            </span>
          )}
          {qualified > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
              {qualified} qualified
            </span>
          )}
          <ChevronRight className="h-3.5 w-3.5 transition-transform" style={{ color: 'var(--tc-25)', transform: open ? 'rotate(90deg)' : undefined }} />
        </div>
      </button>
      {open && (
        <div className="pb-2 space-y-1" style={{ borderTop: '1px solid var(--s-divider)' }}>
          {leads.map(lead => (
            <div
              key={lead.id}
              className="flex items-center justify-between gap-3 px-4 py-2 cursor-pointer transition-colors"
              style={{ background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--s-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => onSelect(lead)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `${B}12` }}>
                  <span className="text-[9px] font-bold" style={{ color: B }}>{initials(lead)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium truncate" style={{ color: 'var(--tc-75)' }}>{fullName(lead)}</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--tc-30)' }}>
                    {lead.title && `${lead.title} · `}{lead.company || lead.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lead.quality_score > 0 && <ScoreBadge score={lead.quality_score} />}
                <StatusPill status={lead.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SourceGroup ───────────────────────────────────────────────────────────────

function SourceGroup({ source, leads, onSelect }: {
  source: string; leads: Lead[]; onSelect: (lead: Lead) => void;
}) {
  const [open, setOpen] = useState(false);
  const replied    = leads.filter(l => l.reply_received_at).length;
  const replyRate  = leads.length > 0 ? Math.round((replied / leads.length) * 100) : 0;

  return (
    <div style={CARD}>
      <button className="w-full flex items-center justify-between px-4 py-3 gap-3" onClick={() => setOpen(o => !o)}>
        <div className="text-left">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--tc-85)' }}>{SOURCE_LABELS[source] || source}</p>
          <p className="text-[10px]" style={{ color: 'var(--tc-30)' }}>{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[11px] font-semibold" style={{ color: replyRate > 20 ? '#4ade80' : 'var(--tc-45)' }}>{replyRate}%</p>
            <p className="text-[9px]" style={{ color: 'var(--tc-25)' }}>reply rate</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 transition-transform" style={{ color: 'var(--tc-25)', transform: open ? 'rotate(90deg)' : undefined }} />
        </div>
      </button>
      {open && (
        <div className="pb-2 space-y-1" style={{ borderTop: '1px solid var(--s-divider)' }}>
          {leads.map(lead => (
            <div
              key={lead.id}
              className="flex items-center justify-between gap-3 px-4 py-2 cursor-pointer"
              style={{ background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--s-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => onSelect(lead)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `${B}12` }}>
                  <span className="text-[9px] font-bold" style={{ color: B }}>{initials(lead)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium truncate" style={{ color: 'var(--tc-75)' }}>{fullName(lead)}</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--tc-30)' }}>{lead.company || lead.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lead.reply_received_at && <Mail className="h-3 w-3" style={{ color: B }} />}
                <StatusPill status={lead.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SentLogRow ────────────────────────────────────────────────────────────────

function SentLogRow({ log, lead, meta, dateStr, timeStr, onLeadClick }: {
  log: OutreachLog;
  lead: Lead | undefined;
  meta: { label: string; color: string };
  dateStr: string;
  timeStr: string;
  onLeadClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: 'var(--s-card)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${meta.color}20`, borderRadius: '14px', overflow: 'hidden' }}>
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => setExpanded(e => !e)}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}35` }}>
          {log.step}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--tc-85)' }}>{log.subject}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {lead ? (
              <span className="text-[10px] underline-offset-2 hover:underline cursor-pointer truncate" style={{ color: B }} onClick={e => { e.stopPropagation(); onLeadClick(); }}>
                {fullName(lead)}{lead.company ? ` · ${lead.company}` : ''}
              </span>
            ) : (
              <span className="text-[10px] font-mono" style={{ color: 'var(--tc-25)' }}>{log.lead_id.slice(0, 8)}…</span>
            )}
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${meta.color}12`, color: meta.color, border: `1px solid ${meta.color}25` }}>
              {meta.label}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px]" style={{ color: 'var(--tc-50)' }}>{dateStr}</p>
          <p className="text-[9px]" style={{ color: 'var(--tc-25)' }}>{timeStr}</p>
        </div>
        <ChevronRight className="h-3 w-3 shrink-0 transition-transform" style={{ color: 'var(--tc-20)', transform: expanded ? 'rotate(90deg)' : undefined }} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-2" style={{ borderTop: `1px solid ${meta.color}15` }}>
          <p className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--tc-55)' }}>{log.body}</p>
          {lead && (
            <span className="text-[10px]" style={{ color: 'var(--tc-30)' }}>
              To: <span style={{ color: 'var(--tc-50)' }}>{lead.email}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [clients, setClients]               = useState<Client[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(() => {
    try { return localStorage.getItem('crm_client_id') || null; } catch { return null; }
  });
  const [leads, setLeads]                   = useState<Lead[]>([]);
  const [logSteps, setLogSteps]             = useState<Record<string, number[]>>({});
  const [allLogs, setAllLogs]               = useState<OutreachLog[]>([]);
  const [loading, setLoading]               = useState(true);
  const [spinning, setSpinning]             = useState(false);
  const [view, setView]                     = useState<View>('Pipeline');
  const [activeStage, setActiveStage]       = useState<string | null>(null);
  const [activeSources, setActiveSources]   = useState<Set<string>>(new Set());
  const [search, setSearch]                 = useState('');
  const [showAddModal, setShowAddModal]     = useState(false);
  const [selectedLead, setSelectedLead]     = useState<Lead | null>(null);
  const [visibleCount, setVisibleCount]     = useState(50);
  const [sortKey, setSortKey]               = useState<SortKey>('created_at');
  const [sortDir, setSortDir]               = useState<SortDir>('desc');
  const [deletingInvalid, setDeletingInvalid] = useState(false);

  // Persist client selection
  const handleClientChange = (id: string | null) => {
    setActiveClientId(id);
    try { id ? localStorage.setItem('crm_client_id', id) : localStorage.removeItem('crm_client_id'); } catch {}
    setActiveStage(null);
    setSearch('');
    setVisibleCount(50);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleSourceToggle = (src: string) => {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return next;
    });
  };

  // Load clients table
  useEffect(() => {
    (supabase as any)
      .from('clients')
      .select('*')
      .order('name')
      .then(({ data }: any) => {
        if (data) setClients(data);
      });
  }, []);

  const fetchLeads = useCallback(async (spin = false) => {
    if (spin) setSpinning(true);
    const [leadsRes, logsRes] = await Promise.all([
      (supabase as any)
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000),
      (supabase as any)
        .from('outreach_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(5000),
    ]);
    if (!leadsRes.error) setLeads(leadsRes.data || []);
    if (!logsRes.error) {
      const logs: OutreachLog[] = logsRes.data || [];
      setAllLogs(logs);
      const map: Record<string, number[]> = {};
      for (const row of logs) {
        if (!map[row.lead_id]) map[row.lead_id] = [];
        map[row.lead_id].push(row.step);
      }
      setLogSteps(map);
    }
    setLoading(false);
    if (spin) setTimeout(() => setSpinning(false), 500);
  }, []);

  useEffect(() => {
    fetchLeads();
    const ch = (supabase as any)
      .channel('crm_leads_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchLeads())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outreach_log' }, () => fetchLeads())
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [fetchLeads]);

  const handleStatusChange = async (id: string, status: string) => {
    await (supabase as any).from('leads').update({ status }).eq('id', id);
    toast.success('Lead moved');
    fetchLeads();
  };

  const handleDeleteInvalid = async () => {
    const invalid = leads.filter(l => l.email_status === 'invalid' || l.email_status === 'risky');
    if (invalid.length === 0) { toast.info('No invalid/risky leads to delete'); return; }
    if (!confirm(`Delete ${invalid.length} invalid/risky leads? This cannot be undone.`)) return;
    setDeletingInvalid(true);
    const ids = invalid.map(l => l.id);
    const { error } = await (supabase as any).from('leads').delete().in('id', ids);
    setDeletingInvalid(false);
    if (error) { toast.error('Delete failed: ' + error.message); return; }
    toast.success(`Deleted ${invalid.length} invalid/risky leads`);
    fetchLeads();
  };

  // ── Client-filtered leads ───────────────────────────────────────────────────

  const clientLeads = useMemo(() => {
    if (!activeClientId) return leads;
    return leads.filter(l => l.client_id === activeClientId);
  }, [leads, activeClientId]);

  // ── Filtered + sorted leads (pipeline view) ────────────────────────────────

  const filteredLeads = useMemo(() => {
    let list = activeStage ? clientLeads.filter(l => l.status === activeStage) : clientLeads;
    if (activeSources.size > 0) {
      list = list.filter(l => activeSources.has(l.source || ''));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        fullName(l).toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.company || '').toLowerCase().includes(q) ||
        (l.industry || '').toLowerCase().includes(q) ||
        (l.title || '').toLowerCase().includes(q) ||
        (l.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    // Sort
    list = [...list].sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === 'quality_score') { av = a.quality_score; bv = b.quality_score; }
      else if (sortKey === 'last_contacted_at') { av = a.last_contacted_at || a.created_at; bv = b.last_contacted_at || b.created_at; }
      else if (sortKey === 'created_at') { av = a.created_at; bv = b.created_at; }
      else if (sortKey === 'company') { av = a.company || ''; bv = b.company || ''; }
      else if (sortKey === 'status') {
        const order = PIPELINE_STAGES.map(s => s.key);
        av = order.indexOf(a.status); bv = order.indexOf(b.status);
      }
      if (av === bv) return 0;
      if (sortDir === 'desc') return av > bv ? -1 : 1;
      return av < bv ? -1 : 1;
    });
    return list;
  }, [clientLeads, activeStage, activeSources, search, sortKey, sortDir]);

  useEffect(() => { setVisibleCount(50); }, [activeStage, search, activeClientId, activeSources]);

  const visibleLeads = useMemo(() => filteredLeads.slice(0, visibleCount), [filteredLeads, visibleCount]);

  const invalidCount = useMemo(() =>
    clientLeads.filter(l => l.email_status === 'invalid' || l.email_status === 'risky').length,
  [clientLeads]);

  // ── Industry groups (use industry column + tags fallback) ──────────────────

  const industryGroups = useMemo(() => {
    const groups: Record<string, Lead[]> = {};
    for (const lead of clientLeads) {
      const ind = lead.industry || (lead.tags && lead.tags.filter(t => !PIPELINE_STAGES.map(s => s.key).includes(t) && !Object.keys(SOURCE_LABELS).includes(t))[0]) || 'Untagged';
      groups[ind] = [...(groups[ind] || []), lead];
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [clientLeads]);

  // ── Source groups ──────────────────────────────────────────────────────────

  const sourceGroups = useMemo(() => {
    const groups: Record<string, Lead[]> = {};
    for (const lead of clientLeads) {
      const src = lead.source || 'unknown';
      groups[src] = [...(groups[src] || []), lead];
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [clientLeads]);

  const currentClientName = activeClientId
    ? (clients.find(c => c.id === activeClientId)?.name || 'CRM')
    : 'All Clients';

  return (
    <div className="space-y-4 pb-24 sm:pb-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <ClientSwitcher clients={clients} clientId={activeClientId} onChange={handleClientChange} />
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--tc-85)' }}>Alex CRM</h1>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--tc-35)' }}>
              {currentClientName} · {clientLeads.length} leads
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {invalidCount > 0 && (
            <button
              onClick={handleDeleteInvalid}
              disabled={deletingInvalid}
              title={`Delete ${invalidCount} invalid/risky leads`}
              className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold transition-all"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
            >
              <Trash2 className="h-3 w-3" />
              <span className="hidden sm:inline">{invalidCount} invalid</span>
            </button>
          )}
          <button
            onClick={() => fetchLeads(true)}
            className="h-8 w-8 flex items-center justify-center rounded-full transition-all"
            style={{ background: 'var(--s-hover)', border: '1px solid var(--s-pill-b)', color: 'var(--tc-40)' }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-full text-xs font-semibold transition-all"
            style={{ background: `${B}18`, border: `1px solid ${B}40`, color: B }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add Lead</span>
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <StatsBar leads={clientLeads} />

      {/* ── View tabs ── */}
      <div style={CARD} className="flex items-center gap-1 p-1.5">
        {VIEWS.map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="flex-1 py-2 text-[11px] font-medium rounded-xl transition-all"
            style={view === v
              ? { background: `${B}18`, color: B, border: `1px solid ${B}35` }
              : { color: 'var(--tc-40)', border: '1px solid transparent' }}
          >
            {v}
          </button>
        ))}
      </div>

      {/* ── Pipeline view ── */}
      {view === 'Pipeline' && (
        <div className="flex gap-4">
          {/* Left sidebar */}
          <StageFilterSidebar
            leads={clientLeads}
            activeStage={activeStage}
            activeSources={activeSources}
            onStageChange={setActiveStage}
            onSourceToggle={handleSourceToggle}
          />

          {/* Main table area */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--tc-30)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, company, industry…"
                className="w-full pl-8 pr-3 py-2 rounded-xl text-xs focus:outline-none"
                style={{ background: 'var(--s-input)', border: '1px solid var(--s-input-b)', color: 'var(--tc-80)' }}
              />
            </div>

            {/* Mobile stage filter pills */}
            <div className="flex lg:hidden gap-1.5 flex-wrap">
              <button
                onClick={() => setActiveStage(null)}
                className="text-[10px] font-medium px-3 py-1.5 rounded-full transition-all"
                style={!activeStage ? { background: `${B}18`, border: `1px solid ${B}45`, color: B } : { background: 'var(--s-hover)', border: '1px solid var(--s-pill-b)', color: 'var(--tc-40)' }}
              >
                All ({clientLeads.length})
              </button>
              {PIPELINE_STAGES.filter(s => clientLeads.some(l => l.status === s.key)).map(stage => {
                const count = clientLeads.filter(l => l.status === stage.key).length;
                return (
                  <button
                    key={stage.key}
                    onClick={() => setActiveStage(activeStage === stage.key ? null : stage.key)}
                    className="text-[10px] font-medium px-3 py-1.5 rounded-full transition-all"
                    style={activeStage === stage.key ? { background: `${B}18`, border: `1px solid ${B}45`, color: B } : { background: 'var(--s-hover)', border: '1px solid var(--s-pill-b)', color: 'var(--tc-40)' }}
                  >
                    {stage.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Lead table or empty */}
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2" style={{ color: 'var(--tc-25)' }}>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            ) : (
              <>
                <LeadTable
                  leads={visibleLeads}
                  logSteps={logSteps}
                  onSelect={setSelectedLead}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />

                {/* Load more */}
                <div className="flex items-center justify-between pt-1 pb-2">
                  <span className="text-[10px]" style={{ color: 'var(--tc-25)' }}>
                    Showing {Math.min(visibleCount, filteredLeads.length)} of {filteredLeads.length} leads
                  </span>
                  {visibleCount < filteredLeads.length && (
                    <button
                      onClick={() => setVisibleCount(c => c + 50)}
                      className="text-[10px] font-semibold px-3 py-1.5 rounded-full transition-all"
                      style={{ background: `${B}12`, border: `1px solid ${B}30`, color: B }}
                    >
                      Load 50 more
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── By Industry view ── */}
      {view === 'By Industry' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2" style={{ color: 'var(--tc-25)' }}>
              <RefreshCw className="h-4 w-4 animate-spin" />
            </div>
          ) : industryGroups.length === 0 ? (
            <div style={{ ...CARD, borderRadius: '20px' }} className="flex flex-col items-center justify-center py-16 gap-3">
              <Tag className="h-8 w-8" style={{ color: 'var(--tc-15)' }} />
              <p className="text-sm" style={{ color: 'var(--tc-25)' }}>No leads yet</p>
            </div>
          ) : (
            industryGroups.map(([name, groupLeads]) => (
              <IndustryGroup key={name} name={name} leads={groupLeads} onSelect={setSelectedLead} />
            ))
          )}
        </div>
      )}

      {/* ── By Source view ── */}
      {view === 'By Source' && (
        <div className="space-y-3">
          {sourceGroups.length > 0 && (
            <div style={CARD} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4" style={{ color: B }} />
                <span className="text-[11px] font-semibold" style={{ color: 'var(--tc-65)' }}>Reply rate by source</span>
              </div>
              <div className="space-y-2">
                {sourceGroups.map(([src, srcLeads]) => {
                  const replied = srcLeads.filter(l => l.reply_received_at).length;
                  const pct = srcLeads.length > 0 ? Math.round((replied / srcLeads.length) * 100) : 0;
                  return (
                    <div key={src} className="flex items-center gap-3">
                      <span className="text-[10px] w-24 shrink-0 text-right" style={{ color: 'var(--tc-35)' }}>{SOURCE_LABELS[src] || src}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--s-hover)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct > 20 ? '#4ade80' : B }} />
                      </div>
                      <span className="text-[11px] w-8 text-right font-semibold tabular-nums" style={{ color: pct > 20 ? '#4ade80' : 'var(--tc-40)' }}>{pct}%</span>
                      <span className="text-[10px] w-8 shrink-0" style={{ color: 'var(--tc-25)' }}>{srcLeads.length}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2" style={{ color: 'var(--tc-25)' }}>
              <RefreshCw className="h-4 w-4 animate-spin" />
            </div>
          ) : sourceGroups.length === 0 ? (
            <div style={{ ...CARD, borderRadius: '20px' }} className="flex flex-col items-center justify-center py-16 gap-3">
              <Star className="h-8 w-8" style={{ color: 'var(--tc-15)' }} />
              <p className="text-sm" style={{ color: 'var(--tc-25)' }}>No leads yet</p>
            </div>
          ) : (
            sourceGroups.map(([src, srcLeads]) => (
              <SourceGroup key={src} source={src} leads={srcLeads} onSelect={setSelectedLead} />
            ))
          )}
        </div>
      )}

      {/* ── Sent emails view ── */}
      {view === 'Sent' && (() => {
        const leadsById = Object.fromEntries(leads.map(l => [l.id, l]));
        return (
          <div className="space-y-2">
            <div style={CARD} className="px-4 py-3 flex items-center gap-4 flex-wrap">
              <Send className="h-4 w-4 shrink-0" style={{ color: B }} />
              <span className="text-[11px]" style={{ color: 'var(--tc-55)' }}>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--tc-85)' }}>{allLogs.length}</span> emails sent total
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: `${B}12`, color: `${B}cc`, border: `1px solid ${B}25` }}>
                {allLogs.filter(l => { const d = new Date(); d.setHours(0,0,0,0); return new Date(l.sent_at) >= d; }).length} today
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'var(--s-hover)', color: 'var(--tc-35)', border: '1px solid var(--s-pill-b)' }}>
                {allLogs.filter(l => { const d = new Date(); d.setDate(d.getDate()-7); return new Date(l.sent_at) >= d; }).length} this week
              </span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2" style={{ color: 'var(--tc-25)' }}>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            ) : allLogs.length === 0 ? (
              <div style={{ ...CARD, borderRadius: '20px' }} className="flex flex-col items-center justify-center py-16 gap-3">
                <Send className="h-8 w-8" style={{ color: 'var(--tc-15)' }} />
                <p className="text-sm" style={{ color: 'var(--tc-25)' }}>No emails sent yet</p>
              </div>
            ) : (
              allLogs.map(log => {
                const lead = leadsById[log.lead_id];
                const meta = STEP_META[log.step] || { label: `Step ${log.step}`, color: B };
                const sentDate = new Date(log.sent_at);
                const dateStr = sentDate.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: '2-digit' });
                const timeStr = sentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <SentLogRow
                    key={log.id}
                    log={log}
                    lead={lead}
                    meta={meta}
                    dateStr={dateStr}
                    timeStr={timeStr}
                    onLeadClick={() => lead && setSelectedLead(lead)}
                  />
                );
              })
            )}
          </div>
        );
      })()}

      {/* ── Modals / Sheet ── */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => fetchLeads()}
          clientId={activeClientId}
        />
      )}
      {selectedLead && (
        <LeadDetailSheet
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
