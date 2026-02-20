-- Work tracking: events + daily rollups

CREATE TABLE IF NOT EXISTS public.work_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  category TEXT NOT NULL CHECK (category IN (
    'openclaw_chat',
    'openclaw_config',
    'development',
    'client_repo_movement',
    'csm_handling',
    'client_reports',
    'ops_monitoring'
  )),
  source TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
  duration_ms INT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_events_ts ON public.work_events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_work_events_category ON public.work_events(category);

CREATE TABLE IF NOT EXISTS public.work_daily_rollups (
  day DATE PRIMARY KEY,
  total_active_minutes INT NOT NULL DEFAULT 0,
  by_category JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
