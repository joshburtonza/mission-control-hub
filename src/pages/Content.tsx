import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Check, Youtube, Linkedin, Video, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSwipe } from '@/hooks/use-swipe';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Script {
  id: string;
  title: string;
  platform: 'youtube' | 'tiktok' | 'linkedin' | 'twitter' | 'blog';
  body: string;
  generatedAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const B = '#4B9EFF';

const PLATFORM_CONFIG = {
  youtube:  { label: 'YouTube',  icon: Youtube },
  tiktok:   { label: 'TikTok',   icon: Video },
  linkedin: { label: 'LinkedIn', icon: Linkedin },
  twitter:  { label: 'Twitter',  icon: FileText },
  blog:     { label: 'Blog',     icon: FileText },
} as const;

const TABS = ['TikTok', 'YouTube'] as const;
type Tab = typeof TABS[number];

// ── Helpers ────────────────────────────────────────────────────────────────────

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
  return `${Math.floor(h / 24)}d ago`;
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Content() {
  const [activeTab, setActiveTab] = useState<Tab>('TikTok');
  const [copiedId, setCopiedId]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [scripts, setScripts]     = useState<Script[]>([]);
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, -1 = yesterday, etc.

  const today = useMemo(() => new Date(), []);

  const selectedDay = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [today, dayOffset]);

  const selectedDayStart = useMemo(() => startOfLocalDay(selectedDay), [selectedDay]);
  const selectedDayEnd = useMemo(() => {
    const t = new Date(selectedDayStart);
    t.setDate(t.getDate() + 1);
    return t;
  }, [selectedDayStart]);

  const isToday = dayOffset === 0;

  useEffect(() => {
    let cancelled = false;

    const fetchScripts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('id,title,description,tags,created_at,created_by')
        .eq('created_by', 'Video Bot')
        .gte('created_at', selectedDayStart.toISOString())
        .lt('created_at', selectedDayEnd.toISOString())
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (error) {
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
      .channel(`content_scripts_${dayOffset}`)
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
  }, [selectedDayStart, selectedDayEnd, dayOffset]);

  const tabIndex = TABS.indexOf(activeTab);

  const { handlers: swipeHandlers } = useSwipe({
    lockAxis: 'horizontal',
    threshold: 60,
    onSwipeLeft:  () => setActiveTab(TABS[Math.min(tabIndex + 1, TABS.length - 1)]),
    onSwipeRight: () => setActiveTab(TABS[Math.max(tabIndex - 1, 0)]),
  });

  const handleCopy = (script: Script) => {
    navigator.clipboard.writeText(`${script.title}\n\n${script.body}`);
    setCopiedId(script.id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredScripts = useMemo(() => {
    if (activeTab === 'TikTok')  return scripts.filter(s => s.platform === 'tiktok');
    if (activeTab === 'YouTube') return scripts.filter(s => s.platform === 'youtube');
    return [];
  }, [activeTab, scripts]);

  const lastGeneratedAt = useMemo(() => {
    if (!scripts.length) return null;
    return scripts.map(s => new Date(s.generatedAt).getTime()).reduce((a, b) => Math.max(a, b), 0);
  }, [scripts]);

  const headline = useMemo(() => {
    if (loading) return 'Loading scripts…';
    if (!scripts.length) return isToday ? 'No scripts generated yet today' : 'No scripts for this day';
    const tiktokCount = scripts.filter(s => s.platform === 'tiktok').length;
    const ytCount     = scripts.filter(s => s.platform === 'youtube').length;
    const parts = [];
    if (tiktokCount) parts.push(`${tiktokCount} TikToks`);
    if (ytCount)     parts.push(`${ytCount} YouTube`);
    return `${parts.join(' + ')} ready`;
  }, [loading, scripts, isToday]);

  return (
    <div className="space-y-4 pb-24 sm:pb-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--tc-85)' }}>Content</h1>
        <p className="text-xs mt-1" style={{ color: 'var(--tc-35)' }}>
          4 TikToks daily · YouTube Mon + Thu · {headline}
          {lastGeneratedAt ? ` · last generated ${timeSince(new Date(lastGeneratedAt).toISOString())}` : ''}
        </p>
      </div>

      {/* Day navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setDayOffset(o => Math.max(o - 1, -6))}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: dayOffset <= -6 ? 'var(--tc-15)' : 'var(--tc-50)', background: 'var(--s-card)' }}
          disabled={dayOffset <= -6}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--tc-70)' }}>
            {isToday ? 'Today' : dayOffset === -1 ? 'Yesterday' : formatDayLabel(selectedDay)}
          </span>
          {!isToday && (
            <button
              onClick={() => setDayOffset(0)}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: `${B}12`, color: `${B}cc`, border: `1px solid ${B}25` }}
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={() => setDayOffset(o => Math.min(o + 1, 0))}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: isToday ? 'var(--tc-15)' : 'var(--tc-50)', background: 'var(--s-card)' }}
          disabled={isToday}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b pb-0" style={{ borderColor: 'var(--s-divider)' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="text-xs px-3 py-2 border-b-2 transition-colors"
            style={activeTab === tab
              ? { borderBottomColor: B, color: B }
              : { borderBottomColor: 'transparent', color: 'var(--tc-40)' }
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Scripts — swipe left/right to switch tabs on mobile */}
      <div className="space-y-3" {...swipeHandlers}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--tc-30)' }}>
            {isToday ? 'Today' : formatDayLabel(selectedDay)}
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--s-divider)' }} />
          <Badge className="text-[9px]" style={{ background: `${B}12`, color: `${B}cc`, border: `1px solid ${B}25` }}>
            {activeTab === 'YouTube' ? `${filteredScripts.length} YouTube` : `${filteredScripts.length} TikToks`}
          </Badge>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ border: '1px solid var(--s-divider)', borderRadius: '16px' }}>
            <FileText className="h-8 w-8" style={{ color: 'var(--tc-15)' }} />
            <p className="text-sm" style={{ color: 'var(--tc-30)' }}>Loading…</p>
          </div>
        ) : filteredScripts.length > 0 ? (
          filteredScripts.map(script => {
            const pc = PLATFORM_CONFIG[script.platform];
            const PlatformIcon = pc.icon;
            const isCopied = copiedId === script.id;
            return (
              <div
                key={script.id}
                style={{
                  background: 'var(--s-card)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid var(--s-card-b)', borderRadius: '16px', transition: 'border-color 0.15s',
                }}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: `${B}12`, color: `${B}cc`, border: `1px solid ${B}25` }}>
                        <PlatformIcon className="h-2.5 w-2.5" />
                        {pc.label}
                      </span>
                      <span className="text-[9px]" style={{ color: 'var(--tc-25)' }}>{timeSince(script.generatedAt)}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(script)}
                      className="shrink-0 transition-colors"
                      style={{ color: isCopied ? B : 'var(--tc-30)' }}
                    >
                      {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <h3 className="text-sm font-semibold mb-2 leading-snug" style={{ color: 'var(--tc-85)' }}>{script.title}</h3>
                  <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'var(--tc-40)' }}>{script.body}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ border: '1px solid var(--s-divider)', borderRadius: '16px' }}>
            <FileText className="h-8 w-8" style={{ color: 'var(--tc-15)' }} />
            <p className="text-sm" style={{ color: 'var(--tc-30)' }}>
              {activeTab === 'YouTube'
                ? `No YouTube scripts for ${isToday ? 'today' : formatDayLabel(selectedDay)}`
                : `No TikTok scripts for ${isToday ? 'today' : formatDayLabel(selectedDay)}`}
            </p>
            {isToday ? (
              <p className="text-xs" style={{ color: 'var(--tc-20)' }}>
                Generation failed today. Use ← to see previous days.
              </p>
            ) : (
              <p className="text-xs" style={{ color: 'var(--tc-20)' }}>
                No scripts were generated on this day.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
