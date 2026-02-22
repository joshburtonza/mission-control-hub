-- Group chat history — shared context for all Telegram bots
-- JoshAmalfiBot writes every group message here
-- RaceTechnikAiBot (and any other bot) reads from here before responding

CREATE TABLE IF NOT EXISTS group_chat_history (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id     TEXT        NOT NULL,
  ts          TIMESTAMPTZ DEFAULT NOW(),
  sender      TEXT        NOT NULL,
  is_bot      BOOLEAN     DEFAULT FALSE,
  message     TEXT        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_group_chat_history_chat_ts
  ON group_chat_history(chat_id, ts DESC);

-- Keep table lean: auto-delete messages older than 7 days
-- (run this periodically or via a cron)
-- DELETE FROM group_chat_history WHERE ts < NOW() - INTERVAL '7 days';

-- RLS: service role writes, anon reads (bots can read without service key)
ALTER TABLE group_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON group_chat_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anon read-only" ON group_chat_history
  FOR SELECT TO anon USING (true);
