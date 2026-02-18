-- =============================================
-- TASKS TABLE (human-facing CRUD task management)
-- =============================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  assigned_to TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  tags TEXT[],
  metadata JSONB,
  created_by TEXT DEFAULT 'Josh',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.tasks FOR ALL USING (true);

-- =============================================
-- NOTIFICATIONS TABLE (replaces Discord channels)
-- =============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'system'
    CHECK (type IN ('email_inbound', 'email_sent', 'escalation', 'approval', 'heartbeat', 'outreach', 'repo', 'system', 'reminder')),
  title TEXT NOT NULL,
  body TEXT,
  agent TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'dismissed')),
  action_url TEXT,
  metadata JSONB,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.notifications FOR ALL USING (true);

-- Index for fast unread queries
CREATE INDEX IF NOT EXISTS notifications_status_idx ON public.notifications(status);
CREATE INDEX IF NOT EXISTS notifications_type_idx ON public.notifications(type);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks(status);
CREATE INDEX IF NOT EXISTS tasks_priority_idx ON public.tasks(priority);

-- =============================================
-- SEED: Initial agent data (for AgentCards)
-- =============================================
INSERT INTO public.agents (id, name, role, status, current_task, last_activity)
VALUES
  (gen_random_uuid(), 'Alex Claww', 'Main Orchestrator', 'online', 'Monitoring + chat', NOW()),
  (gen_random_uuid(), 'Sophia CSM', 'Customer Success', 'online', 'Email polling every 5min', NOW()),
  (gen_random_uuid(), 'Alex Outreach', 'Cold Outreach', 'idle', 'Waiting for lead list', NOW()),
  (gen_random_uuid(), 'Video Bot', 'Content Generation', 'idle', 'Runs daily at 7am', NOW()),
  (gen_random_uuid(), 'Repo Watcher', 'Code Monitoring', 'idle', 'Runs Tuesday 9am', NOW()),
  (gen_random_uuid(), 'Heartbeat', 'System Health', 'online', 'Monitoring system health', NOW())
ON CONFLICT DO NOTHING;
