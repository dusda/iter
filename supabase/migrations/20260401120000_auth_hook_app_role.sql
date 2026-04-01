-- Add custom claim `app_role` to Supabase Auth JWTs.
-- This enables RBAC checks via auth.jwt() ->> 'app_role'.
--
-- After applying this migration, enable the hook in Supabase Dashboard:
-- Authentication -> Hooks (Beta) -> Custom Access Token -> select public.custom_access_token_hook_app_role

create function public.custom_access_token_hook_app_role(event jsonb)
returns jsonb
language plpgsql
stable
as $$
  declare
    claims jsonb;
    app_role text;
  begin
    -- Read app role from profiles (single source of truth in this app)
    select p.app_role
      into app_role
    from public.profiles p
    where p.id = (event->>'user_id')::uuid;

    claims := event->'claims';

    -- Stamp claim (null if no profile/role)
    if app_role is not null then
      claims := jsonb_set(claims, '{app_role}', to_jsonb(app_role));
    else
      claims := jsonb_set(claims, '{app_role}', 'null');
    end if;

    event := jsonb_set(event, '{claims}', claims);
    return event;
  end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook_app_role to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook_app_role from authenticated, anon, public;

