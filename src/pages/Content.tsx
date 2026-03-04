import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Check, Youtube, Linkedin, Video, FileText, ChevronDown, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

function toLocalDateKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDayLabel(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (dateKey === todayKey) return 'Today';
  if (dateKey === yesterdayKey) return 'Yesterday';

  const dayName = new Intl.DateTimeFormat('en-ZA', { weekday: 'short' }).format(date);
  const label = new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short' }).format(date);
  return `${dayName} ${label}`;
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
  const [allScripts, setAllScripts] = useState<Script[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(''); // YYYY-MM-DD key

  // Fetch ALL Video Bot scripts (recent, up to 200)
  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('id,title,description,tags,created_at,created_by')
        .eq('created_by', 'Video Bot')
        .order('created_at', { ascending: false })
        .limit(200);

      if (cancelled) return;

      if (error) {
        toast.error('Failed to load content scripts');
        setAllScripts([]);
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

      setAllScripts(mapped);

      // Auto-select the most recent day that has scripts
      if (mapped.length > 0) {
        const firstDay = toLocalDateKey(mapped[0].generatedAt);
        setSelectedDay(firstDay);
      }

      setLoading(false);
    };

    fetchAll();

    // Realtime: refetch when tasks change
    const channel = supabase
      .channel('content_scripts_all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
        const row: any = payload.new || payload.old;
        if (row?.created_by === 'Video Bot') fetchAll();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Group scripts by local day → get available days
  const availableDays = useMemo(() => {
    const dayMap = new Map<string, { tiktoks: number; youtubes: number }>();
    for (const s of allScripts) {
      const key = toLocalDateKey(s.generatedAt);
      const entry = dayMap.get(key) || { tiktoks: 0, youtubes: 0 };
      if (s.platform === 'tiktok') entry.tiktoks++;
      if (s.platform === 'youtube') entry.youtubes++;
      dayMap.set(key, entry);
    }
    // Sort newest first
    return Array.from(dayMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, counts]) => ({ key, ...counts }));
  }, [allScripts]);

  // Scripts for the selected day
  const dayScripts = useMemo(() => {
    if (!selectedDay) return [];
    return allScripts.filter(s => toLocalDateKey(s.generatedAt) === selectedDay);
  }, [allScripts, selectedDay]);

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
    if (activeTab === 'TikTok')  return dayScripts.filter(s => s.platform === 'tiktok');
    if (activeTab === 'YouTube') return dayScripts.filter(s => s.platform === 'youtube');
    return [];
  }, [activeTab, dayScripts]);

  const selectedDayInfo = availableDays.find(d => d.key === selectedDay);

  const headline = useMemo(() => {
    if (loading) return 'Loading scripts…';
    if (!allScripts.length) return 'No scripts generated yet';
    const total = allScripts.length;
    const days = availableDays.length;
    return `${total} scripts across ${days} day${days === 1 ? '' : 's'}`;
  }, [loading, allScripts, availableDays]);

  return (
    <div className="space-y-4 pb-24 sm:pb-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--tc-85)' }}>Content</h1>
        <p className="text-xs mt-1" style={{ color: 'var(--tc-35)' }}>
          4 TikToks daily · YouTube Mon + Thu · {headline}
        </p>
      </div>

      {/* Day picker dropdown */}
      {availableDays.length > 0 && (
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 shrink-0" style={{ color: 'var(--tc-30)' }} />
          <Select value={selectedDay} onValueChange={setSelectedDay}>
            <SelectTrigger
              className="flex-1 h-9 text-sm border-0"
              style={{
                background: 'var(--s-card)',
                color: 'var(--tc-70)',
                borderRadius: '10px',
              }}
            >
              <SelectValue placeholder="Pick a day" />
            </SelectTrigger>
            <SelectContent
              style={{
                background: 'var(--s-card)',
                border: '1px solid var(--s-card-b)',
                borderRadius: '12px',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              {availableDays.map(day => {
                const parts = [];
                if (day.tiktoks) parts.push(`${day.tiktoks} TikTok${day.tiktoks > 1 ? 's' : ''}`);
                if (day.youtubes) parts.push(`${day.youtubes} YT`);
                return (
                  <SelectItem
                    key={day.key}
                    value={day.key}
                    className="text-sm cursor-pointer"
                    style={{ color: 'var(--tc-70)' }}
                  >
                    {formatDayLabel(day.key)} — {parts.join(' + ')}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

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
            {selectedDay ? formatDayLabel(selectedDay) : 'No day selected'}
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
              {!selectedDay
                ? 'No content scripts found'
                : activeTab === 'YouTube'
                  ? `No YouTube scripts for ${formatDayLabel(selectedDay)}`
                  : `No TikTok scripts for ${formatDayLabel(selectedDay)}`}
            </p>
            {availableDays.length > 0 && (
              <p className="text-xs" style={{ color: 'var(--tc-20)' }}>
                Pick another day from the dropdown above.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
