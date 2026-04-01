-- Fix custom access token hook failing during invite verification.
-- GoTrue executes the hook with limited DB privileges; reading public.profiles must not error.

create or replace function public.custom_access_token_hook_app_role(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
  declare
    claims jsonb;
    app_role text;
  begin
    claims := coalesce(event->'claims', '{}'::jsonb);

    begin
      -- Read app role from profiles (single source of truth in this app)
      select p.app_role
        into app_role
      from public.profiles p
      where p.id = (event->>'user_id')::uuid;
    exception when others then
      -- Never break auth flows because a profile row doesn't exist yet
      -- or because permissions/RLS prevent reading it.
      app_role := null;
    end;

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

-- Ensure GoTrue can execute the hook.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook_app_role(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook_app_role(jsonb) from authenticated, anon, public;

