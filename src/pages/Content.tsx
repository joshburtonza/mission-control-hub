import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Check, Youtube, Linkedin, Video, Plus, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Script {
  id: string;
  title: string;
  platform: 'youtube' | 'tiktok' | 'linkedin' | 'twitter' | 'blog';
  body: string;
  generatedAt: string;
}

const TODAY_SCRIPTS: Script[] = [
  {
    id: '1',
    title: 'We Built a Command Centre for Our Agency in 72 Hours',
    platform: 'tiktok',
    body: `Kill switch on the wall. Live agent status. Email queue with one-click approvals. Debt tracker. Income graphs.

All of it live in 72 hours.

This is Mission Control. Built with Lovable, Supabase, and Claude Code. Running 24/7 on a MacBook Air.

Drop a follow — full build breakdown coming this week.`,
    generatedAt: '2026-02-19T07:00:00Z',
  },
  {
    id: '2',
    title: 'How Our AI Agent Sophia Handles Client Emails While We Sleep',
    platform: 'tiktok',
    body: `5am. Client emails Sophia. Sophia reads it, drafts a reply in 5 seconds, queues it for approval.

By the time Josh wakes up — response is ready, one tap to send.

Client thinks you are always on. You were actually asleep.

This is what agency automation looks like in 2026.`,
    generatedAt: '2026-02-19T07:00:00Z',
  },
  {
    id: '3',
    title: 'The SA Agency Owner Working 3 Hours a Day',
    platform: 'tiktok',
    body: `3 clients. R71k a month. 3 hours of actual work per day.

The rest? Automated.

Cold outreach runs at 9am. Sophia handles client emails. Video Bot generates content. Repo Watcher monitors client code.

All on a MacBook Air. No team. No office. No burnout.

This is the agency model we are building. Comment SYSTEM if you want the breakdown.`,
    generatedAt: '2026-02-19T07:00:00Z',
  },
  {
    id: '4',
    title: 'Why I Stopped Replying to Client Emails Myself',
    platform: 'tiktok',
    body: `I used to spend 2 hours a day just on client email.

Now I spend 5 minutes reviewing what Sophia already drafted.

She catches every email. Reads the context. Writes a warm human response in SA English. Queues it for my approval.

I click approve. Done.

This is not AI replacing relationships. This is AI protecting your time so you can actually be present for the relationships that matter.`,
    generatedAt: '2026-02-19T07:00:00Z',
  },
];

const PLATFORM_CONFIG = {
  youtube:  { label: 'YouTube',  color: 'bg-red-900/40 text-red-300 border-red-700/40',      icon: Youtube },
  tiktok:   { label: 'TikTok',   color: 'bg-purple-900/40 text-purple-300 border-purple-700/40', icon: Video },
  linkedin: { label: 'LinkedIn', color: 'bg-blue-900/40 text-blue-300 border-blue-700/40',   icon: Linkedin },
  twitter:  { label: 'Twitter',  color: 'bg-sky-900/40 text-sky-300 border-sky-700/40',      icon: FileText },
  blog:     { label: 'Blog',     color: 'bg-green-900/40 text-green-300 border-green-700/40', icon: FileText },
};

const TABS = ['TikTok', 'YouTube', 'Cold Outreach'] as const;
type Tab = typeof TABS[number];

export default function Content() {
  const [activeTab, setActiveTab] = useState<Tab>('TikTok');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  return (
    <div className="space-y-4 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan">Content</h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            4 TikToks daily · 2 YouTube per week · Generated at 7am
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
      {activeTab === 'TikTok' ? (
        <div className="space-y-3">
          {/* Today label */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Today — Feb 19, 2026</span>
            <div className="flex-1 h-px bg-border/30" />
            <Badge className="font-mono text-[9px] bg-primary/10 text-primary border-primary/30">
              4 TikToks
            </Badge>
          </div>

          {TODAY_SCRIPTS.map(script => {
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
                      {isCopied
                        ? <Check className="h-4 w-4 text-success" />
                        : <Copy className="h-4 w-4" />
                      }
                    </button>
                  </div>

                  <h3 className="font-mono text-sm font-semibold text-foreground mb-2 leading-snug">
                    {script.title}
                  </h3>

                  <p className="font-mono text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                    {script.body}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="border border-border/30 rounded-lg p-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-mono text-sm text-muted-foreground">
            {activeTab === 'YouTube' ? 'YouTube — 2 scripts per week' : `${activeTab} — coming soon`}
          </p>
          <p className="font-mono text-xs text-muted-foreground/60 mt-1">
            {activeTab === 'YouTube' ? 'Scripts will appear on YouTube days once schedule is set' : 'Being built in the next sprint'}
          </p>
        </div>
      )}
    </div>
  );
}
