SELECT
  p.id AS user_id,
  u.email,
  p.full_name,
  p.app_role,
  p.organization_id,
  p.status
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
ORDER BY u.email NULLS LAST;