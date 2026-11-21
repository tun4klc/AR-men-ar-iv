-- Kontrol Merkezi (Sistem 2) köprüsü.
-- Sistem 1'in /api/control/* uç noktaları veritabanına `control_api` rolüyle bağlanır.
-- Bu rol HİÇBİR tabloya erişemez; yalnızca aşağıdaki control_* fonksiyonlarını çalıştırabilir.
-- Parola migration'da yoktur; kurulumda ayarlanır:
--   alter role control_api with login password '<güçlü-parola>';

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'control_api') then
    create role control_api nologin noinherit;
  end if;
end $$;

grant usage on schema public to control_api;
revoke all on all tables in schema public from control_api;

-- Replay koruması: nonce bir kez kullanılabilir; 15 dakikadan eski kayıtlar temizlenir.
create function public.control_consume_nonce(p_nonce text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_inserted int;
begin
  delete from public.control_nonces where created_at < now() - interval '15 minutes';
  insert into public.control_nonces (nonce) values (p_nonce) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end $$;

-- İşletme listesi: yalnızca sayaçlar ve durum. Menü/müşteri/kullanıcı verisi döndürmez.
create function public.control_list_tenants() returns table (
  id uuid, slug text, name text, status public.tenant_status, suspended_reason text,
  created_at timestamptz, branch_count bigint, scans_30d bigint, product_views_30d bigint,
  ar_opens_30d bigint, last_activity_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.slug, t.name, t.status, t.suspended_reason, t.created_at,
         (select count(*) from public.branches b where b.tenant_id = t.id),
         coalesce(s.scans, 0), coalesce(s.views, 0), coalesce(s.ar, 0),
         (select max(e.created_at) from public.events e where e.tenant_id = t.id)
  from public.tenants t
  left join lateral (
    select count(*) filter (where e.type = 'qr_scan') as scans,
           count(*) filter (where e.type = 'product_view') as views,
           count(*) filter (where e.type = 'ar_open') as ar
    from public.events e
    where e.tenant_id = t.id and e.created_at > now() - interval '30 days'
  ) s on true
  order by t.created_at desc;
$$;

-- Aç/kapat: idempotent (aynı request_id ikinci kez uygulanmaz), her komut loglanır.
create function public.control_set_tenant_status(
  p_tenant_id uuid, p_status public.tenant_status, p_reason text, p_request_id uuid
) returns table (id uuid, slug text, status public.tenant_status)
language plpgsql security definer set search_path = '' as $$
begin
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.tenant_status_log l where l.request_id = p_request_id) then
    update public.tenants t
       set status = p_status,
           suspended_at = case when p_status = 'suspended' then coalesce(t.suspended_at, now()) end,
           suspended_reason = case when p_status = 'suspended' then trim(p_reason) end
     where t.id = p_tenant_id;
    if not found then
      raise exception 'tenant_not_found' using errcode = 'P0002';
    end if;
    insert into public.tenant_status_log (tenant_id, action, reason, request_id)
      values (p_tenant_id, p_status, trim(p_reason), p_request_id);
  end if;

  return query select t.id, t.slug, t.status from public.tenants t where t.id = p_tenant_id;
end $$;

-- Edge önbelleğini senkronlamak için askıdaki slug listesi.
create function public.control_suspended_slugs() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(slug order by slug), '{}') from public.tenants where status = 'suspended';
$$;

revoke all on function public.control_consume_nonce(text), public.control_list_tenants(),
  public.control_set_tenant_status(uuid, public.tenant_status, text, uuid),
  public.control_suspended_slugs() from public, anon, authenticated;
grant execute on function public.control_consume_nonce(text), public.control_list_tenants(),
  public.control_set_tenant_status(uuid, public.tenant_status, text, uuid),
  public.control_suspended_slugs() to control_api;
