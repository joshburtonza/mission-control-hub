-- Add gmail_thread_id column for deterministic dedup
-- Used by sophia-email-detector.sh to prevent the same email ever
-- being re-inserted, regardless of from/subject/timing.
--
-- Partial unique index (WHERE NOT NULL) so old rows without the field
-- don't conflict with each other.

ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_queue_gmail_thread_id
  ON email_queue(gmail_thread_id)
  WHERE gmail_thread_id IS NOT NULL;
