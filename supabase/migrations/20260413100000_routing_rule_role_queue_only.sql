-- Stop using per-user routing; steps use role queues only.
UPDATE public.routing_rule
SET
  assigned_to_type = 'role_queue',
  assigned_role = COALESCE(assigned_role, 'reviewer'),
  assigned_user_ids = NULL,
  assigned_user_names = NULL,
  updated_date = now()
WHERE assigned_to_type = 'specific_users';
