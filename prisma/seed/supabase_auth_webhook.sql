-- Supabase Auth -> Customers webhook trigger (auth.users)
-- Replace {{API_URL}} and {{WEBHOOK_SECRET}} before running.

create extension if not exists pg_net;

create or replace function public.notify_auth_users_webhook()
returns trigger
language plpgsql
as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW),
    'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end
  );

  perform net.http_post(
    url := '{{API_URL}}/webhooks/supabase/auth',
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '{{WEBHOOK_SECRET}}'
    )
  );

  return new;
end;
$$;

drop trigger if exists auth_users_webhook on auth.users;
create trigger auth_users_webhook
after insert or update on auth.users
for each row execute function public.notify_auth_users_webhook();
