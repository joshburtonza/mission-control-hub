import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Plus, RefreshCw, Building2, ChevronRight, X, Search,
  Mail, Globe, Tag, TrendingUp, Users, MessageSquare, Star,
  Send, Clock, CheckCheck, CalendarCheck, Trash2, Linkedin,
  MapPin, Briefcase, BarChart2, ChevronDown, ArrowUpDown,
  ArrowUp, ArrowDown, Filter, Sparkles, AlertTriangle, Zap, Eye,
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
  tracking_id: string | null;
  opened_at: string | null;
  open_count: number;
}

interface AIAnalysis {
  score: number;
  headline: string;
  fit_summary: string;
  opportunities: string[];
  risks: string[];
  next_action: string;
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
  company_description: string | null;
  tech_stack: string[] | null;
  company_keywords: string[] | null;
  twitter_url: string | null;
  company_linkedin_url: string | null;
  annual_revenue: string | null;
  founded_year: number | null;
  seniority: string | null;
  departments: string[] | null;
  headline: string | null;
  // Migration 010
  logo_url: string | null;
  company_phone: string | null;
  alexa_ranking: number | null;
  facebook_url: string | null;
  angellist_url: string | null;
  dept_head_count: Record<string, number> | null;
  company_languages: string[] | null;
  market_cap: string | null;
  publicly_traded_symbol: string | null;
  publicly_traded_exchange: string | null;
  total_funding: string | null;
  latest_funding_stage: string | null;
  funding_events: Array<{ date: string; type: string; investors: string; amount: string | null; currency: string }> | null;
  photo_url: string | null;
  person_city: string | null;
  person_country: string | null;
  person_timezone: string | null;
  ai_analysis: AIAnalysis | null;
  ai_score: number | null;
  ai_analysed_at: string | null;
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

type SortKey = 'ai_score' | 'quality_score' | 'last_contacted_at' | 'created_at' | 'company' | 'status';
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

// Parse enrichment data from legacy notes blobs as fallback for pre-migration leads
function parseNotes(notes: string | null): {
  location?: string; industry?: string; employee_count?: number;
  linkedin_url?: string; apollo_id?: string; title?: string;
} {
  if (!notes) return {};
  const get = (key: string) => {
    const m = notes.match(new RegExp(`^${key}:\\s*(.+)$`, 'mi'));
    return m ? m[1].trim() : undefined;
  };
  const empRaw = get('Employees');
  return {
    location:       get('Location'),
    industry:       get('Industry'),
    employee_count: empRaw ? parseInt(empRaw, 10) || undefined : undefined,
    linkedin_url:   get('LinkedIn'),
    apollo_id:      get('Apollo ID'),
    title:          get('Title'),
  };
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

const SENIORITY_LABELS: Record<string, { label: string; color: string }> = {
  owner:    { label: 'Owner',    color: '#a78bfa' },
  founder:  { label: 'Founder',  color: '#a78bfa' },
  c_suite:  { label: 'C-Suite',  color: '#f472b6' },
  partner:  { label: 'Partner',  color: '#f472b6' },
  vp:       { label: 'VP',       color: '#fb923c' },
  head:     { label: 'Head',     color: '#fb923c' },
  director: { label: 'Director', color: '#facc15' },
  manager:  { label: 'Manager',  color: '#4B9EFF' },
  senior:   { label: 'Senior',   color: '#94a3b8' },
  entry:    { label: 'Entry',    color: '#64748b' },
};

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
  valid:       { dot: '#4ade80', label: 'verified',     title: 'Email verified — safe to send' },
  catch_all:   { dot: '#fb923c', label: 'catch-all',   title: 'High bounce risk — domain accepts all, cannot verify address' },
  unverified:  { dot: '#fb923c', label: 'unverified',  title: 'Not verified — do not send until confirmed' },
  no_domain:   { dot: '#f87171', label: 'no domain',   title: 'No valid domain — uncontactable' },
  risky:       { dot: '#f87171', label: 'risky',       title: 'Marked risky — will not send' },
  invalid:     { dot: '#f87171', label: 'invalid',     title: 'Dead email — will not send' },
};

const SAFE_TO_SEND = (s: string | null) => s === 'valid';
const IS_BOUNCE_RISK = (s: string | null) => s === 'catch_all' || s === 'unverified';
const IS_DEAD = (s: string | null) => s === 'invalid' || s === 'risky' || s === 'no_domain';

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

function OpenRateDonut({ pct }: { pct: number }) {
  const r   = 22;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  const color = pct >= 30 ? '#4ade80' : pct >= 15 ? B : '#f59e0b';
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" style={{ transform: 'rotate(-90deg)' }}>
      {/* Track */}
      <circle cx="30" cy="30" r={r} fill="none" stroke="var(--s-hover)" strokeWidth="6" />
      {/* Fill */}
      <circle
        cx="30" cy="30" r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}88)`, transition: 'stroke-dasharray 0.6s ease' }}
      />
      {/* Centre text — counter-rotate */}
      <text
        x="30" y="30"
        textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg) translateX(0)', fontSize: '11px', fontWeight: 700, fill: color, fontFamily: 'inherit' }}
        transform="rotate(90, 30, 30)"
      >
        {pct}%
      </text>
    </svg>
  );
}

function StatsBar({ leads, allLogs }: { leads: Lead[]; allLogs: OutreachLog[] }) {
  const stats = useMemo(() => {
    const total     = leads.length;
    const contacted = leads.filter(l => l.last_contacted_at).length;
    const replied   = leads.filter(l => l.reply_received_at).length;
    const won       = leads.filter(l => l.status === 'closed_won').length;
    const replyRate = total > 0 ? Math.round((replied / total) * 100) : 0;

    const trackedLogs = allLogs.filter(l => l.tracking_id);
    const openedLogs  = trackedLogs.filter(l => l.opened_at);
    const openRate    = trackedLogs.length > 0 ? Math.round((openedLogs.length / trackedLogs.length) * 100) : 0;

    return { total, contacted, replied, won, replyRate, openRate };
  }, [leads, allLogs]);

  const items = [
    { label: 'Total',      value: stats.total,     glow: false },
    { label: 'Contacted',  value: stats.contacted,  glow: false },
    { label: 'Replied',    value: stats.replied,    glow: true  },
    { label: 'Won',        value: stats.won,        glow: true  },
    { label: 'Reply rate', value: `${stats.replyRate}%`, glow: stats.replyRate > 0 },
  ];

  return (
    <div className="grid grid-cols-6 gap-2">
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
      {/* Open rate donut */}
      <div style={CARD} className="flex flex-col items-center justify-center py-3 px-2 gap-0.5">
        <OpenRateDonut pct={stats.openRate} />
        <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--tc-30)' }}>Open rate</span>
      </div>
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

// ── KanbanLeadCard ────────────────────────────────────────────────────────────

function KanbanLeadCard({ lead, logSteps, openedLeads, onSelect }: {
  lead: Lead;
  logSteps: Record<string, number[]>;
  openedLeads: Set<string>;
  onSelect: (lead: Lead) => void;
}) {
  const steps      = logSteps[lead.id] || [];
  const hasReply   = !!lead.reply_received_at;
  const hasOpened  = openedLeads.has(lead.id);
  const contacted  = !!lead.last_contacted_at;
  // Use notes-blob fallback for pre-migration leads
  const nb         = parseNotes(lead.notes);
  const effTitle   = lead.title          || nb.title;
  const effIndustry = lead.industry      || nb.industry;
  const effEmpCount = lead.employee_count != null ? lead.employee_count : nb.employee_count;
  const effLinkedin = lead.linkedin_url  || nb.linkedin_url;
  const effLoc      = locationStr(lead)  || nb.location;
  const effCountry  = lead.location_country || (nb.location?.split(', ').pop() ?? null);
  const flag        = countryFlag(effCountry);

  return (
    <div
      className="rounded-xl cursor-pointer transition-all"
      style={{
        background: hasReply ? `${B}08` : 'var(--s-card)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${hasReply ? `${B}35` : 'var(--s-card-b)'}`,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${B}45`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = hasReply ? `${B}35` : 'var(--s-card-b)'; }}
      onClick={() => onSelect(lead)}
    >
      <div className="p-3 space-y-2">

        {/* Name + score */}
        <div className="flex items-start gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
            style={{ background: `${B}15`, border: `1px solid ${B}30`, color: B }}
          >
            {initials(lead)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--tc-88)' }}>{fullName(lead)}</span>
              {lead.ai_score != null
                ? <ScoreBadge score={lead.ai_score} />
                : lead.quality_score > 0
                  ? <ScoreBadge score={lead.quality_score} />
                  : null
              }
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {effTitle && (
                <p className="text-[10px] truncate" style={{ color: 'var(--tc-40)' }}>{effTitle}</p>
              )}
              {lead.seniority && SENIORITY_LABELS[lead.seniority] && (
                <span
                  className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    background: `${SENIORITY_LABELS[lead.seniority].color}15`,
                    color: SENIORITY_LABELS[lead.seniority].color,
                    border: `1px solid ${SENIORITY_LABELS[lead.seniority].color}30`,
                  }}
                >
                  {SENIORITY_LABELS[lead.seniority].label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Company + size */}
        {(lead.company || effEmpCount != null) && (
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--tc-50)' }}>
            <Briefcase className="h-3 w-3 shrink-0" style={{ color: 'var(--tc-25)' }} />
            <span className="truncate font-medium">{lead.company}</span>
            {effEmpCount != null && (
              <span className="shrink-0" style={{ color: 'var(--tc-30)' }}>· {empLabel(effEmpCount)}</span>
            )}
          </div>
        )}

        {/* Industry */}
        {effIndustry && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full inline-block max-w-full truncate"
            style={{ background: `${B}10`, color: `${B}99`, border: `1px solid ${B}20` }}
          >
            {effIndustry}
          </span>
        )}

        {/* Location */}
        {effLoc && (
          <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--tc-35)' }}>
            <MapPin className="h-2.5 w-2.5 shrink-0" style={{ color: 'var(--tc-20)' }} />
            {flag && <span>{flag}</span>}
            <span className="truncate">{effLoc}</span>
          </div>
        )}

        {/* LinkedIn + Website */}
        {(effLinkedin || lead.website) && (
          <div className="flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
            {effLinkedin && (
              <a
                href={effLinkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: '#0077B512', color: '#0077B5', border: '1px solid #0077B528' }}
              >
                <Linkedin className="h-2.5 w-2.5" />LinkedIn
              </a>
            )}
            {lead.website && (
              <a
                href={lead.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--s-hover)', color: 'var(--tc-40)', border: '1px solid var(--s-pill-b)' }}
              >
                <Globe className="h-2.5 w-2.5" />
                {(() => { try { return new URL(lead.website).hostname.replace('www.', ''); } catch { return 'site'; } })()}
              </a>
            )}
          </div>
        )}

        {/* Email */}
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--tc-30)' }}>
          <Mail className="h-2.5 w-2.5 shrink-0" style={{ color: 'var(--tc-20)' }} />
          <span className="truncate" style={{ color: 'var(--tc-40)' }}>{lead.email}</span>
          {SAFE_TO_SEND(lead.email_status)    && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#4ade80' }} title="Verified" />}
          {IS_BOUNCE_RISK(lead.email_status)  && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#fb923c' }} title={EMAIL_STATUS_META[lead.email_status!]?.title} />}
          {IS_DEAD(lead.email_status)         && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#f87171' }} title={EMAIL_STATUS_META[lead.email_status!]?.title} />}
        </div>

        {/* Footer: contacted status + sequence dots */}
        <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--s-divider)' }}>
          <div className="flex items-center gap-1.5">
            {hasReply ? (
              <span className="text-[9px] font-semibold" style={{ color: '#4ade80' }}>✉ replied {timeSince(lead.reply_received_at)}</span>
            ) : contacted ? (
              <span className="text-[9px]" style={{ color: `${B}99` }}>✓ contacted {timeSince(lead.last_contacted_at)}</span>
            ) : (
              <span className="text-[9px]" style={{ color: 'var(--tc-20)' }}>not yet contacted</span>
            )}
            {hasOpened && contacted && (
              <span title="Opened email" style={{ display: 'flex', alignItems: 'center' }}>
                <Eye className="h-3 w-3" style={{ color: '#4ade80', filter: 'drop-shadow(0 0 4px #4ade8088)' }} />
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3].map(s => {
              const done = steps.includes(s);
              const meta = STEP_META[s];
              return (
                <div
                  key={s}
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold"
                  title={`${meta.label}${done ? ' ✓' : ''}`}
                  style={{
                    background: done ? `${meta.color}22` : 'var(--s-hover)',
                    border: `1px solid ${done ? meta.color + '50' : 'var(--s-pill-b)'}`,
                    color: done ? meta.color : 'var(--tc-15)',
                  }}
                >
                  {done ? '✓' : s}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── KanbanBoard ───────────────────────────────────────────────────────────────

function KanbanBoard({ leads, logSteps, openedLeads, onSelect, sortKey, sortDir }: {
  leads: Lead[];
  logSteps: Record<string, number[]>;
  openedLeads: Set<string>;
  onSelect: (lead: Lead) => void;
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  const byStage = useMemo(() => {
    const m: Record<string, Lead[]> = {};
    for (const s of PIPELINE_STAGES) m[s.key] = [];
    for (const l of leads) {
      if (m[l.status] !== undefined) m[l.status].push(l);
      else m['new'].push(l);
    }
    const mul = sortDir === 'desc' ? -1 : 1;
    for (const key of Object.keys(m)) {
      m[key].sort((a, b) => {
        // Replied leads always float to top regardless of sort
        if (!!a.reply_received_at !== !!b.reply_received_at) return a.reply_received_at ? -1 : 1;
        if (sortKey === 'ai_score') {
          return mul * ((b.ai_score ?? -1) - (a.ai_score ?? -1));
        }
        if (sortKey === 'quality_score') {
          return mul * ((b.quality_score ?? 0) - (a.quality_score ?? 0));
        }
        if (sortKey === 'last_contacted_at') {
          const ta = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
          const tb = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
          return mul * (tb - ta);
        }
        if (sortKey === 'company') {
          return mul * (a.company || '').localeCompare(b.company || '');
        }
        // default: created_at desc
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return m;
  }, [leads, sortKey, sortDir]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '500px' }}>
      {PIPELINE_STAGES.map(stage => {
        const col = byStage[stage.key] || [];
        return (
          <div key={stage.key} className="flex flex-col shrink-0" style={{ width: '272px' }}>
            {/* Column header */}
            <div
              className="flex items-center justify-between px-3 py-2 mb-2 rounded-xl sticky top-0"
              style={{
                background: stage.active ? `${B}12` : 'var(--s-hover)',
                border: `1px solid ${stage.active ? `${B}28` : 'var(--s-pill-b)'}`,
              }}
            >
              <span className="text-[11px] font-semibold" style={{ color: stage.active ? B : 'var(--tc-45)' }}>
                {stage.label}
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                style={{ background: stage.active ? `${B}20` : 'var(--s-card)', color: stage.active ? B : 'var(--tc-30)' }}
              >
                {col.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 overflow-y-auto pr-0.5" style={{ maxHeight: 'calc(100vh - 340px)' }}>
              {col.length === 0 ? (
                <div
                  className="text-[10px] text-center py-10"
                  style={{ color: 'var(--tc-15)', border: '1px dashed var(--s-divider)', borderRadius: '12px' }}
                >
                  —
                </div>
              ) : (
                col.map(lead => (
                  <KanbanLeadCard key={lead.id} lead={lead} logSteps={logSteps} openedLeads={openedLeads} onSelect={onSelect} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── LeadTable (kept for reference, unused) ────────────────────────────────────

function LeadTable({ leads, logSteps, onSelect }: {
  leads: Lead[];
  logSteps: Record<string, number[]>;
  onSelect: (lead: Lead) => void;
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
    <div className="space-y-2">
      {/* Sort toolbar */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--tc-25)' }}>Sort:</span>
        <SortButton label="Score"      sortKey="quality_score"      current={sortKey} dir={sortDir} onClick={onSort} />
        <SortButton label="Last Touch" sortKey="last_contacted_at"  current={sortKey} dir={sortDir} onClick={onSort} />
        <SortButton label="Company"    sortKey="company"            current={sortKey} dir={sortDir} onClick={onSort} />
        <SortButton label="Stage"      sortKey="status"             current={sortKey} dir={sortDir} onClick={onSort} />
        <SortButton label="Added"      sortKey="created_at"         current={sortKey} dir={sortDir} onClick={onSort} />
      </div>

      {/* Cards */}
      {leads.map(lead => {
        const hasReply    = !!lead.reply_received_at;
        const isContacted = !!lead.last_contacted_at;
        const steps       = logSteps[lead.id] || [];
        const stepsCount  = steps.length;
        const loc         = locationStr(lead);
        const flag        = countryFlag(lead.location_country);
        const isInvalid   = IS_DEAD(lead.email_status);
        const isBounceRisk = IS_BOUNCE_RISK(lead.email_status);

        return (
          <div
            key={lead.id}
            className="rounded-2xl cursor-pointer transition-all"
            style={{
              background: hasReply ? `${B}07` : 'var(--s-card)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${hasReply ? `${B}30` : 'var(--s-card-b)'}`,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${B}40`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = hasReply ? `${B}30` : 'var(--s-card-b)'; }}
            onClick={() => onSelect(lead)}
          >
            {/* ── Row 1: Identity + status + sequence ── */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                style={{ background: `${B}15`, border: `1px solid ${B}30`, color: B }}
              >
                {initials(lead)}
              </div>

              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--tc-88)' }}>{fullName(lead)}</span>
                  {hasReply && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: '#4ade8015', color: '#4ade80', border: '1px solid #4ade8035' }}>
                      ✉ replied
                    </span>
                  )}
                  {isContacted && !hasReply && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: `${B}12`, color: `${B}bb`, border: `1px solid ${B}28` }}>
                      ✓ contacted {timeSince(lead.last_contacted_at)}
                    </span>
                  )}
                  {!isContacted && lead.status === 'new' && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--s-hover)', color: 'var(--tc-25)', border: '1px solid var(--s-pill-b)' }}>
                      not yet contacted
                    </span>
                  )}
                  {isInvalid && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                      {lead.email_status}
                    </span>
                  )}
                  {isBounceRisk && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}>
                      bounce risk
                    </span>
                  )}
                </div>
                <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--tc-45)' }}>
                  {[lead.title, lead.company].filter(Boolean).join(' @ ')}
                </p>
              </div>

              {/* Right cluster: score + stage + seq */}
              <div className="flex items-center gap-2 shrink-0">
                {lead.quality_score > 0 && <ScoreBadge score={lead.quality_score} />}
                <StatusPill status={lead.status} />
                {/* Sequence dots */}
                <div className="flex items-center gap-0.5 ml-1">
                  {[1, 2, 3].map(s => {
                    const done = steps.includes(s);
                    const meta = STEP_META[s];
                    return (
                      <div
                        key={s}
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold"
                        title={`Step ${s}: ${meta.label}${done ? ' ✓ sent' : ''}`}
                        style={{
                          background: done ? `${meta.color}22` : 'var(--s-hover)',
                          border: `1px solid ${done ? meta.color + '50' : 'var(--s-pill-b)'}`,
                          color: done ? meta.color : 'var(--tc-15)',
                        }}
                      >
                        {done ? '✓' : s}
                      </div>
                    );
                  })}
                </div>
                <ChevronRight className="h-3.5 w-3.5 ml-1" style={{ color: 'var(--tc-20)' }} />
              </div>
            </div>

            {/* ── Row 2: Enrichment strip ── */}
            <div
              className="flex items-center gap-2 px-4 pb-3 flex-wrap"
              style={{ paddingLeft: '3.25rem' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Company size */}
              {lead.employee_count != null && (
                <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--tc-40)' }}>
                  <Users className="h-3 w-3 shrink-0" style={{ color: 'var(--tc-25)' }} />
                  {empLabel(lead.employee_count)}
                </span>
              )}

              {/* Industry */}
              {lead.industry && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full"
                  style={{ background: `${B}0e`, color: `${B}99`, border: `1px solid ${B}20` }}
                >
                  {lead.industry}
                </span>
              )}

              {/* Location */}
              {loc && (
                <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--tc-35)' }}>
                  <MapPin className="h-3 w-3 shrink-0" style={{ color: 'var(--tc-20)' }} />
                  {flag && <span>{flag}</span>}
                  {loc}
                </span>
              )}

              {/* Divider */}
              {(lead.linkedin_url || lead.website) && (loc || lead.industry || lead.employee_count != null) && (
                <span style={{ color: 'var(--tc-15)' }}>·</span>
              )}

              {/* LinkedIn */}
              {lead.linkedin_url && (
                <a
                  href={lead.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors"
                  style={{ background: '#0077B512', color: '#0077B5', border: '1px solid #0077B528' }}
                  title="View LinkedIn profile"
                >
                  <Linkedin className="h-2.5 w-2.5" />
                  LinkedIn
                </a>
              )}

              {/* Website */}
              {lead.website && (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors"
                  style={{ background: 'var(--s-hover)', color: 'var(--tc-40)', border: '1px solid var(--s-pill-b)' }}
                  title={lead.website}
                >
                  <Globe className="h-2.5 w-2.5" />
                  {(() => {
                    try { return new URL(lead.website).hostname.replace('www.', ''); } catch { return 'Website'; }
                  })()}
                </a>
              )}

              {/* Email + status */}
              <span className="flex items-center gap-1.5 text-[10px] ml-auto" style={{ color: 'var(--tc-30)' }}>
                <Mail className="h-2.5 w-2.5 shrink-0" style={{ color: 'var(--tc-20)' }} />
                <span className="truncate max-w-[160px]" style={{ color: 'var(--tc-40)' }}>{lead.email}</span>
                {SAFE_TO_SEND(lead.email_status) && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#4ade80' }} title="Email verified — safe to send" />
                )}
                {IS_BOUNCE_RISK(lead.email_status) && (
                  <span className="text-[8px] px-1 py-0.5 rounded font-semibold shrink-0" style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }} title={EMAIL_STATUS_META[lead.email_status!]?.title}>
                    bounce risk
                  </span>
                )}
                {IS_DEAD(lead.email_status) && (
                  <span className="text-[8px] px-1 py-0.5 rounded font-semibold shrink-0" style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }} title={EMAIL_STATUS_META[lead.email_status!]?.title}>
                    {lead.email_status}
                  </span>
                )}
                {/* Outreach summary */}
                {stepsCount > 0 && (
                  <span style={{ color: 'var(--tc-25)' }}>· {stepsCount}/3 emails sent</span>
                )}
                {/* Last touch time */}
                {isContacted && (
                  <span style={{ color: 'var(--tc-25)' }}>· {timeSince(lead.last_contacted_at)}</span>
                )}
              </span>
            </div>
          </div>
        );
      })}
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
  const [analysisQueued, setAnalysisQueued] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Auto-resize notes textarea to fit content
  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [notes]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  useEffect(() => {
    let cancelled = false;
    setLogsLoading(true);
    (supabase as any)
      .from('outreach_log')
      .select('*')
      .eq('lead_id', lead.id)
      .order('step', { ascending: true })
      .then(({ data }: any) => {
        if (!cancelled) {
          setLogs(data || []);
          setLogsLoading(false);
        }
      });
    return () => { cancelled = true; };
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

  const handleQueueAnalysis = async () => {
    try {
      const { error } = await (supabase as any).from('task_queue').insert({
        task_type: 'analyse_crm_lead',
        status: 'pending',
        agent: 'alex',
        payload: { lead_id: lead.id },
      });
      if (error) throw error;
      setAnalysisQueued(true);
      toast.success('Analysis queued — run analyse-leads.sh to process');
    } catch (e: any) {
      toast.error('Queue failed: ' + (e?.message || 'unknown'));
    }
  };

  const nextStatuses = PIPELINE_STAGES.map(s => s.key).filter(s => s !== lead.status);
  // Merge proper columns with notes-blob fallback for pre-migration leads
  const nb = parseNotes(lead.notes);
  const eff = {
    title:          lead.title          || nb.title,
    linkedin_url:   lead.linkedin_url   || nb.linkedin_url,
    industry:       lead.industry       || nb.industry,
    employee_count: lead.employee_count != null ? lead.employee_count : nb.employee_count,
    enriched_at:    lead.enriched_at,
    location:       locationStr(lead) || nb.location,
    location_country: lead.location_country,
    quality_score:  lead.quality_score,
  };
  const loc = eff.location;
  const flag = countryFlag(eff.location_country || (nb.location?.split(', ').pop() ?? null));
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
          background: 'var(--s-card)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderLeft: '1px solid var(--s-card-b)',
          boxShadow: '-24px 0 64px rgba(0,0,0,0.35)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Header */}
        <div className="p-5 border-b shrink-0" style={{ borderColor: 'var(--s-card-b)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Avatar — photo if available, else initials */}
              <div className="relative shrink-0">
                {lead.photo_url ? (
                  <img
                    src={lead.photo_url}
                    alt={name}
                    className="w-12 h-12 rounded-full object-cover"
                    style={{ border: `2px solid ${B}35` }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('style'); }}
                  />
                ) : null}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold"
                  style={{ background: `${B}18`, border: `2px solid ${B}35`, color: B, display: lead.photo_url ? 'none' : 'flex' }}
                >
                  {initials(lead)}
                </div>
                {/* Company logo badge */}
                {lead.logo_url && (
                  <img
                    src={lead.logo_url}
                    alt=""
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full object-cover bg-white"
                    style={{ border: '1px solid var(--s-card-b)' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
              <div>
                <h2 className="text-sm font-bold" style={{ color: 'var(--tc-90)' }}>{name}</h2>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  {eff.title && (
                    <p className="text-[11px]" style={{ color: 'var(--tc-50)' }}>{eff.title}</p>
                  )}
                  {lead.seniority && SENIORITY_LABELS[lead.seniority] && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: `${SENIORITY_LABELS[lead.seniority].color}15`,
                        color: SENIORITY_LABELS[lead.seniority].color,
                        border: `1px solid ${SENIORITY_LABELS[lead.seniority].color}30`,
                      }}
                    >
                      {SENIORITY_LABELS[lead.seniority].label}
                    </span>
                  )}
                </div>
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
            {eff.linkedin_url && (
              <a
                href={eff.linkedin_url}
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
              <a href={lead.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-medium"
                style={{ background: 'var(--s-hover)', color: 'var(--tc-45)', border: '1px solid var(--s-pill-b)' }}
                onClick={e => e.stopPropagation()}
              >
                <Globe className="h-3 w-3" />
                Website
              </a>
            )}
            {lead.twitter_url && (
              <a href={lead.twitter_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-medium"
                style={{ background: '#1DA1F215', color: '#1DA1F2', border: '1px solid #1DA1F230' }}
                onClick={e => e.stopPropagation()}
              >
                <span className="text-[10px] font-bold">𝕏</span>
                Twitter
              </a>
            )}
            {lead.company_linkedin_url && (
              <a href={lead.company_linkedin_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-medium"
                style={{ background: '#0077B508', color: '#0077B580', border: '1px solid #0077B520' }}
                onClick={e => e.stopPropagation()}
              >
                <Building2 className="h-3 w-3" />
                Company
              </a>
            )}
            {lead.facebook_url && (
              <a href={lead.facebook_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-medium"
                style={{ background: '#1877F215', color: '#1877F2', border: '1px solid #1877F230' }}
                onClick={e => e.stopPropagation()}
              >
                <span className="text-[10px] font-bold">f</span>
                Facebook
              </a>
            )}
            {lead.angellist_url && (
              <a href={lead.angellist_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-medium"
                style={{ background: 'rgba(0,0,0,0.08)', color: 'var(--tc-55)', border: '1px solid var(--s-pill-b)' }}
                onClick={e => e.stopPropagation()}
              >
                <span className="text-[10px]">✦</span>
                AngelList
              </a>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Enrichment card */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--s-hover)', border: '1px solid var(--s-card-b)' }}>
            <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--tc-30)' }}>Enrichment</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
              {eff.industry ? (
                <div>
                  <span style={{ color: 'var(--tc-30)' }}>Industry</span>
                  <p style={{ color: 'var(--tc-65)' }}>{eff.industry}</p>
                </div>
              ) : null}
              {eff.employee_count != null ? (
                <div>
                  <span style={{ color: 'var(--tc-30)' }}>Employees</span>
                  <p style={{ color: 'var(--tc-65)' }}>{empLabel(eff.employee_count)} ({eff.employee_count})</p>
                </div>
              ) : null}
              {loc ? (
                <div>
                  <span style={{ color: 'var(--tc-30)' }}>Location</span>
                  <p style={{ color: 'var(--tc-65)' }}>{flag} {loc}</p>
                </div>
              ) : null}
              {eff.quality_score > 0 ? (
                <div>
                  <span style={{ color: 'var(--tc-30)' }}>Score</span>
                  <div className="mt-0.5"><ScoreBadge score={eff.quality_score} /></div>
                </div>
              ) : null}
              {lead.person_city || lead.person_country ? (
                <div>
                  <span style={{ color: 'var(--tc-30)' }}>Person Location</span>
                  <p style={{ color: 'var(--tc-65)' }}>{[lead.person_city, lead.person_country].filter(Boolean).join(', ')}</p>
                </div>
              ) : null}
              {lead.person_timezone ? (
                <div>
                  <span style={{ color: 'var(--tc-30)' }}>Timezone</span>
                  <p style={{ color: 'var(--tc-65)' }}>{lead.person_timezone.replace('_', ' ')}</p>
                </div>
              ) : null}
              {eff.enriched_at ? (
                <div className="col-span-2">
                  <span style={{ color: 'var(--tc-30)' }}>Enriched</span>
                  <p style={{ color: 'var(--tc-40)' }}>{timeSince(eff.enriched_at)}</p>
                </div>
              ) : null}
              {!eff.industry && !eff.employee_count && !loc && !eff.quality_score ? (
                <div className="col-span-2">
                  <p style={{ color: 'var(--tc-25)' }}>No enrichment data yet</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Company Intel */}
          {(lead.company_description || lead.tech_stack?.length || lead.annual_revenue || lead.founded_year || lead.departments?.length ||
            lead.total_funding || lead.alexa_ranking || lead.publicly_traded_symbol || lead.dept_head_count || lead.company_phone) && (
            <div className="rounded-xl p-3 space-y-2.5" style={{ background: 'var(--s-hover)', border: '1px solid var(--s-card-b)' }}>
              <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--tc-30)' }}>Company Intel</p>

              {lead.company_description && (
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--tc-55)' }}>
                  {lead.company_description.length > 220
                    ? lead.company_description.slice(0, 220) + '…'
                    : lead.company_description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                {lead.annual_revenue && (
                  <div>
                    <span style={{ color: 'var(--tc-30)' }}>Revenue</span>
                    <p style={{ color: 'var(--tc-65)' }}>{lead.annual_revenue}</p>
                  </div>
                )}
                {lead.founded_year && (
                  <div>
                    <span style={{ color: 'var(--tc-30)' }}>Founded</span>
                    <p style={{ color: 'var(--tc-65)' }}>{lead.founded_year}</p>
                  </div>
                )}
                {lead.total_funding && (
                  <div>
                    <span style={{ color: 'var(--tc-30)' }}>Total Funding</span>
                    <p style={{ color: '#4ade80' }}>{lead.total_funding}</p>
                  </div>
                )}
                {lead.latest_funding_stage && (
                  <div>
                    <span style={{ color: 'var(--tc-30)' }}>Stage</span>
                    <p style={{ color: 'var(--tc-65)' }}>{lead.latest_funding_stage}</p>
                  </div>
                )}
                {lead.alexa_ranking && (
                  <div>
                    <span style={{ color: 'var(--tc-30)' }}>Alexa Rank</span>
                    <p style={{ color: 'var(--tc-65)' }}>#{lead.alexa_ranking.toLocaleString()}</p>
                  </div>
                )}
                {lead.market_cap && (
                  <div>
                    <span style={{ color: 'var(--tc-30)' }}>Market Cap</span>
                    <p style={{ color: 'var(--tc-65)' }}>{lead.market_cap}</p>
                  </div>
                )}
                {lead.publicly_traded_symbol && (
                  <div>
                    <span style={{ color: 'var(--tc-30)' }}>Listed</span>
                    <p style={{ color: 'var(--tc-65)' }}>
                      {lead.publicly_traded_symbol}
                      {lead.publicly_traded_exchange && <span style={{ color: 'var(--tc-35)' }}> · {lead.publicly_traded_exchange.toUpperCase()}</span>}
                    </p>
                  </div>
                )}
                {lead.company_phone && (
                  <div>
                    <span style={{ color: 'var(--tc-30)' }}>Phone</span>
                    <p style={{ color: 'var(--tc-65)' }}>{lead.company_phone}</p>
                  </div>
                )}
                {lead.departments?.length ? (
                  <div className="col-span-2">
                    <span style={{ color: 'var(--tc-30)' }}>Department</span>
                    <p style={{ color: 'var(--tc-65)' }} className="capitalize">{lead.departments.join(', ')}</p>
                  </div>
                ) : null}
              </div>

              {/* Funding events */}
              {lead.funding_events?.length ? (
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--tc-30)' }}>Funding History</p>
                  <div className="space-y-1">
                    {lead.funding_events.slice(0, 4).map((ev, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px]">
                        <span style={{ color: 'var(--tc-55)' }}>{ev.type}</span>
                        <span style={{ color: 'var(--tc-35)' }}>
                          {ev.amount ? `${ev.currency}${ev.amount} · ` : ''}
                          {ev.date ? new Date(ev.date).getFullYear() : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Dept head count */}
              {lead.dept_head_count && Object.keys(lead.dept_head_count).length > 0 ? (
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--tc-30)' }}>Team Breakdown</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {Object.entries(lead.dept_head_count)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 8)
                      .map(([dept, count]) => (
                        <span key={dept} className="text-[10px] capitalize" style={{ color: 'var(--tc-50)' }}>
                          {dept.replace(/_/g, ' ')} <span style={{ color: 'var(--tc-70)' }}>{count}</span>
                        </span>
                      ))}
                  </div>
                </div>
              ) : null}

              {lead.tech_stack?.length ? (
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--tc-30)' }}>Tech Stack</p>
                  <div className="flex flex-wrap gap-1">
                    {lead.tech_stack.slice(0, 20).map(tool => (
                      <span
                        key={tool}
                        className="text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--s-card)', color: 'var(--tc-50)', border: '1px solid var(--s-card-b)' }}
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Contact */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--s-hover)', border: '1px solid var(--s-card-b)' }}>
            <p className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--tc-30)' }}>Contact</p>
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tc-30)' }} />
              <span className="text-[11px] truncate" style={{ color: 'var(--tc-65)' }}>{lead.email}</span>
              <EmailStatusDot status={lead.email_status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {lead.source && (
                <div style={{ color: 'var(--tc-35)' }}>
                  Source: <span style={{ color: 'var(--tc-55)' }}>{SOURCE_LABELS[lead.source] || lead.source}</span>
                </div>
              )}
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
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[9px] font-medium" style={{ color: meta.color }}>{meta.label}</span>
                            <span className="text-[9px]" style={{ color: 'var(--tc-25)' }}>{sentStr}</span>
                            {log.opened_at && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}
                                title={`Opened ${new Date(log.opened_at).toLocaleDateString('en-ZA', { day:'2-digit', month:'short' })} · ${log.open_count}x`}>
                                👁 opened{log.open_count > 1 ? ` ${log.open_count}x` : ''}
                              </span>
                            )}
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

          {/* AI Analysis */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--s-card-b)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5" style={{ background: 'var(--s-hover)', borderBottom: '1px solid var(--s-card-b)' }}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" style={{ color: '#a78bfa' }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tc-55)' }}>AI Analysis</span>
                {lead.ai_score != null && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums"
                    style={{
                      background: lead.ai_score >= 70 ? '#4ade8018' : lead.ai_score >= 50 ? `${B}18` : lead.ai_score >= 30 ? '#facc1518' : '#f8717118',
                      color:      lead.ai_score >= 70 ? '#4ade80'   : lead.ai_score >= 50 ? B            : lead.ai_score >= 30 ? '#facc15'   : '#f87171',
                      border:     `1px solid ${lead.ai_score >= 70 ? '#4ade8040' : lead.ai_score >= 50 ? `${B}40` : lead.ai_score >= 30 ? '#facc1540' : '#f8717140'}`,
                    }}
                  >
                    {lead.ai_score}/100
                  </span>
                )}
              </div>
              {!analysisQueued && (
                <button
                  onClick={handleQueueAnalysis}
                  className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-semibold transition-all"
                  style={{ background: '#a78bfa18', color: '#a78bfa', border: '1px solid #a78bfa35' }}
                >
                  <Zap className="h-2.5 w-2.5" />
                  {lead.ai_analysed_at ? 'Re-analyse' : 'Analyse'}
                </button>
              )}
              {analysisQueued && (
                <span className="text-[10px]" style={{ color: '#a78bfa99' }}>Queued ✓</span>
              )}
            </div>

            {/* Body */}
            <div className="p-3 space-y-3">
              {lead.ai_analysis ? (
                <>
                  {/* Headline */}
                  <p className="text-[12px] font-semibold leading-snug" style={{ color: 'var(--tc-80)' }}>
                    {lead.ai_analysis.headline}
                  </p>

                  {/* Fit summary */}
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--tc-55)' }}>
                    {lead.ai_analysis.fit_summary}
                  </p>

                  {/* Opportunities */}
                  {lead.ai_analysis.opportunities?.length > 0 && (
                    <div>
                      <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--tc-30)' }}>Opportunities</p>
                      <ul className="space-y-1">
                        {lead.ai_analysis.opportunities.map((op, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px]" style={{ color: 'var(--tc-60)' }}>
                            <span className="mt-0.5 shrink-0" style={{ color: '#4ade80' }}>→</span>
                            {op}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Risks */}
                  {lead.ai_analysis.risks?.length > 0 && (
                    <div>
                      <p className="text-[9px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--tc-30)' }}>Watch-outs</p>
                      <ul className="space-y-1">
                        {lead.ai_analysis.risks.map((r, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px]" style={{ color: 'var(--tc-45)' }}>
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" style={{ color: '#facc15' }} />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Next action */}
                  {lead.ai_analysis.next_action && (
                    <div className="rounded-xl px-3 py-2.5" style={{ background: '#a78bfa0d', border: '1px solid #a78bfa25' }}>
                      <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#a78bfa80' }}>Recommended angle</p>
                      <p className="text-[11px] font-medium" style={{ color: 'var(--tc-70)' }}>
                        {lead.ai_analysis.next_action}
                      </p>
                    </div>
                  )}

                  {/* Timestamp */}
                  {lead.ai_analysed_at && (
                    <p className="text-[9px]" style={{ color: 'var(--tc-20)' }}>
                      Analysed {timeSince(lead.ai_analysed_at)}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-3 text-center">
                  <Sparkles className="h-5 w-5" style={{ color: 'var(--tc-15)' }} />
                  <p className="text-[11px]" style={{ color: 'var(--tc-25)' }}>No analysis yet</p>
                  <p className="text-[10px]" style={{ color: 'var(--tc-18)' }}>
                    Click Analyse → then run analyse-leads.sh
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--tc-30)' }}>Notes</p>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes..."
              className="w-full px-3 py-2.5 rounded-xl text-xs focus:outline-none resize-none overflow-hidden"
              style={{ ...inputStyle, minHeight: '72px' }}
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

function IndustryGroup({ name, leads, openedLeads, onSelect }: {
  name: string; leads: Lead[]; openedLeads: Set<string>; onSelect: (lead: Lead) => void;
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
                {openedLeads.has(lead.id) && lead.last_contacted_at && (
                  <Eye className="h-3 w-3" style={{ color: '#4ade80', filter: 'drop-shadow(0 0 4px #4ade8088)' }} title="Opened email" />
                )}
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

function SourceGroup({ source, leads, openedLeads, onSelect }: {
  source: string; leads: Lead[]; openedLeads: Set<string>; onSelect: (lead: Lead) => void;
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
                {openedLeads.has(lead.id) && lead.last_contacted_at && (
                  <Eye className="h-3 w-3" style={{ color: '#4ade80', filter: 'drop-shadow(0 0 4px #4ade8088)' }} title="Opened email" />
                )}
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
  const [openedLeads, setOpenedLeads]       = useState<Set<string>>(new Set());
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
  const [sortKey, setSortKey]               = useState<SortKey>('ai_score');
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

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLeads = useCallback(async (spin = false) => {
    if (spin) setSpinning(true);
    const [leadsRes, logsRes, clientsRes] = await Promise.all([
      (supabase as any)
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000),
      (supabase as any)
        .from('outreach_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(2000),
      (supabase as any)
        .from('clients')
        .select('*')
        .order('name'),
    ]);
    if (!leadsRes.error) setLeads(leadsRes.data || []);
    if (!logsRes.error) {
      const logs: OutreachLog[] = logsRes.data || [];
      setAllLogs(logs);
      const map: Record<string, number[]> = {};
      const opened = new Set<string>();
      for (const row of logs) {
        if (!map[row.lead_id]) map[row.lead_id] = [];
        map[row.lead_id].push(row.step);
        if (row.opened_at) opened.add(row.lead_id);
      }
      setLogSteps(map);
      setOpenedLeads(opened);
    }
    if (!clientsRes.error && clientsRes.data) setClients(clientsRes.data);
    setLoading(false);
    if (spin) setTimeout(() => setSpinning(false), 500);
  }, []);

  // Debounced realtime handler — collapses burst events into one refetch
  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => fetchLeads(), 350);
  }, [fetchLeads]);

  useEffect(() => {
    fetchLeads();
    const ch = (supabase as any)
      .channel('crm_leads_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outreach_log' }, scheduleRefetch)
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      (supabase as any).removeChannel(ch);
    };
  }, [fetchLeads, scheduleRefetch]);

  const handleStatusChange = async (id: string, status: string) => {
    await (supabase as any).from('leads').update({ status }).eq('id', id);
    toast.success('Lead moved');
    fetchLeads();
  };

  const handleDeleteInvalid = async () => {
    const invalid = leads.filter(l => IS_DEAD(l.email_status) || IS_BOUNCE_RISK(l.email_status));
    if (invalid.length === 0) { toast.info('No invalid/risky leads to delete'); return; }
    if (!confirm(`Delete ${invalid.length} unverified/risky leads? This cannot be undone.`)) return;
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
    let list = clientLeads;
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
    return list;
  }, [clientLeads, activeSources, search]);

  useEffect(() => { setVisibleCount(50); }, [activeStage, search, activeClientId, activeSources]);

  const visibleLeads = useMemo(() => filteredLeads.slice(0, visibleCount), [filteredLeads, visibleCount]);

  const invalidCount = useMemo(() =>
    clientLeads.filter(l => IS_DEAD(l.email_status) || IS_BOUNCE_RISK(l.email_status)).length,
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
      <StatsBar leads={clientLeads} allLogs={allLogs} />

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
        <div className="space-y-3">
          {/* Search + source filter row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--tc-30)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search leads…"
                className="w-full pl-8 pr-3 py-2 rounded-xl text-xs focus:outline-none"
                style={{ background: 'var(--s-input)', border: '1px solid var(--s-input-b)', color: 'var(--tc-80)' }}
              />
            </div>
            {/* Source pills */}
            {[...new Set(clientLeads.map(l => l.source).filter(Boolean))].map(src => (
              <button
                key={src!}
                onClick={() => handleSourceToggle(src!)}
                className="text-[10px] font-medium px-3 py-1.5 rounded-full transition-all"
                style={
                  activeSources.size === 0 || activeSources.has(src!)
                    ? { background: `${B}15`, border: `1px solid ${B}35`, color: B }
                    : { background: 'var(--s-hover)', border: '1px solid var(--s-pill-b)', color: 'var(--tc-35)' }
                }
              >
                {SOURCE_LABELS[src!] || src}
              </button>
            ))}
            {/* Sort buttons */}
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-[9px] uppercase tracking-widest mr-1" style={{ color: 'var(--tc-25)' }}>Sort</span>
              {([
                { label: 'AI Score', key: 'ai_score' as SortKey },
                { label: 'Last Touch', key: 'last_contacted_at' as SortKey },
                { label: 'Recent', key: 'created_at' as SortKey },
              ]).map(({ label, key }) => {
                const active = sortKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSort(key)}
                    className="text-[10px] font-medium px-2.5 py-1 rounded-full transition-all flex items-center gap-1"
                    style={active
                      ? { background: `${B}18`, border: `1px solid ${B}40`, color: B }
                      : { background: 'var(--s-hover)', border: '1px solid var(--s-pill-b)', color: 'var(--tc-35)' }}
                  >
                    {label}
                    {active && <span>{sortDir === 'desc' ? '↓' : '↑'}</span>}
                  </button>
                );
              })}
            </div>
            <span className="text-[10px]" style={{ color: 'var(--tc-25)' }}>
              {filteredLeads.length} leads
            </span>
          </div>

          {/* Kanban board */}
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--tc-25)' }}>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : (
            <KanbanBoard leads={filteredLeads} logSteps={logSteps} openedLeads={openedLeads} onSelect={setSelectedLead} sortKey={sortKey} sortDir={sortDir} />
          )}
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
              <IndustryGroup key={name} name={name} leads={groupLeads} openedLeads={openedLeads} onSelect={setSelectedLead} />
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
              <SourceGroup key={src} source={src} leads={srcLeads} openedLeads={openedLeads} onSelect={setSelectedLead} />
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
