import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Check, Youtube, Linkedin, Video, Plus, FileText, Mail, Building2, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Script {
  id: string;
  title: string;
  platform: 'youtube' | 'tiktok' | 'linkedin' | 'twitter' | 'blog';
  body: string;
  generatedAt: string;
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
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_CONFIG = {
  youtube: { label: 'YouTube', color: 'bg-red-900/40 text-red-300 border-red-700/40', icon: Youtube },
  tiktok:  { label: 'TikTok',  color: 'bg-purple-900/40 text-purple-300 border-purple-700/40', icon: Video },
  linkedin: { label: 'LinkedIn', color: 'bg-blue-900/40 text-blue-300 border-blue-700/40', icon: Linkedin },
  twitter: { label: 'Twitter', color: 'bg-sky-900/40 text-sky-300 border-sky-700/40', icon: FileText },
  blog:    { label: 'Blog',    color: 'bg-green-900/40 text-green-300 border-green-700/40', icon: FileText },
} as const;

const TABS = ['TikTok', 'YouTube', 'Cold Outreach'] as const;
type Tab = typeof TABS[number];

const PIPELINE_STAGES: { key: string; label: string; color: string }[] = [
  { key: 'new',               label: 'New',          color: 'text-muted-foreground' },
  { key: 'contacted',         label: 'Contacted',    color: 'text-blue-400' },
  { key: 'sequence_complete', label: 'Seq. Done',    color: 'text-yellow-400' },
  { key: 'replied',           label: 'Replied',      color: 'text-cyan-400' },
  { key: 'qualified',         label: 'Qualified',    color: 'text-green-400' },
  { key: 'proposal',          label: 'Proposal',     color: 'text-purple-400' },
  { key: 'closed_won',        label: 'Closed Won',   color: 'text-emerald-400' },
  { key: 'closed_lost',       label: 'Closed Lost',  color: 'text-red-400' },
];

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  telegram: 'Telegram',
  tiktok: 'TikTok',
  referral: 'Referral',
  cold_list: 'List',
  linkedin: 'LinkedIn',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function formatDayLabel(d: Date) {
  return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

function timeSince(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ── Add Lead Modal ─────────────────────────────────────────────────────────────

interface AddLeadModalProps {
  onClose: () => void;
  onAdded: () => void;
}

function AddLeadModal({ onClose, onAdded }: AddLeadModalProps) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', company: '', website: '', source: 'manual', notes: '',
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-card border border-border/50 rounded-t-2xl sm:rounded-xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-mono text-sm font-bold text-foreground">Add Lead</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { k: 'first_name', placeholder: 'First name *' },
            { k: 'last_name',  placeholder: 'Last name' },
          ].map(({ k, placeholder }) => (
            <input
              key={k}
              value={(form as any)[k]}
              onChange={e => set(k, e.target.value)}
              placeholder={placeholder}
              className="bg-background border border-border/40 rounded-md px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
            />
          ))}
        </div>
        {[
          { k: 'email',   placeholder: 'Email *',   type: 'email' },
          { k: 'company', placeholder: 'Company' },
          { k: 'website', placeholder: 'Website' },
        ].map(({ k, placeholder, type }) => (
          <input
            key={k}
            type={type || 'text'}
            value={(form as any)[k]}
            onChange={e => set(k, e.target.value)}
            placeholder={placeholder}
            className="w-full bg-background border border-border/40 rounded-md px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
          />
        ))}
        <select
          value={form.source}
          onChange={e => set('source', e.target.value)}
          className="w-full bg-background border border-border/40 rounded-md px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:border-primary/60"
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
          className="w-full bg-background border border-border/40 rounded-md px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 resize-none"
        />
        <div className="flex gap-2 pt-1">
          <Button
            onClick={onClose}
            className="flex-1 h-9 bg-transparent border border-border/40 text-muted-foreground hover:text-foreground font-mono text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-9 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-mono text-xs"
          >
            {saving ? 'Saving…' : 'Add Lead'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Lead Detail Panel ──────────────────────────────────────────────────────────

interface LeadDetailProps {
  lead: Lead;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}

function LeadDetail({ lead, onClose, onStatusChange }: LeadDetailProps) {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
  const nextStatuses = PIPELINE_STAGES.map(s => s.key).filter(s => s !== lead.status);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-card border border-border/50 rounded-t-2xl sm:rounded-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-sm font-bold text-foreground">{name}</h2>
            {lead.company && <p className="font-mono text-xs text-muted-foreground">{lead.company}</p>}
            <p className="font-mono text-xs text-muted-foreground">{lead.email}</p>
          </div>
          <StatusBadge status={lead.status} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          {lead.website && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Website: </span>
              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-primary underline">{lead.website}</a>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Source: </span>
            <span className="text-foreground">{SOURCE_LABELS[lead.source || ''] || lead.source || '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Added: </span>
            <span className="text-foreground">{timeSince(lead.created_at)}</span>
          </div>
          {lead.last_contacted_at && (
            <div>
              <span className="text-muted-foreground">Last contact: </span>
              <span className="text-foreground">{timeSince(lead.last_contacted_at)}</span>
            </div>
          )}
          {lead.reply_received_at && (
            <div>
              <span className="text-muted-foreground">Replied: </span>
              <span className="text-cyan-400">{timeSince(lead.reply_received_at)}</span>
            </div>
          )}
        </div>

        {lead.notes && (
          <div className="bg-background/60 border border-border/30 rounded-lg p-3">
            <p className="font-mono text-xs text-muted-foreground whitespace-pre-line">{lead.notes}</p>
          </div>
        )}

        <div>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Move to stage</p>
          <div className="flex flex-wrap gap-1.5">
            {nextStatuses.map(s => {
              const stage = PIPELINE_STAGES.find(p => p.key === s);
              return (
                <button
                  key={s}
                  onClick={() => { onStatusChange(lead.id, s); onClose(); }}
                  className="font-mono text-[10px] px-2.5 py-1 border border-border/40 rounded-full hover:border-primary/50 hover:text-primary text-muted-foreground transition-colors"
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

function StatusBadge({ status }: { status: string }) {
  const stage = PIPELINE_STAGES.find(s => s.key === status);
  const colorMap: Record<string, string> = {
    new: 'bg-zinc-800/60 text-zinc-400 border-zinc-700/40',
    contacted: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
    sequence_complete: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
    replied: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/40',
    qualified: 'bg-green-900/40 text-green-300 border-green-700/40',
    proposal: 'bg-purple-900/40 text-purple-300 border-purple-700/40',
    closed_won: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
    closed_lost: 'bg-red-900/40 text-red-300 border-red-700/40',
  };
  return (
    <Badge className={cn('font-mono text-[9px] border', colorMap[status] || 'bg-zinc-800/60 text-zinc-400 border-zinc-700/40')}>
      {stage?.label || status}
    </Badge>
  );
}

// ── Cold Outreach Tab ─────────────────────────────────────────────────────────

function ColdOutreach() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ColdOutreach] fetch error:', error);
      toast.error('Failed to load leads');
      setLeads([]);
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeads();

    const channel = (supabase as any)
      .channel('leads_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => { (supabase as any).removeChannel(channel); };
  }, [fetchLeads]);

  const handleStatusChange = async (id: string, status: string) => {
    await (supabase as any).from('leads').update({ status }).eq('id', id);
    toast.success('Lead moved');
    fetchLeads();
  };

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
      counts[lead.status] = (counts[lead.status] || 0) + 1;
    }
    return counts;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (!activeStage) return leads;
    return leads.filter(l => l.status === activeStage);
  }, [leads, activeStage]);

  const activeCount = leads.filter(l => !['closed_won','closed_lost'].includes(l.status)).length;
  const repliedCount = leads.filter(l => l.status === 'replied').length;
  const qualifiedCount = leads.filter(l => l.status === 'qualified').length;

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Active',    value: activeCount,    color: 'text-foreground' },
          { label: 'Replied',   value: repliedCount,   color: 'text-cyan-400' },
          { label: 'Qualified', value: qualifiedCount, color: 'text-green-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border/30 rounded-lg p-3 text-center">
            <p className={cn('font-mono text-xl font-bold', stat.color)}>{stat.value}</p>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Stage filter tabs */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setActiveStage(null)}
          className={cn(
            'font-mono text-[10px] px-2.5 py-1 rounded-full border transition-colors',
            !activeStage
              ? 'border-primary/60 text-primary bg-primary/10'
              : 'border-border/40 text-muted-foreground hover:text-foreground'
          )}
        >
          All ({leads.length})
        </button>
        {PIPELINE_STAGES.filter(s => stageCounts[s.key]).map(stage => (
          <button
            key={stage.key}
            onClick={() => setActiveStage(activeStage === stage.key ? null : stage.key)}
            className={cn(
              'font-mono text-[10px] px-2.5 py-1 rounded-full border transition-colors',
              activeStage === stage.key
                ? 'border-primary/60 text-primary bg-primary/10'
                : 'border-border/40 text-muted-foreground hover:text-foreground'
            )}
          >
            {stage.label} ({stageCounts[stage.key]})
          </button>
        ))}
      </div>

      {/* Lead list */}
      {loading ? (
        <div className="border border-border/30 rounded-lg p-12 text-center">
          <RefreshCw className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2 animate-spin" />
          <p className="font-mono text-sm text-muted-foreground">Loading leads…</p>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="border border-border/30 rounded-lg p-12 text-center">
          <Building2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-mono text-sm text-muted-foreground">
            {leads.length === 0
              ? 'No leads yet — add one or let Alex run'
              : 'No leads in this stage'}
          </p>
          <p className="font-mono text-xs text-muted-foreground/60 mt-1">
            {leads.length === 0
              ? 'Tip: send /newlead on Telegram to add from your phone'
              : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLeads.map(lead => {
            const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
            const hasReply = !!lead.reply_received_at;
            return (
              <Card
                key={lead.id}
                className={cn(
                  'bg-card border border-border/40 hover:border-primary/30 transition-colors cursor-pointer',
                  hasReply && 'border-cyan-800/40'
                )}
                onClick={() => setSelectedLead(lead)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <span className="font-mono text-[10px] font-bold text-primary">
                          {lead.first_name[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-foreground truncate">{name}</span>
                          {hasReply && (
                            <Badge className="font-mono text-[8px] bg-cyan-900/40 text-cyan-300 border-cyan-700/40 border">
                              ✉ replied
                            </Badge>
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-muted-foreground truncate">
                          {lead.company ? `${lead.company} · ` : ''}{lead.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={lead.status} />
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                  </div>
                  {(lead.last_contacted_at || lead.source) && (
                    <div className="flex items-center gap-3 mt-2 pl-10">
                      {lead.source && (
                        <span className="font-mono text-[9px] text-muted-foreground/60">
                          {SOURCE_LABELS[lead.source] || lead.source}
                        </span>
                      )}
                      {lead.last_contacted_at && (
                        <span className="font-mono text-[9px] text-muted-foreground/60">
                          contacted {timeSince(lead.last_contacted_at)}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onAdded={fetchLeads}
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Content() {
  const [activeTab, setActiveTab] = useState<Tab>('TikTok');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [showAddLead, setShowAddLead] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => startOfLocalDay(today), [today]);
  const tomorrowStart = useMemo(() => {
    const t = new Date(todayStart);
    t.setDate(t.getDate() + 1);
    return t;
  }, [todayStart]);

  useEffect(() => {
    if (activeTab === 'Cold Outreach') return;
    let cancelled = false;

    const fetchScripts = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('tasks')
        .select('id,title,description,tags,created_at,created_by')
        .eq('created_by', 'Video Bot')
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', tomorrowStart.toISOString())
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error('[Content] Failed to load scripts:', error);
        toast.error('Failed to load content scripts');
        setScripts([]);
        setLoading(false);
        return;
      }

      const mapped: Script[] = (data || [])
        .filter(row => Array.isArray(row.tags) && (row.tags.includes('tiktok') || row.tags.includes('youtube')))
        .map(row => {
          const tags = row.tags || [];
          const platform: Script['platform'] = tags.includes('youtube') ? 'youtube' : 'tiktok';
          const cleanTitle = row.title
            .replace(/^\[TikTok\]\s*/i, '')
            .replace(/^\[YouTube\]\s*/i, '');

          return {
            id: row.id,
            title: cleanTitle,
            platform,
            body: row.description || '',
            generatedAt: row.created_at || new Date().toISOString(),
          };
        });

      setScripts(mapped);
      setLoading(false);
    };

    fetchScripts();

    const channel = supabase
      .channel('content_scripts_today')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
        const row: any = payload.new || payload.old;
        const tags = row?.tags;
        if (row?.created_by === 'Video Bot' && Array.isArray(tags) && (tags.includes('tiktok') || tags.includes('youtube'))) {
          fetchScripts();
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [todayStart, tomorrowStart, activeTab]);

  const handleCopy = (script: Script) => {
    const text = `${script.title}\n\n${script.body}`;
    navigator.clipboard.writeText(text);
    setCopiedId(script.id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerate = () => {
    if (activeTab === 'Cold Outreach') {
      setShowAddLead(true);
    } else {
      toast.info('Queued for next Video Bot cron run (5am daily — 4 TikToks + YouTube on Mon/Thu)');
    }
  };

  const timeSinceFn = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const filteredScripts = useMemo(() => {
    if (activeTab === 'TikTok')   return scripts.filter(s => s.platform === 'tiktok');
    if (activeTab === 'YouTube')  return scripts.filter(s => s.platform === 'youtube');
    return [];
  }, [activeTab, scripts]);

  const lastGeneratedAt = useMemo(() => {
    if (!scripts.length) return null;
    return scripts.map(s => new Date(s.generatedAt).getTime()).reduce((a, b) => Math.max(a, b), 0);
  }, [scripts]);

  const headline = useMemo(() => {
    if (activeTab === 'Cold Outreach') return 'Alex CRM';
    if (loading) return 'Loading scripts…';
    if (!scripts.length) return 'No scripts generated yet today';
    const tiktokCount = scripts.filter(s => s.platform === 'tiktok').length;
    const ytCount = scripts.filter(s => s.platform === 'youtube').length;
    const parts = [];
    if (tiktokCount) parts.push(`${tiktokCount} TikToks`);
    if (ytCount) parts.push(`${ytCount} YouTube`);
    return `${parts.join(' + ')} ready`;
  }, [loading, scripts, activeTab]);

  return (
    <div className="space-y-4 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan">Content</h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            {activeTab === 'Cold Outreach'
              ? 'Alex outreach pipeline · Supabase-backed · 3-step sequences'
              : `4 TikToks daily · YouTube Mon + Thu · ${headline}${lastGeneratedAt ? ` · last generated ${timeSinceFn(new Date(lastGeneratedAt).toISOString())}` : ''}`}
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          className="h-9 w-9 sm:w-auto sm:px-4 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-mono text-xs rounded-full sm:rounded-md"
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{activeTab === 'Cold Outreach' ? 'Add Lead' : 'Generate'}</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/30 pb-0">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'font-mono text-xs px-3 py-2 border-b-2 transition-colors',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'Cold Outreach' ? (
        <ColdOutreach />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Today — {formatDayLabel(today)}</span>
            <div className="flex-1 h-px bg-border/30" />
            <Badge className="font-mono text-[9px] bg-primary/10 text-primary border-primary/30">
              {activeTab === 'YouTube'
                ? `${filteredScripts.length} YouTube`
                : `${filteredScripts.length} TikToks`}
            </Badge>
          </div>

          {loading ? (
            <div className="border border-border/30 rounded-lg p-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-sm text-muted-foreground">Loading…</p>
            </div>
          ) : filteredScripts.length ? (
            filteredScripts.map(script => {
              const pc = PLATFORM_CONFIG[script.platform];
              const PlatformIcon = pc.icon;
              const isCopied = copiedId === script.id;

              return (
                <Card key={script.id} className="bg-card border border-border/40 hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn('font-mono text-[9px] border flex items-center gap-1', pc.color)}>
                          <PlatformIcon className="h-2.5 w-2.5" />
                          {pc.label}
                        </Badge>
                        <span className="font-mono text-[9px] text-muted-foreground">{timeSinceFn(script.generatedAt)}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(script)}
                        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {isCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                    <h3 className="font-mono text-sm font-semibold text-foreground mb-2 leading-snug">{script.title}</h3>
                    <p className="font-mono text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{script.body}</p>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="border border-border/30 rounded-lg p-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-sm text-muted-foreground">
                {activeTab === 'YouTube'
                  ? 'No YouTube scripts generated today'
                  : 'No TikTok scripts generated today yet'}
              </p>
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">Next scheduled generation is 5am.</p>
            </div>
          )}
        </div>
      )}

      {showAddLead && (
        <AddLeadModal
          onClose={() => setShowAddLead(false)}
          onAdded={() => {}}
        />
      )}
    </div>
  );
}
