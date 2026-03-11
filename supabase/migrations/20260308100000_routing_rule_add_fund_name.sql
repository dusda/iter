-- Add fund_name to routing_rule (present in CSV export, missing from initial schema)
ALTER TABLE public.routing_rule ADD COLUMN IF NOT EXISTS fund_name text;
