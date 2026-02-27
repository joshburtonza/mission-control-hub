import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, Mail, Instagram, CheckCircle, Clock, XCircle,
  TrendingUp, RefreshCw, ExternalLink, Filter, ChevronDown, ChevronUp,
  Star, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types ── */
interface VantaLead {
  id: string;
  instagram_handle: string | null;
  full_name: string | null;
  business_name: string | null;
  email: string | null;
  location_city: string | null;
  specialties: string[] | null;
  follower_count: number | null;
  engagement_rate: number | null;
  quality_score: number;
  outreach_status: string;
  last_contacted_at: string | null;
  last_reply_at: string | null;
  ig_comment_sent_at: string | null;
  website: string | null;
  email_verified: boolean | null;
  instagram_active: boolean | null;
  discovered_at: string;
}

const ACCENT = '#4B9EFF';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  new:          { label: 'Discovered',  color: 'text-gray-400',   icon: Clock },
  queued:       { label: 'Queued',      color: 'text-blue-400',   icon: Mail },
  emailed:      { label: 'Emailed',     color: 'text-indigo-400', icon: Mail },
  dmed:         { label: 'DM\'d',       color: 'text-purple-400', icon: Instagram },
  ig_commented: { label: 'Commented',   color: 'text-pink-400',   icon: Instagram },
  responded:    { label: 'Responded',   color: 'text-yellow-400', icon: CheckCircle },
  converted:    { label: 'Converted',   color: 'text-green-400',  icon: CheckCircle },
  rejected:     { label: 'Rejected',    color: 'text-red-500',    icon: XCircle },
  unsubscribed: { label: 'Unsub',       color: 'text-red-400',    icon: XCircle },
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-500/20 text-green-300 border-green-500/30'
              : score >= 50 ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
              : score >= 30 ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
              :               'bg-red-500/20 text-red-400 border-red-500/30';
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono', color)}>
      <Star className="w-3 h-3" />
      {score}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-[#0d1117] border border-[#1e2d3d] rounded-lg p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-[#1e2d3d] flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-[#4B9EFF]" />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function VantaPage() {
  const [leads, setLeads]               = useState<VantaLead[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [minScore, setMinScore]         = useState<number>(0);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [lastRefresh, setLastRefresh]   = useState(new Date());

  const loadLeads = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('vanta_leads')
      .select(`
        id, instagram_handle, full_name, business_name, email, location_city,
        specialties, follower_count, engagement_rate, quality_score,
        outreach_status, last_contacted_at, last_reply_at, ig_comment_sent_at,
        website, email_verified, instagram_active, discovered_at
      `)
      .order('quality_score', { ascending: false })
      .order('discovered_at', { ascending: false })
      .limit(500);
    setLeads(data as VantaLead[] || []);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // Real-time subscription
  useEffect(() => {
    const sub = supabase
      .channel('vanta_leads_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vanta_leads' }, () => {
        loadLeads();
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [loadLeads]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const total      = leads.length;
  const qualified  = leads.filter(l => l.quality_score >= 50).length;
  const emailed    = leads.filter(l => ['emailed', 'dmed'].includes(l.outreach_status)).length;
  const responded  = leads.filter(l => l.outreach_status === 'responded').length;
  const converted  = leads.filter(l => l.outreach_status === 'converted').length;
  const qualRate   = total > 0 ? Math.round((qualified / total) * 100) : 0;
  const replyRate  = emailed > 0 ? Math.round((responded / emailed) * 100) : 0;

  // ── Filtered leads ─────────────────────────────────────────────────────────
  const filtered = leads.filter(l => {
    if (filterStatus !== 'all' && l.outreach_status !== filterStatus) return false;
    if (l.quality_score < minScore) return false;
    return true;
  });

  const statusCounts = leads.reduce((acc, l) => {
    acc[l.outreach_status] = (acc[l.outreach_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#060a10] text-white">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Vanta Studios</h1>
          <p className="text-sm text-gray-500 mt-0.5">B2B Photographer Lead Pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600">
            Updated {lastRefresh.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={loadLeads}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1e2d3d] text-gray-300 text-sm hover:bg-[#2a3f55] transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard icon={Users}      label="Total Leads"   value={total}     sub="discovered" />
        <MetricCard icon={Star}       label="Qualified"     value={qualified} sub={`${qualRate}% qual rate`} />
        <MetricCard icon={Mail}       label="Emailed"       value={emailed}   sub="outreached" />
        <MetricCard icon={TrendingUp} label="Responded"     value={responded} sub={`${replyRate}% reply rate`} />
        <MetricCard icon={CheckCircle} label="Converted"   value={converted} sub="booked" />
        <MetricCard icon={Instagram}  label="IG Engaged"    value={leads.filter(l => l.ig_comment_sent_at).length} sub="comments sent" />
      </div>

      {/* Pipeline funnel */}
      <div className="bg-[#0d1117] border border-[#1e2d3d] rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Pipeline Funnel</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {(['new','queued','emailed','ig_commented','responded','converted','rejected'] as const).map(status => {
            const count = statusCounts[status] || 0;
            if (count === 0) return null;
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                  filterStatus === status
                    ? 'border-[#4B9EFF] bg-[#4B9EFF]/10 text-white'
                    : 'border-[#1e2d3d] bg-[#0d1117] text-gray-400 hover:border-[#2a3f55]'
                )}
              >
                <Icon className={cn('w-4 h-4', cfg.color)} />
                <span>{cfg.label}</span>
                <span className="font-bold text-white">{count}</span>
              </button>
            );
          })}
          {filterStatus !== 'all' && (
            <button
              onClick={() => setFilterStatus('all')}
              className="px-3 py-2 rounded-lg border border-dashed border-gray-600 text-gray-500 text-sm hover:border-gray-400 transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      {/* Score filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 bg-[#0d1117] border border-[#1e2d3d] rounded-lg px-4 py-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-400">Min quality score:</span>
          <input
            type="range" min="0" max="100" step="10"
            value={minScore}
            onChange={e => setMinScore(parseInt(e.target.value))}
            className="w-24 accent-[#4B9EFF]"
          />
          <span className="text-sm font-mono text-white w-8">{minScore}</span>
        </div>
        <span className="text-sm text-gray-500">{filtered.length} leads shown</span>
      </div>

      {/* Lead table */}
      <div className="bg-[#0d1117] border border-[#1e2d3d] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2d3d]">
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Handle</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Score</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Location</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Niche</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Followers</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Verified</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider w-8"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-600">Loading leads...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-600">No leads match this filter.</td></tr>
            )}
            {filtered.map(lead => {
              const expanded = expandedId === lead.id;
              const name = lead.full_name || lead.business_name || lead.instagram_handle || '—';
              return (
                <>
                  <tr
                    key={lead.id}
                    className="border-b border-[#1e2d3d] hover:bg-[#1e2d3d]/30 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expanded ? null : lead.id)}
                  >
                    {/* Handle + name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-white">{name}</p>
                          {lead.instagram_handle && (
                            <p className="text-xs text-gray-500">@{lead.instagram_handle}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Quality score */}
                    <td className="px-4 py-3"><ScoreBadge score={lead.quality_score} /></td>
                    {/* Status */}
                    <td className="px-4 py-3"><StatusPill status={lead.outreach_status} /></td>
                    {/* Location */}
                    <td className="px-4 py-3 text-gray-400">{lead.location_city || '—'}</td>
                    {/* Niche */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(lead.specialties || []).slice(0, 2).map(s => (
                          <span key={s} className="px-1.5 py-0.5 bg-[#1e2d3d] text-gray-400 text-xs rounded">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    {/* Followers */}
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      {lead.follower_count ? lead.follower_count.toLocaleString('en-ZA') : '—'}
                    </td>
                    {/* Verified flags */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span title="Email verified" className={cn('w-2 h-2 rounded-full', lead.email_verified ? 'bg-green-400' : 'bg-gray-700')} />
                        <span title="Instagram active" className={cn('w-2 h-2 rounded-full', lead.instagram_active ? 'bg-green-400' : 'bg-gray-700')} />
                      </div>
                    </td>
                    {/* Expand toggle */}
                    <td className="px-4 py-3 text-gray-600">
                      {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expanded && (
                    <tr key={`${lead.id}-exp`} className="bg-[#0a0f16] border-b border-[#1e2d3d]">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Email</p>
                            <p className="text-gray-300 break-all">{lead.email || 'Not found'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Engagement Rate</p>
                            <p className="text-gray-300">{lead.engagement_rate ? `${lead.engagement_rate}%` : '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Website</p>
                            {lead.website ? (
                              <a href={lead.website} target="_blank" rel="noopener noreferrer"
                                className="text-[#4B9EFF] hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                {lead.website.replace(/^https?:\/\//, '').slice(0, 30)}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : <p className="text-gray-500">None</p>}
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Last Contacted</p>
                            <p className="text-gray-300">
                              {lead.last_contacted_at
                                ? new Date(lead.last_contacted_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
                                : 'Never'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Instagram</p>
                            {lead.instagram_handle ? (
                              <a
                                href={`https://www.instagram.com/${lead.instagram_handle}/`}
                                target="_blank" rel="noopener noreferrer"
                                className="text-[#4B9EFF] hover:underline flex items-center gap-1"
                                onClick={e => e.stopPropagation()}
                              >
                                @{lead.instagram_handle}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : '—'}
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">IG Comment Sent</p>
                            <p className="text-gray-300">
                              {lead.ig_comment_sent_at
                                ? new Date(lead.ig_comment_sent_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
                                : 'Not yet'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Last Reply</p>
                            <p className="text-gray-300">
                              {lead.last_reply_at
                                ? new Date(lead.last_reply_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
                                : 'None'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Discovered</p>
                            <p className="text-gray-300">
                              {new Date(lead.discovered_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
