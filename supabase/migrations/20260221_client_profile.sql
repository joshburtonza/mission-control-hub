-- Add rich structured profile to clients table
-- profile JSONB stores deep per-client knowledge:
--   business_context, current_project, team, pending_decisions,
--   communication_style, hard_rules, opportunities, sentiment,
--   github_repos

ALTER TABLE clients ADD COLUMN IF NOT EXISTS profile JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sentiment TEXT
  CHECK (sentiment IN ('positive','neutral','cautious','at_risk'));
