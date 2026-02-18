-- MISSION CONTROL DATABASE SCHEMA
-- OpenClaw Agent Management System

-- 1. AGENTS TABLE
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('csm', 'outreach', 'automation', 'monitor')),
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'idle', 'offline', 'error')),
  current_task TEXT,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  health_check BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. EMAIL_QUEUE TABLE
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  client TEXT CHECK (client IN ('ascend_lc', 'favorite_logistics', 'race_technik')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'awaiting_approval', 'approved', 'sent', 'skipped', 'rejected')),
  priority INT DEFAULT 0,
  requires_approval BOOLEAN DEFAULT false,
  analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. APPROVALS TABLE
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_queue_id UUID REFERENCES email_queue(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL CHECK (approval_type IN ('routine_response', 'escalation', 'terminal_command', 'task_execution')),
  request_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. AUDIT_LOG TABLE
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'pending')),
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_ms INT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. KILL_SWITCH TABLE
CREATE TABLE IF NOT EXISTS kill_switch (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'stopped')),
  reason TEXT,
  triggered_at TIMESTAMP WITH TIME ZONE,
  triggered_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TASK_QUEUE TABLE
CREATE TABLE IF NOT EXISTS task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('email_send', 'email_analysis', 'terminal_command', 'cron_job', 'reminder', 'task_execution')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'executing', 'completed', 'failed', 'skipped')),
  payload JSONB,
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  retry_count INT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  email_addresses TEXT[] NOT NULL,
  contact_person TEXT,
  project_name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. SOPHIA_CSM_CONFIG TABLE
CREATE TABLE IF NOT EXISTS sophia_csm_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  response_time_min INT DEFAULT 15,
  response_time_max INT DEFAULT 60,
  auto_response_enabled BOOLEAN DEFAULT true,
  escalation_keywords TEXT[],
  cc_emails TEXT[] DEFAULT ARRAY['josh@amalfiai.com', 'salah@amalfiai.com'],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. SYSTEM_CONFIG TABLE
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_client ON email_queue(client);
CREATE INDEX idx_email_queue_received ON email_queue(received_at DESC);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_email_queue ON approvals(email_queue_id);
CREATE INDEX idx_audit_log_agent ON audit_log(agent);
CREATE INDEX idx_audit_log_executed ON audit_log(executed_at DESC);
CREATE INDEX idx_task_queue_status ON task_queue(status);
CREATE INDEX idx_task_queue_agent ON task_queue(agent);

-- INITIAL DATA
INSERT INTO agents (name, role, status) VALUES
  ('Sophia CSM', 'csm', 'online'),
  ('Alex Outreach', 'outreach', 'idle'),
  ('System Monitor', 'monitor', 'online')
ON CONFLICT DO NOTHING;

INSERT INTO kill_switch (id, status) VALUES
  ('00000000-0000-0000-0000-000000000001', 'running')
ON CONFLICT DO NOTHING;

INSERT INTO clients (name, slug, email_addresses, project_name) VALUES
  ('Ascend LC', 'ascend_lc', ARRAY['riaan@ascendlc.co.za', 'andre@ascendlc.co.za'], 'QMS Guard'),
  ('Favorite Logistics', 'favorite_logistics', ARRAY['rapizo92@gmail.com'], 'FLAIR'),
  ('Race Technik', 'race_technik', ARRAY['racetechnik010@gmail.com'], 'Race Technik Platform')
ON CONFLICT (slug) DO NOTHING;
