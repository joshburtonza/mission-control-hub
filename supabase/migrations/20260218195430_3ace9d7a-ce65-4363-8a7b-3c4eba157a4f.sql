
-- Add missing columns to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived'));
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create system_config table
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to agents table
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS health_check BOOLEAN DEFAULT true;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add missing columns to approvals table
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add missing columns to audit_log table
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS duration_ms INT;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add missing columns to email_queue table
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS priority INT DEFAULT 0;
ALTER TABLE public.email_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add missing columns to task_queue table
ALTER TABLE public.task_queue ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.task_queue ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.task_queue ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
ALTER TABLE public.task_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
