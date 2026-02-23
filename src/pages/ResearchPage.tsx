import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  BookOpen, Plus, RefreshCw, ChevronRight, Clock,
  CheckCircle2, Loader2, Brain,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const B = '#4B9EFF';

const CARD: React.CSSProperties = {
  background: 'var(--s-card)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid var(--s-card-b)',
  borderRadius: '16px',
  boxShadow: 'var(--s-card-shadow)',
};

interface ResearchSource {
  id: string;
  title: string;
  raw_content: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  created_at: string;
  metadata: Record<string, any> | null;
}

function timeSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function renderIntel(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let bullets: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (!bullets.length) return;
    nodes.push(
      <ul key={key++} style={{ margin: '4px 0 10px 16px', padding: 0, listStyle: 'disc' }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ color: 'var(--tc-75)', fontSize: '12px', lineHeight: 1.65, marginBottom: 2 }}>{b}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('# ')) {
      flushBullets();
      nodes.push(<h1 key={key++} style={{ fontSize: '15px', fontWeight: 700, color: 'var(--tc-85)', margin: '0 0 10px' }}>{t.slice(2)}</h1>);
    } else if (t.startsWith('## ')) {
      flushBullets();
      nodes.push(
        <h2 key={key++} style={{
          fontSize: '11px', fontWeight: 700, color: B, textTransform: 'uppercase',
          letterSpacing: '0.08em', margin: '18px 0 6px', paddingBottom: 4,
          borderBottom: '1px solid var(--s-divider)',
        }}>{t.slice(3)}</h2>
      );
    } else if (t.startsWith('### ')) {
      flushBullets();
      nodes.push(<h3 key={key++} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tc-65)', margin: '12px 0 4px' }}>{t.slice(4)}</h3>);
    } else if (t.startsWith('- ') || t.startsWith('* ')) {
      bullets.push(t.slice(2));
    } else if (t === '' || t === '---') {
      flushBullets();
      if (t === '---') nodes.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--s-divider)', margin: '12px 0' }} />);
    } else if (t.startsWith('*') && t.endsWith('*')) {
      flushBullets();
      nodes.push(<p key={key++} style={{ fontSize: '10px', color: 'var(--tc-30)', fontStyle: 'italic', margin: '4px 0' }}>{t.replace(/\*/g, '')}</p>);
    } else {
      flushBullets();
      nodes.push(<p key={key++} style={{ fontSize: '12px', color: 'var(--tc-65)', lineHeight: 1.6, margin: '0 0 6px' }}>{t}</p>);
    }
  }
  flushBullets();
  return nodes;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    pending:    { color: '#facc15', label: 'Pending' },
    processing: { color: B,        label: 'Processing' },
    done:       { color: '#4ade80', label: 'Done' },
    error:      { color: '#f87171', label: 'Error' },
  };
  const m = map[status] ?? map['pending'];
  return (
    <span style={{
      fontSize: '9px', fontWeight: 600, color: m.color,
      background: m.color + '18', border: `1px solid ${m.color}35`,
      borderRadius: 6, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {status === 'processing' && <Loader2 className="animate-spin" style={{ width: 9, height: 9 }} />}
      {status === 'done' && <CheckCircle2 style={{ width: 9, height: 9 }} />}
      {status === 'pending' && <Clock style={{ width: 9, height: 9 }} />}
      {m.label}
    </span>
  );
}

export default function ResearchPage() {
  const [intel, setIntel]           = useState<{ value: string; updated_at: string } | null>(null);
  const [intelLoading, setIntelLoading] = useState(true);
  const [sources, setSources]       = useState<ResearchSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [title, setTitle]           = useState('');
  const [content, setContent]       = useState('');
  const [inputMode, setInputMode]   = useState<'paste' | 'url'>('paste');
  const [submitting, setSubmitting] = useState(false);
  const [queued, setQueued]         = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchIntel = useCallback(async () => {
    setIntelLoading(true);
    const { data } = await (supabase as any)
      .from('system_config')
      .select('value,updated_at')
      .eq('key', 'research_intel')
      .single();
    setIntel(data || null);
    setIntelLoading(false);
  }, []);

  const fetchSources = useCallback(async () => {
    setSourcesLoading(true);
    const { data } = await (supabase as any)
      .from('research_sources')
      .select('id,title,raw_content,status,created_at,metadata')
      .order('created_at', { ascending: false })
      .limit(100);
    setSources(data || []);
    setSourcesLoading(false);
  }, []);

  useEffect(() => {
    fetchIntel();
    fetchSources();
    const ch = (supabase as any)
      .channel('research_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'research_sources' }, fetchSources)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_config' }, fetchIntel)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [fetchIntel, fetchSources]);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) { toast.error('Need a title and some content'); return; }
    setSubmitting(true);
    const { error } = await (supabase as any).from('research_sources').insert({
      title: title.trim(),
      raw_content: content.trim(),
      status: 'pending',
    });
    setSubmitting(false);
    if (error) { toast.error('Failed to queue'); return; }
    setTitle(''); setContent(''); setQueued(true);
    setTimeout(() => setQueued(false), 8000);
    fetchSources();
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--s-hover)', border: '1px solid var(--s-divider)',
    borderRadius: 10, padding: '8px 12px', fontSize: '13px',
    color: 'var(--tc-85)', outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  const doneCount    = sources.filter(s => s.status === 'done').length;
  const pendingCount = sources.filter(s => s.status === 'pending' || s.status === 'processing').length;

  return (
    <div className="space-y-4 pb-24 sm:pb-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--tc-85)' }}>Research Intel</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--tc-35)' }}>
            {doneCount} source{doneCount !== 1 ? 's' : ''} processed
            {pendingCount > 0 ? ` · ${pendingCount} queued` : ''}
            {intel ? ` · updated ${timeSince(intel.updated_at)}` : ''}
          </p>
        </div>
        <button
          onClick={() => { fetchIntel(); fetchSources(); }}
          className="h-8 w-8 flex items-center justify-center rounded-full transition-all"
          style={{ background: 'var(--s-hover)', border: '1px solid var(--s-pill-b)', color: 'var(--tc-40)' }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Left — Accumulated intel */}
        <div style={{ ...CARD }} className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4" style={{ color: B }} />
            <span className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: 'var(--tc-50)' }}>Strategic Intel</span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
            {intelLoading ? (
              <div className="flex items-center gap-2 py-8" style={{ color: 'var(--tc-30)' }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : intel ? (
              <div>{renderIntel(intel.value)}</div>
            ) : (
              <div className="py-12 text-center">
                <Brain className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--tc-15)' }} />
                <p className="text-xs" style={{ color: 'var(--tc-25)' }}>No intel yet — process your first transcript below</p>
              </div>
            )}
          </div>
        </div>

        {/* Right — Drop new research */}
        <div className="flex flex-col gap-4">
          <div style={{ ...CARD }} className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" style={{ color: B }} />
              <span className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: 'var(--tc-50)' }}>Drop New Research</span>
            </div>
            {/* Input mode toggle */}
            <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: 'var(--s-hover)', width: 'fit-content' }}>
              {(['paste', 'url'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => { setInputMode(mode); setContent(''); }}
                  className="px-3 py-1 rounded-[10px] text-[11px] font-semibold transition-all"
                  style={{
                    background: inputMode === mode ? `${B}22` : 'transparent',
                    border: inputMode === mode ? `1px solid ${B}40` : '1px solid transparent',
                    color: inputMode === mode ? B : 'var(--tc-40)',
                  }}
                >
                  {mode === 'paste' ? 'Paste text' : 'URL / link'}
                </button>
              ))}
            </div>

            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder='Source title — e.g. "Sam Altman on AGI timelines, Lex Fridman"'
              style={inputStyle}
            />
            {inputMode === 'paste' ? (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Paste the full transcript, article, or notes here..."
                rows={8}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
            ) : (
              <div className="flex flex-col gap-1.5">
                <input
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or any article URL"
                  style={inputStyle}
                />
                <p className="text-[10px]" style={{ color: 'var(--tc-30)' }}>
                  The agent will fetch and extract the full article/transcript text automatically.
                </p>
              </div>
            )}
            <p className="text-[10px]" style={{ color: 'var(--tc-25)' }}>
              Or drop a .txt file into <code style={{ color: 'var(--tc-45)' }}>research/inbox/</code> — picked up within 30 min
            </p>
            {queued ? (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#4ade80' }} />
                <p className="text-[11px]" style={{ color: '#4ade80' }}>Queued — insights will appear in the intel panel within 30 minutes</p>
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !title.trim() || !content.trim()}
                className="flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                style={{ background: `${B}20`, border: `1px solid ${B}45`, color: B }}
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                {submitting ? 'Submitting…' : 'Process with Claude'}
              </button>
            )}
          </div>

          {/* Recent queue status */}
          {sources.filter(s => s.status !== 'done').length > 0 && (
            <div style={{ ...CARD }} className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--tc-30)' }}>Processing queue</p>
              <div className="space-y-1.5">
                {sources.filter(s => s.status !== 'done').map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl" style={{ background: 'var(--s-hover)' }}>
                    <span className="text-[12px] truncate" style={{ color: 'var(--tc-65)' }}>{s.title}</span>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Source archive */}
      {sources.filter(s => s.status === 'done').length > 0 && (
        <div style={{ ...CARD }} className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4" style={{ color: B }} />
            <span className="text-[12px] font-semibold uppercase tracking-widest" style={{ color: 'var(--tc-50)' }}>Processed Sources</span>
            <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: `${B}12`, color: `${B}cc`, border: `1px solid ${B}25` }}>
              {doneCount}
            </span>
          </div>
          <div className="space-y-1">
            {sources.filter(s => s.status === 'done').map(s => {
              const isExpanded = expandedId === s.id;
              const insightCount = s.metadata?.insights_count ?? null;
              return (
                <div key={s.id}>
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                    style={{ background: isExpanded ? 'var(--s-hover)' : 'transparent' }}
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  >
                    <ChevronRight
                      className="h-3 w-3 shrink-0 transition-transform"
                      style={{ color: 'var(--tc-25)', transform: isExpanded ? 'rotate(90deg)' : undefined }}
                    />
                    <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--tc-75)' }}>{s.title}</span>
                    {insightCount && (
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--tc-35)' }}>{insightCount} insights</span>
                    )}
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--tc-25)' }}>{timeSince(s.created_at)}</span>
                  </button>
                  {isExpanded && (
                    <div className="mx-4 mb-2 rounded-xl p-3 overflow-y-auto" style={{ maxHeight: 280, background: 'var(--s-hover)', border: '1px solid var(--s-divider)' }}>
                      <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--tc-30)' }}>Raw content</p>
                      <pre className="text-[11px] whitespace-pre-wrap break-words" style={{ color: 'var(--tc-55)', fontFamily: 'inherit', lineHeight: 1.55 }}>
                        {s.raw_content}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
