-- Add attachments + sent_at to email_queue for weekly PDF reports

ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS attachments JSONB,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;

-- Helpful index when filtering unsent approved emails
CREATE INDEX IF NOT EXISTS idx_email_queue_sent_at ON public.email_queue(sent_at);
