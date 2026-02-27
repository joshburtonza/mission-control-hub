-- ─────────────────────────────────────────────────────────
-- Finances v2 — subscriptions, finance_config, interest rates
-- 2026-02-27
-- ─────────────────────────────────────────────────────────

-- 1. Add interest_rate column to debt_entries
ALTER TABLE public.debt_entries
  ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(5,2) DEFAULT 0;

-- 2. Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,                          -- 'business' | 'personal'
  amount       DECIMAL(10,2) NOT NULL,
  currency     TEXT DEFAULT 'ZAR',
  billing_cycle TEXT DEFAULT 'monthly',
  status       TEXT DEFAULT 'active',
  notes        TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.subscriptions FOR ALL USING (true) WITH CHECK (true);

-- 3. Finance config table (key/value store for manual values like Sajonix balance)
CREATE TABLE IF NOT EXISTS public.finance_config (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT UNIQUE NOT NULL,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.finance_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.finance_config FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────────────────

-- Sajonix cash balance
INSERT INTO public.finance_config (key, value)
VALUES ('sajonix_balance', '71000')
ON CONFLICT (key) DO NOTHING;

-- Vanta Studios — Feb 2026 retainer
INSERT INTO public.income_entries (client, project, amount, currency, status, month)
SELECT 'Vanta Studios', 'Retainer', 5500, 'ZAR', 'pending', '2026-02'
WHERE NOT EXISTS (
  SELECT 1 FROM public.income_entries
  WHERE client = 'Vanta Studios' AND month = '2026-02'
);

-- Seed debts (only if no debt entries exist yet)
INSERT INTO public.debt_entries (name, total_amount, remaining_amount, monthly_payment, interest_rate)
SELECT name, total_amount, remaining_amount, monthly_payment, interest_rate
FROM (VALUES
  ('FNB Credit Card (Cheyenne)',   80600::DECIMAL, 80600::DECIMAL, 2400::DECIMAL, 22::DECIMAL),
  ('Cheyenne Woolworths',          19000::DECIMAL, 19000::DECIMAL,  800::DECIMAL, 22::DECIMAL),
  ('Discovery CC',                 30898::DECIMAL, 30898::DECIMAL, 1000::DECIMAL, 20::DECIMAL),
  ('Takealot Mobicred',            30650::DECIMAL, 30650::DECIMAL,  900::DECIMAL, 20::DECIMAL),
  ('Discovery Credit (Cheyenne)',  14500::DECIMAL, 14500::DECIMAL,  700::DECIMAL, 20::DECIMAL),
  ('Standard Bank VISA',           32802::DECIMAL, 32802::DECIMAL, 1100::DECIMAL, 18::DECIMAL)
) AS v(name, total_amount, remaining_amount, monthly_payment, interest_rate)
WHERE NOT EXISTS (SELECT 1 FROM public.debt_entries);

-- Seed business subscriptions
INSERT INTO public.subscriptions (name, category, amount, currency, billing_cycle, status)
SELECT name, category, amount, currency, billing_cycle, status
FROM (VALUES
  ('Lovable',           'business', 500::DECIMAL,  'ZAR', 'monthly', 'active'),
  ('N8N',               'business', 400::DECIMAL,  'ZAR', 'monthly', 'active'),
  ('Marblism',          'business', 300::DECIMAL,  'ZAR', 'monthly', 'active'),
  ('ChatGPT',           'business', 500::DECIMAL,  'ZAR', 'monthly', 'active'),
  ('Claude Pro',        'business', 310::DECIMAL,  'ZAR', 'monthly', 'active'),
  ('Supabase',          'business', 500::DECIMAL,  'ZAR', 'monthly', 'active'),
  ('Google Workspace',  'business', 484::DECIMAL,  'ZAR', 'monthly', 'active'),
  ('WesBank Vehicle',   'personal', 5940::DECIMAL, 'ZAR', 'monthly', 'active'),
  ('Ambition Insurance','personal', 4000::DECIMAL, 'ZAR', 'monthly', 'active'),
  ('MVIA Insurance',    'personal', 1519::DECIMAL, 'ZAR', 'monthly', 'active'),
  ('Fiber',             'personal', 1100::DECIMAL, 'ZAR', 'monthly', 'active')
) AS v(name, category, amount, currency, billing_cycle, status)
WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions);
