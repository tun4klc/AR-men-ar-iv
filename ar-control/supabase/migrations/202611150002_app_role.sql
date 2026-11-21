-- Uygulama bu veritabanına süper kullanıcıyla değil, yalnızca kendi 3 tablosuna erişebilen
-- `control_app` rolüyle bağlanır. Parola migration'da yoktur; kurulumda ayarlanır:
--   alter role control_app with login password '<güçlü-parola>';
-- DATABASE_URL (pooler): postgresql://control_app.<proje-ref>:<parola>@aws-0-<bölge>.pooler.supabase.com:6543/postgres

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'control_app') then
    create role control_app nologin noinherit;
  end if;
end $$;

grant usage on schema public to control_app;
grant select, insert, update on public.admins to control_app;
grant select, insert, update on public.audit_log to control_app;
grant select, insert, update on public.tenant_snapshot to control_app;

create policy admins_app on public.admins for all to control_app using (true) with check (true);
create policy audit_log_app on public.audit_log for all to control_app using (true) with check (true);
create policy tenant_snapshot_app on public.tenant_snapshot for all to control_app using (true) with check (true);
