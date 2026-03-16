-- Migrate monetary columns from dollars (numeric) to integer cents.
-- Run this after deploying the app changes that expect cents.

-- 1) Funds: total_budget, remaining_budget, max_request_amount -> cents
ALTER TABLE public.fund
  ALTER COLUMN total_budget TYPE bigint USING ROUND(COALESCE(total_budget, 0) * 100),
  ALTER COLUMN remaining_budget TYPE bigint USING ROUND(COALESCE(remaining_budget, 0) * 100),
  ALTER COLUMN max_request_amount TYPE bigint USING ROUND(COALESCE(max_request_amount, 0) * 100);

-- 2) Fund requests: requested_amount -> cents
ALTER TABLE public.fund_request
  ALTER COLUMN requested_amount TYPE bigint USING ROUND(COALESCE(requested_amount, 0) * 100);

-- 3) Routing rules: min_amount / max_amount thresholds -> cents
ALTER TABLE public.routing_rule
  ALTER COLUMN min_amount TYPE bigint USING ROUND(COALESCE(min_amount, 0) * 100),
  ALTER COLUMN max_amount TYPE bigint USING ROUND(COALESCE(max_amount, 0) * 100);

-- 4) Disbursements: amount_paid -> cents
ALTER TABLE public.disbursement
  ALTER COLUMN amount_paid TYPE bigint USING ROUND(COALESCE(amount_paid, 0) * 100);

-- Migrate monetary columns from dollars (numeric) to integer cents.
-- Run this after deploying the app changes that expect cents.

-- 1) Funds: total_budget, remaining_budget, max_request_amount -> cents
ALTER TABLE public.fund
  ALTER COLUMN total_budget TYPE bigint USING ROUND(COALESCE(total_budget, 0) * 100),
  ALTER COLUMN remaining_budget TYPE bigint USING ROUND(COALESCE(remaining_budget, 0) * 100),
  ALTER COLUMN max_request_amount TYPE bigint USING ROUND(COALESCE(max_request_amount, 0) * 100);

-- 2) Fund requests: requested_amount -> cents
ALTER TABLE public.fund_request
  ALTER COLUMN requested_amount TYPE bigint USING ROUND(COALESCE(requested_amount, 0) * 100);

-- 3) Routing rules: min_amount / max_amount thresholds -> cents
ALTER TABLE public.routing_rule
  ALTER COLUMN min_amount TYPE bigint USING ROUND(COALESCE(min_amount, 0) * 100),
  ALTER COLUMN max_amount TYPE bigint USING ROUND(COALESCE(max_amount, 0) * 100);

-- 4) Disbursements: amount_paid -> cents
ALTER TABLE public.disbursement
  ALTER COLUMN amount_paid TYPE bigint USING ROUND(COALESCE(amount_paid, 0) * 100);

