-- Income tracking
CREATE TABLE IF NOT EXISTS public.income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client TEXT NOT NULL,
  project TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'invoice_sent', 'paid')),
  month TEXT NOT NULL, -- YYYY-MM format
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.income_entries FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS income_entries_month_idx ON public.income_entries(month);

-- Debt tracking
CREATE TABLE IF NOT EXISTS public.debt_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  remaining_amount DECIMAL(10,2) NOT NULL,
  monthly_payment DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.debt_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.debt_entries FOR ALL USING (true);

-- Seed real income data
INSERT INTO public.income_entries (client, project, amount, status, month) VALUES
  ('Ascend LC',          'QMS Guard',          30000, 'paid',         '2026-01'),
  ('Favorite Logistics', 'FLAIR ERP',           20000, 'paid',         '2026-01'),
  ('Race Technik',       'Detailing Platform',  21500, 'paid',         '2026-01'),
  ('Ascend LC',          'QMS Guard',          30000, 'invoice_sent', '2026-02'),
  ('Favorite Logistics', 'FLAIR ERP',           20000, 'pending',      '2026-02'),
  ('Race Technik',       'Detailing Platform',  21500, 'pending',      '2026-02')
ON CONFLICT DO NOTHING;
