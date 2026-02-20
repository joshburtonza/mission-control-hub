import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Check, Youtube, Linkedin, Video, Plus, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Script {
  id: string;
  title: string;
  platform: 'youtube' | 'tiktok' | 'linkedin' | 'twitter' | 'blog';
  body: string;
  generatedAt: string;
}

const PLATFORM_CONFIG = {
  youtube: { label: 'YouTube', color: 'bg-red-900/40 text-red-300 border-red-700/40', icon: Youtube },
  tiktok: { label: 'TikTok', color: 'bg-purple-900/40 text-purple-300 border-purple-700/40', icon: Video },
  linkedin: { label: 'LinkedIn', color: 'bg-blue-900/40 text-blue-300 border-blue-700/40', icon: Linkedin },
  twitter: { label: 'Twitter', color: 'bg-sky-900/40 text-sky-300 border-sky-700/40', icon: FileText },
  blog: { label: 'Blog', color: 'bg-green-900/40 text-green-300 border-green-700/40', icon: FileText },
} as const;

const TABS = ['TikTok', 'YouTube', 'Cold Outreach'] as const;
type Tab = typeof TABS[number];

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function formatDayLabel(d: Date) {
  return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export default function Content() {
  const [activeTab, setActiveTab] = useState<Tab>('TikTok');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scripts, setScripts] = useState<Script[]>([]);

  const today = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => startOfLocalDay(today), [today]);
  const tomorrowStart = useMemo(() => {
    const t = new Date(todayStart);
    t.setDate(t.getDate() + 1);
    return t;
  }, [todayStart]);

  useEffect(() => {
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
        // Best-effort: only refresh if the change smells like a Video Bot script (avoids constant refetch)
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
  }, [todayStart, tomorrowStart]);

  const handleCopy = (script: Script) => {
    const text = `${script.title}\n\n${script.body}`;
    navigator.clipboard.writeText(text);
    setCopiedId(script.id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerate = () => {
    toast.info('Queued for next Video Bot cron run (7am daily — 4 TikToks + YouTube on schedule days)');
  };

  const timeSince = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const filteredScripts = useMemo(() => {
    if (activeTab === 'TikTok') return scripts.filter(s => s.platform === 'tiktok');
    if (activeTab === 'YouTube') return scripts.filter(s => s.platform === 'youtube');
    return [];
  }, [activeTab, scripts]);

  const lastGeneratedAt = useMemo(() => {
    if (!scripts.length) return null;
    return scripts
      .map(s => new Date(s.generatedAt).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
  }, [scripts]);

  const headline = useMemo(() => {
    if (loading) return 'Loading scripts…';
    if (!scripts.length) return 'No scripts generated yet today';
    const tiktokCount = scripts.filter(s => s.platform === 'tiktok').length;
    const ytCount = scripts.filter(s => s.platform === 'youtube').length;
    const parts = [];
    if (tiktokCount) parts.push(`${tiktokCount} TikToks`);
    if (ytCount) parts.push(`${ytCount} YouTube`);
    return `${parts.join(' + ')} ready`;
  }, [loading, scripts]);

  return (
    <div className="space-y-4 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan">Content</h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            4 TikToks daily · YouTube Mon + Thu · {headline}
            {lastGeneratedAt ? ` · last generated ${timeSince(new Date(lastGeneratedAt).toISOString())}` : ''}
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          className="h-9 w-9 sm:w-auto sm:px-4 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-mono text-xs rounded-full sm:rounded-md"
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Generate</span>
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
        <div className="border border-border/30 rounded-lg p-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-mono text-sm text-muted-foreground">Cold Outreach — coming soon</p>
          <p className="font-mono text-xs text-muted-foreground/60 mt-1">Once your lead list is loaded, outreach cards will show here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Today label */}
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
                        <span className="font-mono text-[9px] text-muted-foreground">{timeSince(script.generatedAt)}</span>
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
              <p className="font-mono text-xs text-muted-foreground/60 mt-1">Next scheduled generation is 7am.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
