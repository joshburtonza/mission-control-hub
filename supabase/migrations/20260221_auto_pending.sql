-- Add auto_pending to status enum
ALTER TABLE email_queue DROP CONSTRAINT IF EXISTS email_queue_status_check;
ALTER TABLE email_queue ADD CONSTRAINT email_queue_status_check
  CHECK (status IN ('pending','analyzing','awaiting_approval','auto_pending','approved','sending','sent','skipped','rejected','error_send_failed'));

-- Add scheduled_send_at for veto window
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_send_at) WHERE status = 'auto_pending';
