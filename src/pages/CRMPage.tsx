import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Plus, RefreshCw, Building2, ChevronRight, X, Search,
  Mail, Globe, Tag, TrendingUp, Users, MessageSquare, Star,
  Send, Clock, CheckCheck, CalendarCheck, Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────────────

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
  first_name: string;
  last_name: string | null;
  email: string;
  company: string | null;
  website: string | null;
  source: string | null;
  status: string;
  last_contacted_at: string | null;
  reply_received_at: string | null;
  reply_sentiment: string | null;
  notes: string | null;
  assigned_to: string | null;
  tags: string[] | null;
  created_at: string;
  email_status: string | null;
}

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
  { key: 'closed_won',        label: 'Closed Won',  active: true  },
  { key: 'closed_lost',       label: 'Closed Lost', active: false },
];

const SOURCE_LABELS: Record<string, string> = {
  manual:    'Manual',
  telegram:  'Telegram',
  tiktok:    'TikTok',
  referral:  'Referral',
  cold_list: 'Google Places',
  linkedin:  'LinkedIn / Apollo',
};

const VIEWS = ['Pipeline', 'By Industry', 'By Source', 'Sent'] as const;
type View = typeof VIEWS[number];

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

function getIndustryTags(lead: Lead): string[] {
  if (!lead.tags) return [];
  const knownStatuses = new Set(PIPELINE_STAGES.map(s => s.key));
  const knownSources  = new Set(Object.keys(SOURCE_LABELS));
  return lead.tags.filter(t => !knownStatuses.has(t) && !knownSources.has(t));
}

function fullName(lead: Lead) {
  return [lead.first_name, lead.last_name].filter(Boolean).join(' ');
}

// ── Email status badge ────────────────────────────────────────────────────────

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
    <span
      title={meta.title}
      className="flex items-center gap-1 text-[9px]"
      style={{ color: meta.dot }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const stage = PIPELINE_STAGES.find(s => s.key === status);
  const isActive = stage?.active ?? false;
  return (
    <span
      className="text-[9px] px-2 py-0.5 rounded-full"
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

// ── Add Lead Modal ────────────────────────────────────────────────────────────

function AddLeadModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
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
    const tags: string[] = [];
    if (form.industry.trim()) tags.push(...form.industry.split(',').map(t => t.trim()).filter(Boolean));
    const { error } = await (supabase as any).from('leads').insert({
      first_name: form.first_name.trim(),
      last_name:  form.last_name.trim() || null,
      email:      form.email.trim().toLowerCase(),
      company:    form.company.trim() || null,
      website:    form.website.trim() || null,
      source:     form.source,
      notes:      form.notes.trim() || null,
      tags:       tags.length ? tags : null,
      status:     'new',
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

  const inputCls = "w-full px-3 py-2 rounded-xl text-xs focus:outline-none transition-colors";
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
          <input value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Last name" className={inputCls} style={inputStyle} />
        </div>
        {[
          { k: 'email', placeholder: 'Email *', type: 'email' },
          { k: 'company', placeholder: 'Company' },
          { k: 'website', placeholder: 'Website' },
          { k: 'industry', placeholder: 'Industry / vertical (comma-separated tags)' },
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
        <select
          value={form.source}
          onChange={e => set('source', e.target.value)}
          className={inputCls}
          style={inputStyle}
        >
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
          <button onClick={onClose} className="flex-1 h-9 rounded-xl text-xs transition-colors" style={{ background: 'var(--s-hover)', border: '1px solid var(--s-card-b)', color: 'var(--tc-50)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 h-9 rounded-xl text-xs font-semibold transition-all" style={{ background: `${B}20`, border: `1px solid ${B}45`, color: B }}>
            {saving ? 'Saving…' : 'Add Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sequence step labels ──────────────────────────────────────────────────────

const STEP_META: Record<number, { label: string; color: string }> = {
  1: { label: 'Intro',      color: B },
  2: { label: 'Follow-up',  color: '#a78bfa' },
  3: { label: 'Breakup',    color: '#94a3b8' },
};

// ── Lead Detail Panel ─────────────────────────────────────────────────────────

function LeadDetail({ lead, onClose, onStatusChange }: {
  lead: Lead;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const name = fullName(lead);
  const industryTags = getIndustryTags(lead);
  const nextStatuses = PIPELINE_STAGES.map(s => s.key).filter(s => s !== lead.status);

  const [logs, setLogs]           = useState<OutreachLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [introQueued, setIntroQueued] = useState(false);
  const [introSending, setIntroSending] = useState(false);

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        style={{ background: 'rgba(10,11,20,0.97)', backdropFilter: 'blur(32px)', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${B}18`, border: `1px solid ${B}35` }}>
              <span className="text-sm font-bold" style={{ color: B }}>{lead.first_name[0]?.toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--tc-90)' }}>{name}</h2>
              {lead.company && <p className="text-[11px]" style={{ color: 'var(--tc-40)' }}>{lead.company}</p>}
              <div className="flex items-center gap-2">
                <p className="text-[11px]" style={{ color: 'var(--tc-35)' }}>{lead.email}</p>
                <EmailStatusDot status={lead.email_status} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={lead.status} />
            <button onClick={onClose} style={{ color: 'var(--tc-30)' }}><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {lead.website && (
            <div className="col-span-2 flex items-center gap-1.5" style={{ color: 'var(--tc-45)' }}>
              <Globe className="h-3 w-3 shrink-0" />
              <a href={lead.website} target="_blank" rel="noopener noreferrer" style={{ color: B }} className="underline truncate">{lead.website}</a>
            </div>
          )}
          <div style={{ color: 'var(--tc-35)' }}>Source: <span style={{ color: 'var(--tc-65)' }}>{SOURCE_LABELS[lead.source || ''] || lead.source || '—'}</span></div>
          <div style={{ color: 'var(--tc-35)' }}>Added: <span style={{ color: 'var(--tc-65)' }}>{timeSince(lead.created_at)}</span></div>
          {lead.last_contacted_at && (
            <div style={{ color: 'var(--tc-35)' }}>Last contact: <span style={{ color: 'var(--tc-65)' }}>{timeSince(lead.last_contacted_at)}</span></div>
          )}
          {lead.reply_received_at && (
            <div style={{ color: 'var(--tc-35)' }}>Replied: <span style={{ color: B }}>{timeSince(lead.reply_received_at)}</span></div>
          )}
          {lead.reply_sentiment && (
            <div style={{ color: 'var(--tc-35)' }}>Sentiment: <span style={{ color: lead.reply_sentiment === 'positive' ? '#4ade80' : lead.reply_sentiment === 'negative' ? '#f87171' : 'var(--tc-65)' }}>{lead.reply_sentiment}</span></div>
          )}
        </div>

        {/* Industry tags */}
        {industryTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="h-3 w-3 shrink-0" style={{ color: 'var(--tc-30)' }} />
            {industryTags.map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${B}10`, color: `${B}bb`, border: `1px solid ${B}25` }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Notes */}
        {lead.notes && (
          <div className="rounded-xl p-3" style={{ background: 'var(--s-hover)', border: '1px solid var(--s-row-b)' }}>
            <p className="text-[11px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--tc-50)' }}>{lead.notes}</p>
          </div>
        )}

        {/* ── Outreach sequence ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Send className="h-3.5 w-3.5" style={{ color: B }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tc-50)' }}>
                Outreach Sequence
              </span>
            </div>
            {/* Step progress dots */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map(s => {
                const done = logs.some(l => l.step === s);
                const meta = STEP_META[s];
                return (
                  <div
                    key={s}
                    className="flex items-center gap-1"
                    title={meta.label}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{
                        background: done ? `${meta.color}20` : 'var(--s-hover)',
                        border: `1px solid ${done ? meta.color + '50' : 'var(--s-pill-b)'}`,
                        color: done ? meta.color : 'var(--tc-20)',
                      }}
                    >
                      {done ? '✓' : s}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {logsLoading ? (
            <div className="flex items-center gap-2 py-3" style={{ color: 'var(--tc-25)' }}>
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
                  <div
                    key={log.id}
                    className="rounded-xl overflow-hidden"
                    style={{ border: `1px solid ${meta.color}25`, background: `${meta.color}06` }}
                  >
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
                        {log.gmail_message_id && (
                          <p className="text-[9px] mt-2 font-mono" style={{ color: 'var(--tc-20)' }}>
                            Gmail ID: {log.gmail_message_id}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Next step due */}
              {nextStepDue && (
                <div
                  className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                  style={{ border: '1px solid var(--s-divider)', background: 'var(--s-hover)' }}
                >
                  <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tc-30)' }} />
                  <p className="text-[11px]" style={{ color: 'var(--tc-35)' }}>
                    Step {nextStepDue.step} ({STEP_META[nextStepDue.step]?.label}) scheduled in{' '}
                    <span style={{ color: 'var(--tc-65)' }}>{nextStepDue.daysLeft}d</span>
                  </p>
                </div>
              )}

              {/* Sequence complete */}
              {stepsComplete === 3 && (
                <div
                  className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                  style={{ border: '1px solid rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.05)' }}
                >
                  <CheckCheck className="h-3.5 w-3.5 shrink-0" style={{ color: '#4ade80' }} />
                  <p className="text-[11px]" style={{ color: '#4ade80' }}>Full 3-step sequence complete</p>
                </div>
              )}
            </div>
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
                  onClick={() => { onStatusChange(lead.id, s); onClose(); }}
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
  );
}

// ── Industry Group Card ───────────────────────────────────────────────────────

function IndustryGroup({ name, leads, onSelect }: {
  name: string;
  leads: Lead[];
  onSelect: (lead: Lead) => void;
}) {
  const [open, setOpen] = useState(false);
  const replied = leads.filter(l => l.reply_received_at).length;
  const qualified = leads.filter(l => l.status === 'qualified' || l.status === 'proposal' || l.status === 'closed_won').length;

  return (
    <div style={CARD}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 gap-3"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${B}12`, border: `1px solid ${B}25` }}>
            <Building2 className="h-3.5 w-3.5" style={{ color: B }} />
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
                  <span className="text-[9px] font-bold" style={{ color: B }}>{lead.first_name[0]?.toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium truncate" style={{ color: 'var(--tc-75)' }}>{fullName(lead)}</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--tc-30)' }}>{lead.company || lead.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lead.reply_received_at && <Mail className="h-3 w-3" style={{ color: B }} />}
                <StatusBadge status={lead.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Source Group ──────────────────────────────────────────────────────────────

function SourceGroup({ source, leads, onSelect }: {
  source: string;
  leads: Lead[];
  onSelect: (lead: Lead) => void;
}) {
  const [open, setOpen] = useState(false);
  const replied = leads.filter(l => l.reply_received_at).length;
  const replyRate = leads.length > 0 ? Math.round((replied / leads.length) * 100) : 0;

  return (
    <div style={CARD}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 gap-3"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="text-left">
            <p className="text-[13px] font-semibold" style={{ color: 'var(--tc-85)' }}>{SOURCE_LABELS[source] || source}</p>
            <p className="text-[10px]" style={{ color: 'var(--tc-30)' }}>{leads.length} lead{leads.length !== 1 ? 's' : ''}</p>
          </div>
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
                  <span className="text-[9px] font-bold" style={{ color: B }}>{lead.first_name[0]?.toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium truncate" style={{ color: 'var(--tc-75)' }}>{fullName(lead)}</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--tc-30)' }}>{lead.company || lead.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lead.reply_received_at && <Mail className="h-3 w-3" style={{ color: B }} />}
                <StatusBadge status={lead.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Funnel Bar ────────────────────────────────────────────────────────────────

function FunnelBar({ stage, count, max }: { stage: typeof PIPELINE_STAGES[0]; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] w-20 shrink-0 text-right" style={{ color: 'var(--tc-35)' }}>{stage.label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--s-hover)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: stage.active ? B : 'rgba(255,255,255,0.15)' }}
        />
      </div>
      <span className="text-[11px] w-6 text-right font-semibold tabular-nums" style={{ color: count > 0 ? (stage.active ? B : 'var(--tc-40)') : 'var(--tc-20)' }}>{count}</span>
    </div>
  );
}

// ── Sent Log Row ─────────────────────────────────────────────────────────────

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
    <div
      style={{
        background: 'var(--s-card)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${meta.color}20`,
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Step badge */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
          style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}35` }}
        >
          {log.step}
        </div>

        {/* Middle — subject + recipient */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--tc-85)' }}>{log.subject}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {lead ? (
              <span
                className="text-[10px] underline-offset-2 hover:underline cursor-pointer truncate"
                style={{ color: B }}
                onClick={e => { e.stopPropagation(); onLeadClick(); }}
              >
                {[lead.first_name, lead.last_name].filter(Boolean).join(' ')}
                {lead.company ? ` · ${lead.company}` : ''}
              </span>
            ) : (
              <span className="text-[10px] font-mono" style={{ color: 'var(--tc-25)' }}>{log.lead_id.slice(0, 8)}…</span>
            )}
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${meta.color}12`, color: meta.color, border: `1px solid ${meta.color}25` }}>
              {meta.label}
            </span>
          </div>
        </div>

        {/* Right — date/time */}
        <div className="text-right shrink-0">
          <p className="text-[11px]" style={{ color: 'var(--tc-50)' }}>{dateStr}</p>
          <p className="text-[9px]" style={{ color: 'var(--tc-25)' }}>{timeStr}</p>
        </div>

        <ChevronRight
          className="h-3 w-3 shrink-0 transition-transform"
          style={{ color: 'var(--tc-20)', transform: expanded ? 'rotate(90deg)' : undefined }}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-2" style={{ borderTop: `1px solid ${meta.color}15` }}>
          <p className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--tc-55)' }}>
            {log.body}
          </p>
          <div className="flex items-center gap-4 pt-1">
            {lead && (
              <span className="text-[10px]" style={{ color: 'var(--tc-30)' }}>
                To: <span style={{ color: 'var(--tc-50)' }}>{lead.email}</span>
              </span>
            )}
            {log.gmail_message_id && (
              <span className="text-[9px] font-mono" style={{ color: 'var(--tc-20)' }}>
                ID: {log.gmail_message_id}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [leads, setLeads]                   = useState<Lead[]>([]);
  const [logSteps, setLogSteps]             = useState<Record<string, number[]>>({});
  const [allLogs, setAllLogs]               = useState<OutreachLog[]>([]);
  const [warmup, setWarmup]                 = useState<{ day: number; cap: number; sentToday: number } | null>(null);
  const [loading, setLoading]               = useState(true);
  const [spinning, setSpinning]             = useState(false);
  const [view, setView]                     = useState<View>('Pipeline');
  const [activeStage, setActiveStage]       = useState<string | null>(null);
  const [search, setSearch]                 = useState('');
  const [showAddModal, setShowAddModal]     = useState(false);
  const [selectedLead, setSelectedLead]     = useState<Lead | null>(null);
  const [visibleCount, setVisibleCount]     = useState(50);
  const [deletingInvalid, setDeletingInvalid] = useState(false);

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

      // Warmup stats
      if (logs.length > 0) {
        const earliest = logs.reduce((a, b) =>
          new Date(a.sent_at).getTime() < new Date(b.sent_at).getTime() ? a : b
        );
        const daysActive = Math.floor(
          (Date.now() - new Date(earliest.sent_at).getTime()) / 86400000
        );
        const cap = daysActive < 7 ? 10 : daysActive < 14 ? 15 : daysActive < 21 ? 20
          : daysActive < 28 ? 30 : daysActive < 35 ? 40 : 50;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const sentToday = logs.filter(l => new Date(l.sent_at) >= todayStart).length;
        setWarmup({ day: daysActive + 1, cap, sentToday });
      }
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

  // ── Derived stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:      leads.length,
    active:     leads.filter(l => !['closed_won','closed_lost'].includes(l.status)).length,
    replied:    leads.filter(l => l.reply_received_at).length,
    qualified:  leads.filter(l => l.status === 'qualified').length,
    won:        leads.filter(l => l.status === 'closed_won').length,
  }), [leads]);

  const replyRate = stats.total > 0 ? Math.round((stats.replied / stats.total) * 100) : 0;

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
      counts[lead.status] = (counts[lead.status] || 0) + 1;
    }
    return counts;
  }, [leads]);

  // ── Filtered leads (pipeline view) ────────────────────────────────────────

  const filteredLeads = useMemo(() => {
    let list = activeStage ? leads.filter(l => l.status === activeStage) : leads;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        fullName(l).toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.company || '').toLowerCase().includes(q) ||
        (l.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [leads, activeStage, search]);

  // Reset pagination when filter/search changes
  useEffect(() => { setVisibleCount(50); }, [activeStage, search]);

  const visibleLeads = useMemo(() => filteredLeads.slice(0, visibleCount), [filteredLeads, visibleCount]);

  const invalidCount = useMemo(() =>
    leads.filter(l => l.email_status === 'invalid' || l.email_status === 'risky').length,
  [leads]);

  // ── Industry groups ────────────────────────────────────────────────────────

  const industryGroups = useMemo(() => {
    const groups: Record<string, Lead[]> = {};
    for (const lead of leads) {
      const tags = getIndustryTags(lead);
      if (tags.length === 0) {
        groups['Untagged'] = [...(groups['Untagged'] || []), lead];
      } else {
        for (const tag of tags) {
          groups[tag] = [...(groups[tag] || []), lead];
        }
      }
    }
    return Object.entries(groups)
      .sort((a, b) => b[1].length - a[1].length);
  }, [leads]);

  // ── Source groups ──────────────────────────────────────────────────────────

  const sourceGroups = useMemo(() => {
    const groups: Record<string, Lead[]> = {};
    for (const lead of leads) {
      const src = lead.source || 'unknown';
      groups[src] = [...(groups[src] || []), lead];
    }
    return Object.entries(groups)
      .sort((a, b) => b[1].length - a[1].length);
  }, [leads]);

  return (
    <div className="space-y-4 pb-24 sm:pb-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--tc-85)' }}>Alex CRM</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--tc-35)' }}>
            Outreach pipeline · {replyRate}% reply rate · {stats.active} active leads
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* ── Stats row ── */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Total',     value: stats.total,     glow: false },
          { label: 'Active',    value: stats.active,    glow: false },
          { label: 'Replied',   value: stats.replied,   glow: true },
          { label: 'Qualified', value: stats.qualified, glow: true },
          { label: 'Won',       value: stats.won,       glow: true },
        ].map(s => (
          <div key={s.label} style={CARD} className="flex flex-col items-center justify-center py-3 px-2 gap-0.5">
            <span className="text-xl font-bold tabular-nums" style={{ color: s.glow ? B : 'var(--tc-85)', textShadow: s.glow ? `0 0 16px ${B}88` : 'none' }}>{s.value}</span>
            <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--tc-30)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Warmup bar ── */}
      {warmup && (
        <div style={CARD} className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Send className="h-3.5 w-3.5" style={{ color: B }} />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--tc-65)' }}>
                Alex Warmup
              </span>
              <span
                className="text-[9px] px-2 py-0.5 rounded-full"
                style={{ background: `${B}12`, color: `${B}cc`, border: `1px solid ${B}25` }}
              >
                Day {warmup.day}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] tabular-nums" style={{ color: 'var(--tc-70)' }}>
                <span style={{ color: warmup.sentToday >= warmup.cap ? '#4ade80' : B }}>{warmup.sentToday}</span>
                <span style={{ color: 'var(--tc-30)' }}>/{warmup.cap}</span>
                <span className="text-[9px] ml-1" style={{ color: 'var(--tc-25)' }}>today</span>
              </span>
              {(() => {
                const schedule = [
                  { days: 7,  cap: 10,  label: '10/d' },
                  { days: 14, cap: 15,  label: '15/d' },
                  { days: 21, cap: 20,  label: '20/d' },
                  { days: 28, cap: 30,  label: '30/d' },
                  { days: 35, cap: 40,  label: '40/d' },
                  { days: 999,cap: 50,  label: '50/d' },
                ];
                const next = schedule.find(s => s.cap > warmup.cap);
                return next && warmup.day <= 36 ? (
                  <span className="text-[9px]" style={{ color: 'var(--tc-25)' }}>
                    → {next.label} in {Math.max(0, schedule.find(s => s.cap === warmup.cap)!.days - (warmup.day - 1))}d
                  </span>
                ) : (
                  <span className="text-[9px]" style={{ color: '#4ade80' }}>Full speed</span>
                );
              })()}
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--s-hover)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (warmup.sentToday / warmup.cap) * 100)}%`,
                background: warmup.sentToday >= warmup.cap
                  ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                  : `linear-gradient(90deg, ${B}, #60a5fa)`,
              }}
            />
          </div>
          {/* Warmup schedule mini-timeline */}
          <div className="flex items-center gap-1 mt-2">
            {[
              { label: '10', days: 7 },
              { label: '15', days: 14 },
              { label: '20', days: 21 },
              { label: '30', days: 28 },
              { label: '40', days: 35 },
              { label: '50', days: 999 },
            ].map((s, i) => {
              const reached = warmup.cap >= parseInt(s.label);
              return (
                <React.Fragment key={s.label}>
                  {i > 0 && <div className="flex-1 h-px" style={{ background: 'var(--s-divider)' }} />}
                  <span
                    className="text-[8px] font-medium shrink-0"
                    style={{ color: reached ? B : 'var(--tc-20)' }}
                  >
                    {s.label}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* ── View tabs ── */}
      <div style={CARD} className="flex items-center gap-1 p-1.5">
        {VIEWS.map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="flex-1 py-2 text-[11px] font-medium rounded-xl transition-all"
            style={view === v ? { background: `${B}18`, color: B, border: `1px solid ${B}35` } : { color: 'var(--tc-40)', border: '1px solid transparent' }}
          >
            {v}
          </button>
        ))}
      </div>

      {/* ── Pipeline view ── */}
      {view === 'Pipeline' && (
        <div className="space-y-4">
          {/* Funnel */}
          <div style={CARD} className="p-4 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4" style={{ color: B }} />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--tc-65)' }}>Funnel</span>
            </div>
            {PIPELINE_STAGES.map(stage => (
              <FunnelBar
                key={stage.key}
                stage={stage}
                count={stageCounts[stage.key] || 0}
                max={Math.max(...PIPELINE_STAGES.map(s => stageCounts[s.key] || 0), 1)}
              />
            ))}
          </div>

          {/* Search + stage filters */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--tc-30)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search leads…"
                className="w-full pl-8 pr-3 py-2 rounded-xl text-xs focus:outline-none"
                style={{ background: 'var(--s-input)', border: '1px solid var(--s-input-b)', color: 'var(--tc-80)' }}
              />
            </div>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveStage(null)}
              className="text-[10px] font-medium px-3 py-1.5 rounded-full transition-all"
              style={!activeStage ? { background: `${B}18`, border: `1px solid ${B}45`, color: B } : { background: 'var(--s-hover)', border: '1px solid var(--s-pill-b)', color: 'var(--tc-40)' }}
            >
              All ({leads.length})
            </button>
            {PIPELINE_STAGES.filter(s => stageCounts[s.key]).map(stage => (
              <button
                key={stage.key}
                onClick={() => setActiveStage(activeStage === stage.key ? null : stage.key)}
                className="text-[10px] font-medium px-3 py-1.5 rounded-full transition-all"
                style={activeStage === stage.key ? { background: `${B}18`, border: `1px solid ${B}45`, color: B } : { background: 'var(--s-hover)', border: '1px solid var(--s-pill-b)', color: 'var(--tc-40)' }}
              >
                {stage.label} ({stageCounts[stage.key]})
              </button>
            ))}
          </div>

          {/* Lead list */}
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2" style={{ color: 'var(--tc-25)' }}>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div style={{ ...CARD, borderRadius: '20px' }} className="flex flex-col items-center justify-center py-16 gap-3">
              <Users className="h-8 w-8" style={{ color: 'var(--tc-15)' }} />
              <p className="text-sm" style={{ color: 'var(--tc-25)' }}>
                {leads.length === 0 ? 'No leads yet — add one or let Alex run' : 'No leads match this filter'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleLeads.map(lead => {
                const hasReply    = !!lead.reply_received_at;
                const industryTags = getIndustryTags(lead);
                const steps        = logSteps[lead.id] || [];
                return (
                  <div
                    key={lead.id}
                    style={{
                      background: hasReply ? `${B}07` : 'var(--s-card)',
                      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                      border: `1px solid ${hasReply ? `${B}30` : 'var(--s-card-b)'}`,
                      borderRadius: '14px', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${B}15`, border: `1px solid ${B}30` }}>
                            <span className="text-[10px] font-bold" style={{ color: B }}>{lead.first_name[0]?.toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--tc-85)' }}>{fullName(lead)}</span>
                              {hasReply && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${B}15`, color: B, border: `1px solid ${B}30` }}>✉ replied</span>
                              )}
                              {(lead.email_status === 'invalid' || lead.email_status === 'risky') && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
                                  {lead.email_status}
                                </span>
                              )}
                              {lead.email_status === 'valid' && (
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" title="Email verified" style={{ background: '#4ade80' }} />
                              )}
                            </div>
                            <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--tc-30)' }}>
                              {lead.company ? `${lead.company} · ` : ''}{lead.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Sequence step dots */}
                          {steps.length > 0 && (
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3].map(s => {
                                const done = steps.includes(s);
                                const meta = STEP_META[s];
                                return (
                                  <div
                                    key={s}
                                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
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
                          )}
                          <StatusBadge status={lead.status} />
                          <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--tc-20)' }} />
                        </div>
                      </div>
                      {(industryTags.length > 0 || lead.last_contacted_at || lead.source) && (
                        <div className="flex items-center gap-2 mt-2 pl-10 flex-wrap">
                          {industryTags.map(tag => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${B}08`, color: `${B}88`, border: `1px solid ${B}18` }}>{tag}</span>
                          ))}
                          {lead.source && <span className="text-[9px]" style={{ color: 'var(--tc-25)' }}>{SOURCE_LABELS[lead.source] || lead.source}</span>}
                          {lead.last_contacted_at && <span className="text-[9px]" style={{ color: 'var(--tc-25)' }}>contacted {timeSince(lead.last_contacted_at)}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Load more / count */}
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
            </div>
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
              <IndustryGroup
                key={name}
                name={name}
                leads={groupLeads}
                onSelect={setSelectedLead}
              />
            ))
          )}
        </div>
      )}

      {/* ── By Source view ── */}
      {view === 'By Source' && (
        <div className="space-y-3">
          {/* Source reply-rate overview */}
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
                      <span className="text-[10px] w-20 shrink-0 text-right" style={{ color: 'var(--tc-35)' }}>{SOURCE_LABELS[src] || src}</span>
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
              <SourceGroup
                key={src}
                source={src}
                leads={srcLeads}
                onSelect={setSelectedLead}
              />
            ))
          )}
        </div>
      )}

      {/* ── Sent emails view ── */}
      {view === 'Sent' && (() => {
        const leadsById = Object.fromEntries(leads.map(l => [l.id, l]));
        return (
          <div className="space-y-2">
            {/* Summary row */}
            <div style={CARD} className="px-4 py-3 flex items-center gap-4">
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

      {/* ── Modals ── */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => fetchLeads()}
        />
      )}
      {selectedLead && (
        <LeadDetail
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
