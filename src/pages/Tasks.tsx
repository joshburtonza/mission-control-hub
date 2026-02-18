import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { ListTodo, Zap, CheckCircle2, XCircle, Clock, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskItem {
  id: string;
  agent: string | null;
  task_type: string | null;
  status: string | null;
  payload: any;
  result: any;
  created_at: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  retry_count?: number | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode; col: string }> = {
  queued:    { label: 'Queued',     color: 'bg-warning/10 text-warning border-warning/30',         icon: <Clock className="h-3 w-3" />,       col: 'border-warning/30' },
  executing: { label: 'Executing',  color: 'bg-primary/10 text-primary border-primary/30',         icon: <Loader2 className="h-3 w-3 animate-spin" />, col: 'border-primary/30' },
  completed: { label: 'Completed',  color: 'bg-success/10 text-success border-success/30',         icon: <CheckCircle2 className="h-3 w-3" />, col: 'border-success/30' },
  failed:    { label: 'Failed',     color: 'bg-destructive/10 text-destructive border-destructive/30', icon: <XCircle className="h-3 w-3" />,  col: 'border-destructive/30' },
  skipped:   { label: 'Skipped',    color: 'bg-muted/10 text-muted-foreground border-border/30',   icon: <XCircle className="h-3 w-3" />,      col: 'border-border/30' },
};

const taskTypeLabels: Record<string, string> = {
  email_send:       'Email Send',
  email_analysis:   'Email Analysis',
  terminal_command: 'Terminal Command',
  cron_job:         'Cron Job',
  reminder:         'Reminder',
  task_execution:   'Task Execution',
};

const columns: Array<{ key: string; label: string; icon: React.ReactNode }> = [
  { key: 'queued',    label: 'Queued',    icon: <Clock className="h-4 w-4 text-warning" /> },
  { key: 'executing', label: 'Running',   icon: <Loader2 className="h-4 w-4 text-primary animate-spin" /> },
  { key: 'completed', label: 'Completed', icon: <CheckCircle2 className="h-4 w-4 text-success" /> },
  { key: 'failed',    label: 'Failed',    icon: <XCircle className="h-4 w-4 text-destructive" /> },
];

export default function Tasks() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  useEffect(() => {
    fetchTasks();
    const channel = supabase
      .channel('task_queue_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_queue' }, fetchTasks)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('task_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error) setTasks(data || []);
    setLoading(false);
  };

  const byStatus = (status: string) => tasks.filter(t => t.status === status);

  const totalToday = tasks.filter(t => {
    if (!t.created_at) return false;
    const d = new Date(t.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold tracking-wider text-foreground glow-cyan">Task Board</h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Live task queue · {byStatus('executing').length} running · {byStatus('queued').length} queued · {totalToday} today
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Queued',    value: byStatus('queued').length,    color: 'text-warning' },
          { label: 'Running',   value: byStatus('executing').length, color: 'text-primary' },
          { label: 'Completed', value: byStatus('completed').length, color: 'text-success' },
          { label: 'Failed',    value: byStatus('failed').length,    color: 'text-destructive' },
          { label: 'Total',     value: tasks.length,                 color: 'text-foreground' },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border/50 rounded-md px-3 py-2">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            <p className={cn('font-display text-xl', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="font-mono text-xs text-muted-foreground animate-pulse">Loading tasks...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {columns.map(col => {
            const colTasks = byStatus(col.key);
            const sc = statusConfig[col.key];
            return (
              <div key={col.key} className={cn('rounded-md border', sc.col)}>
                <div className="p-3 border-b border-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {col.icon}
                    <span className="font-mono text-xs text-foreground tracking-wide">{col.label}</span>
                  </div>
                  <Badge className={cn('text-[9px] font-mono border', sc.color)}>{colTasks.length}</Badge>
                </div>
                <ScrollArea className="h-80">
                  <div className="p-2 space-y-1.5">
                    {colTasks.length === 0 ? (
                      <p className="text-[10px] font-mono text-muted-foreground text-center py-6">Empty</p>
                    ) : (
                      colTasks.map(task => (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                          className={cn(
                            'p-2.5 rounded border cursor-pointer transition-all duration-150',
                            selectedTask?.id === task.id
                              ? 'border-primary/50 bg-secondary/80'
                              : 'border-border/30 bg-secondary/10 hover:border-primary/30 hover:bg-secondary/30'
                          )}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-[10px] text-foreground/90 truncate">
                                {taskTypeLabels[task.task_type || ''] || task.task_type}
                              </p>
                              <p className="font-mono text-[9px] text-muted-foreground truncate mt-0.5">
                                {task.agent || 'Unknown'}
                              </p>
                            </div>
                          </div>
                          <p className="font-mono text-[8px] text-muted-foreground/60 mt-1">
                            {task.created_at ? new Date(task.created_at).toLocaleString() : ''}
                          </p>
                          {task.retry_count != null && task.retry_count > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <RefreshCw className="h-2.5 w-2.5 text-warning" />
                              <span className="font-mono text-[8px] text-warning">Retry #{task.retry_count}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      )}

      {/* Task detail panel */}
      {selectedTask && (
        <Card className="border-primary/30 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-display tracking-wide">Task Detail</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Type',    value: taskTypeLabels[selectedTask.task_type || ''] || selectedTask.task_type },
                { label: 'Agent',   value: selectedTask.agent },
                { label: 'Status',  value: selectedTask.status },
                { label: 'Retries', value: String(selectedTask.retry_count ?? 0) },
              ].map(item => (
                <div key={item.label}>
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className="font-mono text-xs text-foreground mt-0.5">{item.value || '—'}</p>
                </div>
              ))}
            </div>
            {selectedTask.payload && (
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Payload</p>
                <ScrollArea className="h-20 mt-0.5">
                  <pre className="font-mono text-[10px] text-accent bg-secondary/50 p-2 rounded">
                    {JSON.stringify(selectedTask.payload, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}
            {selectedTask.result && (
              <div>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Result</p>
                <ScrollArea className="h-20 mt-0.5">
                  <pre className="font-mono text-[10px] text-success bg-secondary/50 p-2 rounded">
                    {JSON.stringify(selectedTask.result, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
