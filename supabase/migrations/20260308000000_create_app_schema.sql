-- App schema: organizations, funds, requests, reviews, disbursements, notifications, audit.
-- Run with: psql -h localhost -p 54322 -U supabase_admin -d postgres -f supabase/migrations/20260308000000_create_app_schema.sql

-- Organizations
CREATE TABLE IF NOT EXISTS public.organization (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text,
  logo text,
  description text,
  welcome_message text,
  status text DEFAULT 'active',
  created_date timestamptz DEFAULT now(),
  updated_date timestamptz DEFAULT now(),
  created_by_id text,
  created_by text,
  is_sample boolean DEFAULT false
);

-- App settings (singleton per deployment)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY,
  organization_name text,
  organization_logo text,
  organization_description text,
  welcome_message text,
  is_singleton boolean DEFAULT false,
  created_date timestamptz DEFAULT now(),
  updated_date timestamptz DEFAULT now(),
  created_by_id text,
  created_by text,
  is_sample boolean DEFAULT false
);

-- Funds (belong to an organization)
CREATE TABLE IF NOT EXISTS public.fund (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  fund_name text NOT NULL,
  description text,
  fund_owner_id text,
  fund_owner_name text,
  total_budget numeric,
  remaining_budget numeric,
  max_request_amount numeric,
  start_date date,
  end_date date,
  status text DEFAULT 'active',
  requires_attachments boolean DEFAULT false,
  budget_enforcement text,
  allowed_categories text,
  custom_categories jsonb,
  application_fields jsonb,
  eligibility_notes text,
  created_date timestamptz DEFAULT now(),
  updated_date timestamptz DEFAULT now(),
  created_by_id text,
  created_by text,
  is_sample boolean DEFAULT false
);

-- Routing rules (workflow steps per fund)
CREATE TABLE IF NOT EXISTS public.routing_rule (
  id text PRIMARY KEY,
  fund_id text NOT NULL REFERENCES public.fund(id) ON DELETE CASCADE,
  fund_name text,
  organization_id text NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  step_name text NOT NULL,
  assigned_role text,
  assigned_to_type text,
  assigned_user_ids text,
  assigned_user_names text,
  permissions text,
  sla_target_days integer,
  min_amount numeric,
  max_amount numeric,
  applicable_categories text,
  is_active boolean DEFAULT true,
  created_date timestamptz DEFAULT now(),
  updated_date timestamptz DEFAULT now(),
  created_by_id text,
  created_by text,
  is_sample boolean DEFAULT false
);

-- Access requests (e.g. student requesting access to org)
CREATE TABLE IF NOT EXISTS public.access_request (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  organization_name text,
  full_name text,
  email text,
  phone text,
  student_id text,
  reason text,
  status text DEFAULT 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  created_date timestamptz DEFAULT now(),
  updated_date timestamptz DEFAULT now(),
  created_by_id text,
  created_by text,
  is_sample boolean DEFAULT false
);

-- Fund requests (applications for a fund)
CREATE TABLE IF NOT EXISTS public.fund_request (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  fund_id text NOT NULL REFERENCES public.fund(id) ON DELETE CASCADE,
  fund_name text,
  request_id text,
  status text NOT NULL,
  current_step text,
  current_step_order integer,
  student_user_id text,
  student_full_name text,
  student_email text,
  student_phone text,
  requested_amount numeric,
  intended_use_category text,
  intended_use_description text,
  justification_paragraph text,
  attachments jsonb,
  advisor_user_id text,
  advisor_name text,
  advisor_tasks_completed boolean DEFAULT false,
  submitted_at timestamptz,
  locked boolean DEFAULT false,
  created_date timestamptz DEFAULT now(),
  updated_date timestamptz DEFAULT now(),
  created_by_id text,
  created_by text,
  is_sample boolean DEFAULT false
);

-- Reviews (one per workflow step per fund request)
CREATE TABLE IF NOT EXISTS public.review (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  fund_request_id text NOT NULL REFERENCES public.fund_request(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  step_name text,
  permissions text,
  reviewer_user_id text,
  reviewer_name text,
  decision text,
  decided_at timestamptz,
  comments text,
  sla_target_days integer,
  created_date timestamptz DEFAULT now(),
  updated_date timestamptz DEFAULT now(),
  created_by_id text,
  created_by text,
  is_sample boolean DEFAULT false
);

-- Disbursements (payments against approved requests)
CREATE TABLE IF NOT EXISTS public.disbursement (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  fund_request_id text NOT NULL REFERENCES public.fund_request(id) ON DELETE CASCADE,
  fund_id text NOT NULL REFERENCES public.fund(id) ON DELETE CASCADE,
  fund_name text,
  student_name text,
  amount_paid numeric NOT NULL,
  payment_method text,
  paid_at timestamptz,
  notes text,
  receipt_upload text,
  created_date timestamptz DEFAULT now(),
  updated_date timestamptz DEFAULT now(),
  created_by_id text,
  created_by text,
  is_sample boolean DEFAULT false
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notification (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  user_id text,
  user_email text,
  related_entity_type text,
  related_entity_id text,
  type text,
  title text,
  message text,
  link text,
  is_read boolean DEFAULT false,
  email_sent boolean DEFAULT false,
  created_date timestamptz DEFAULT now(),
  updated_date timestamptz DEFAULT now(),
  created_by_id text,
  created_by text,
  is_sample boolean DEFAULT false
);

-- Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  entity_type text,
  entity_id text,
  action_type text,
  actor_user_id text,
  actor_name text,
  details jsonb,
  created_date timestamptz DEFAULT now(),
  updated_date timestamptz DEFAULT now(),
  created_by_id text,
  created_by text,
  is_sample boolean DEFAULT false
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_fund_organization_id ON public.fund(organization_id);
CREATE INDEX IF NOT EXISTS idx_routing_rule_fund_id ON public.routing_rule(fund_id);
CREATE INDEX IF NOT EXISTS idx_fund_request_organization_id ON public.fund_request(organization_id);
CREATE INDEX IF NOT EXISTS idx_fund_request_fund_id ON public.fund_request(fund_id);
CREATE INDEX IF NOT EXISTS idx_fund_request_status ON public.fund_request(status);
CREATE INDEX IF NOT EXISTS idx_review_fund_request_id ON public.review(fund_request_id);
CREATE INDEX IF NOT EXISTS idx_disbursement_fund_request_id ON public.disbursement(fund_request_id);
CREATE INDEX IF NOT EXISTS idx_notification_user_id ON public.notification(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_organization_entity ON public.audit_log(organization_id, entity_type);
