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
    title: 'How We Cut Client Email Response Time From 2 Hours to 90 Seconds',
    platform: 'youtube',
    body: `Most agencies are still manually reading every email and typing responses from scratch.

We built an AI agent called Sophia that reads incoming client emails, drafts a response in under 5 seconds, and sends it after a human spot-check.

Here is exactly how we did it and why it matters for your agency in 2026.

The system runs 24/7 on a Mac. No cloud server. No API costs beyond the subscription. Sophia checks every 5 minutes, analyzes the email, drafts a response in SA English — no dashes, no corporate robot speak — and queues it for approval.

One click. Sent. Client thinks you are on it within minutes. You barely lifted a finger.

This is what agency automation actually looks like.`,
    generatedAt: '2026-02-19T07:00:00Z',
  },
  {
    id: '2',
    title: '3 Signs Your Agency Is Ready to Automate Client Success',
    platform: 'linkedin',
    body: `You know your agency is ready to automate when:

1. You are copy-pasting the same 5 responses every week.
2. Your team is drowning in low-value email threads.
3. You have zero visibility into what your agents are actually doing.

We fixed all three with one system. Here is the breakdown.

Sophia CSM handles all incoming client emails — Ascend LC, Favorite Logistics, Race Technik. She reads, drafts, and queues responses for approval. Every action logs to a task board. Every escalation pings Josh on Telegram.

No more inbox anxiety. No more missed emails. No more manual copy-paste.

If you are running 3 or more clients and still doing this manually, you are leaving serious time on the table.

What are you automating in 2026?`,
    generatedAt: '2026-02-19T07:00:00Z',
  },
  {
    id: '3',
    title: 'We Built a Command Centre for Our Entire Agency in 72 Hours',
    platform: 'tiktok',
    body: `Kill switch on the wall. Live agent status. Email queue with one-click approvals. Debt tracker. Income graphs. All of it live in 72 hours.

This is Mission Control — built with Lovable, Supabase, and Claude Code.

Alex Claww is the orchestrator. Sophia handles CSM. Alex Outreach does cold email. Video Bot generates scripts. Repo Watcher monitors client code.

Everything logs to a task board so I always know what is running, what is done, and what needs my attention.

Full tour in the next video. Drop a follow if you want to see how we built this.`,
    generatedAt: '2026-02-19T07:00:00Z',
  },
  {
    id: '4',
    title: 'Why South African Agencies Are Sleeping on AI Automation',
    platform: 'youtube',
    body: `While most SA agencies are still quoting manually and responding to emails at 11pm, we automated our entire client success pipeline.

Sophia handles the emails.
Alex handles cold outreach.
Josh handles the actual strategy.

This is how you scale without hiring.

The barrier most people think exists — cost, complexity, server infrastructure — does not. We run everything on a MacBook Air. The whole system costs less than one junior hire per month.

The only thing holding SA agencies back is not knowing this is possible. Now you know.

Here is the full breakdown of what we built and how you can do the same thing.`,
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

const TABS = ['Video Scripts', 'Blog Posts', 'Cold Outreach'] as const;
type Tab = typeof TABS[number];

export default function Content() {
  const [activeTab, setActiveTab] = useState<Tab>('Video Scripts');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (script: Script) => {
    const text = `${script.title}\n\n${script.body}`;
    navigator.clipboard.writeText(text);
    setCopiedId(script.id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerate = () => {
    toast.info('Queued for next Video Bot cron run (7am daily)');
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
            Scripts and content — generated daily at 7am
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
      {activeTab === 'Video Scripts' ? (
        <div className="space-y-3">
          {/* Today label */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Today — Feb 19, 2026</span>
            <div className="flex-1 h-px bg-border/30" />
            <Badge className="font-mono text-[9px] bg-warning/10 text-warning border-warning/30">
              Missed 7am cron — manual seed
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
          <p className="font-mono text-sm text-muted-foreground">{activeTab} — coming soon</p>
          <p className="font-mono text-xs text-muted-foreground/60 mt-1">Being built in the next sprint</p>
        </div>
      )}
    </div>
  );
}
