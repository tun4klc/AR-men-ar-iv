-- Askıya alma bildirimi: işletme pasife alınınca sahiplerinin kayıtlı e-postasına haber verilir.
-- Her askı komutu (request_id) için en fazla BİR e-posta gider: bildirim "talep edilir" (notified_at),
-- gönderim başarısız olursa talep geri bırakılır ve aynı komutun tekrarı yeniden dener.

alter table public.tenant_status_log add column notified_at timestamptz;

-- Bildirimi talep et: yalnızca askı kaydı, henüz bildirilmemiş ve işletme hâlâ askıdaysa satır döner.
-- Dönen veri: işletme adı, gerekçe ve owner e-postaları. Başka kullanıcı/menü verisi döndürmez.
create function public.control_claim_suspension_notice(p_request_id uuid)
returns table (tenant_name text, reason text, emails text[])
language plpgsql security definer set search_path = '' as $$
declare
  v_log public.tenant_status_log%rowtype;
begin
  update public.tenant_status_log l
     set notified_at = now()
   where l.request_id = p_request_id
     and l.action = 'suspended'
     and l.notified_at is null
     and exists (select 1 from public.tenants t where t.id = l.tenant_id and t.status = 'suspended')
  returning l.* into v_log;
  if not found then return; end if;

  return query
    select t.name, v_log.reason,
           coalesce(array_agg(distinct u.email) filter (where u.email is not null), '{}')
      from public.tenants t
      left join public.memberships m on m.tenant_id = t.id and m.role = 'owner'
      left join auth.users u on u.id = m.user_id
     where t.id = v_log.tenant_id
     group by t.name;
end $$;

-- Gönderim başarısızsa talebi geri bırak (aynı request_id ile tekrar denenebilsin).
create function public.control_release_suspension_notice(p_request_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.tenant_status_log set notified_at = null where request_id = p_request_id;
$$;

revoke all on function public.control_claim_suspension_notice(uuid),
  public.control_release_suspension_notice(uuid) from public, anon, authenticated;
grant execute on function public.control_claim_suspension_notice(uuid),
  public.control_release_suspension_notice(uuid) to control_api;
