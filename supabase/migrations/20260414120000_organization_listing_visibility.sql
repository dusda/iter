-- listing_visibility: public orgs appear on the anonymous home org picker; unlisted orgs are only reachable via direct /org/:slug links.
ALTER TABLE public.organization
  ADD COLUMN IF NOT EXISTS listing_visibility text NOT NULL DEFAULT 'public';

ALTER TABLE public.organization
  DROP CONSTRAINT IF EXISTS organization_listing_visibility_check;

ALTER TABLE public.organization
  ADD CONSTRAINT organization_listing_visibility_check
  CHECK (listing_visibility IN ('public', 'unlisted'));
