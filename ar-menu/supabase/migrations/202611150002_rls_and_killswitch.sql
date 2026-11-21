-- Yetki yardımcıları + RLS.
-- KILL-SWITCH ÇEKİRDEĞİ: tüm yardımcılar is_tenant_active() şartını içerir.
-- Askıdaki bir işletme için panel sorguları 0 satır döner ve tüm yazmalar reddedilir,
-- anon/authenticated anahtarla doğrudan PostgREST'e gidilse bile.

create function public.is_tenant_active(p_tenant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenants t
    where t.id = p_tenant_id and t.status = 'active'
  );
$$;

-- Üye mi (ve işletme aktif mi)?
create function public.is_member(p_tenant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_tenant_active(p_tenant_id) and exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant_id and m.user_id = (select auth.uid())
  );
$$;

create function public.is_owner(p_tenant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_tenant_active(p_tenant_id) and exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant_id and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

-- Katalog (ürün/kategori/model) düzenleme: owner veya tüm şubelerden sorumlu manager.
create function public.can_edit_catalog(p_tenant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_tenant_active(p_tenant_id) and exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant_id and m.user_id = (select auth.uid())
      and (m.role = 'owner' or m.branch_id is null)
  );
$$;

-- Şube görme/yönetme: owner, tüm şube manager'ı veya o şubenin manager'ı.
create function public.can_manage_branch(p_tenant_id uuid, p_branch_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_tenant_active(p_tenant_id) and exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant_id and m.user_id = (select auth.uid())
      and (m.role = 'owner' or m.branch_id is null or m.branch_id = p_branch_id)
  );
$$;

revoke all on function public.is_tenant_active(uuid), public.is_member(uuid), public.is_owner(uuid),
  public.can_edit_catalog(uuid), public.can_manage_branch(uuid, uuid) from public, anon;
grant execute on function public.is_tenant_active(uuid), public.is_member(uuid), public.is_owner(uuid),
  public.can_edit_catalog(uuid), public.can_manage_branch(uuid, uuid) to authenticated;

-- Tablo yetkileri: anon hiçbir tabloya doğrudan erişemez; misafir verisi yalnız RPC ile.
revoke all on all tables in schema public from anon, authenticated;

alter table public.tenants           enable row level security;
alter table public.branches          enable row level security;
alter table public.memberships       enable row level security;
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.branch_products   enable row level security;
alter table public.product_models    enable row level security;
alter table public.tables            enable row level security;
alter table public.qr_codes          enable row level security;
alter table public.events            enable row level security;
alter table public.tenant_status_log enable row level security;
alter table public.control_nonces    enable row level security;

-- tenants: üye görür; owner yalnızca adı değiştirebilir (status kolonu yetkisi YOK).
grant select on public.tenants to authenticated;
grant update (name) on public.tenants to authenticated;
create policy tenants_select on public.tenants for select to authenticated
  using ((select public.is_member(id)));
create policy tenants_update on public.tenants for update to authenticated
  using ((select public.is_owner(id))) with check ((select public.is_owner(id)));

-- branches
grant select, insert, update, delete on public.branches to authenticated;
create policy branches_select on public.branches for select to authenticated
  using ((select public.can_manage_branch(tenant_id, id)));
create policy branches_insert on public.branches for insert to authenticated
  with check ((select public.is_owner(tenant_id)));
create policy branches_update on public.branches for update to authenticated
  using ((select public.can_manage_branch(tenant_id, id)))
  with check ((select public.can_manage_branch(tenant_id, id)));
create policy branches_delete on public.branches for delete to authenticated
  using ((select public.is_owner(tenant_id)));

-- memberships: kişi kendi üyeliğini, owner tüm üyelikleri görür; yönetim owner'da.
grant select, insert, update, delete on public.memberships to authenticated;
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_tenant_active(tenant_id))
         or (select public.is_owner(tenant_id)));
create policy memberships_write on public.memberships for all to authenticated
  using ((select public.is_owner(tenant_id)) and user_id <> (select auth.uid()))
  with check ((select public.is_owner(tenant_id)) and user_id <> (select auth.uid()));

-- categories / products / product_models
grant select, insert, update, delete on public.categories, public.products, public.product_models to authenticated;
create policy categories_select on public.categories for select to authenticated
  using ((select public.is_member(tenant_id)));
create policy categories_write on public.categories for all to authenticated
  using ((select public.can_edit_catalog(tenant_id)))
  with check ((select public.can_edit_catalog(tenant_id)));

create policy products_select on public.products for select to authenticated
  using ((select public.is_member(tenant_id)));
create policy products_write on public.products for all to authenticated
  using ((select public.can_edit_catalog(tenant_id)))
  with check ((select public.can_edit_catalog(tenant_id)));

create policy product_models_select on public.product_models for select to authenticated
  using ((select public.is_member(tenant_id)));
create policy product_models_write on public.product_models for all to authenticated
  using ((select public.can_edit_catalog(tenant_id)))
  with check ((select public.can_edit_catalog(tenant_id)));

-- branch_products / tables / qr_codes: şube kapsamlı
grant select, insert, update, delete on public.branch_products, public.tables, public.qr_codes to authenticated;
create policy branch_products_all on public.branch_products for all to authenticated
  using ((select public.can_manage_branch(tenant_id, branch_id)))
  with check ((select public.can_manage_branch(tenant_id, branch_id)));
create policy tables_all on public.tables for all to authenticated
  using ((select public.can_manage_branch(tenant_id, branch_id)))
  with check ((select public.can_manage_branch(tenant_id, branch_id)));
create policy qr_codes_all on public.qr_codes for all to authenticated
  using ((select public.can_manage_branch(tenant_id, branch_id)))
  with check ((select public.can_manage_branch(tenant_id, branch_id)));

-- events, tenant_status_log, control_nonces: RLS açık, hiçbir rol için politika yok
-- → yalnızca SECURITY DEFINER fonksiyonlar erişir.

-- Kullanıcının üyelikleri (askıdakiler dahil) — panelin "askıda" ekranını gösterebilmesi için
-- yalnızca slug/ad/durum döner, işletme verisi döndürmez.
create function public.my_tenants() returns table (slug text, name text, status public.tenant_status, role public.member_role)
language sql stable security definer set search_path = '' as $$
  select t.slug, t.name, t.status, m.role
  from public.memberships m join public.tenants t on t.id = m.tenant_id
  where m.user_id = (select auth.uid())
  order by t.created_at;
$$;
revoke all on function public.my_tenants() from public, anon;
grant execute on function public.my_tenants() to authenticated;

-- Onboarding: işletme + ilk şube + owner üyeliği tek transaction'da.
create function public.create_tenant_with_branch(
  p_name text, p_slug text, p_branch_name text, p_branch_slug text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_tenant uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.memberships where user_id = v_uid and role = 'owner') >= 5 then
    raise exception 'tenant_limit' using errcode = 'P0001';
  end if;

  insert into public.tenants (name, slug) values (trim(p_name), lower(p_slug))
    returning id into v_tenant;
  insert into public.branches (tenant_id, name, slug, is_published)
    values (v_tenant, trim(p_branch_name), lower(p_branch_slug), true);
  insert into public.memberships (user_id, tenant_id, role) values (v_uid, v_tenant, 'owner');
  return lower(p_slug);
end $$;
revoke all on function public.create_tenant_with_branch(text, text, text, text) from public, anon;
grant execute on function public.create_tenant_with_branch(text, text, text, text) to authenticated;
