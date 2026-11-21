-- Misafir (anon) erişimi yalnızca bu RPC'lerle. Tablolar anon'a kapalıdır.

-- Menü: askıdaki işletme için yalnızca {"status":"suspended"} döner, hiçbir menü verisi dönmez.
create function public.get_public_menu(p_tenant_slug text, p_branch_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tenant public.tenants%rowtype;
  v_branch public.branches%rowtype;
begin
  select * into v_tenant from public.tenants where slug = lower(p_tenant_slug);
  if not found then return null; end if;
  if v_tenant.status <> 'active' then
    return jsonb_build_object('status', 'suspended');
  end if;

  select * into v_branch from public.branches
  where tenant_id = v_tenant.id and slug = lower(p_branch_slug) and is_published;
  if not found then return null; end if;

  return jsonb_build_object(
    'status', 'active',
    'tenant', jsonb_build_object('id', v_tenant.id, 'name', v_tenant.name, 'slug', v_tenant.slug),
    'branch', jsonb_build_object('id', v_branch.id, 'name', v_branch.name, 'slug', v_branch.slug),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name_tr', c.name_tr, 'name_en', c.name_en)
                       order by c.sort_order, c.created_at)
      from public.categories c
      where c.tenant_id = v_tenant.id
        and exists (select 1 from public.products p where p.category_id = c.id and p.is_active)
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'category_id', p.category_id,
        'name_tr', p.name_tr, 'name_en', p.name_en,
        'description_tr', p.description_tr, 'description_en', p.description_en,
        'image_path', p.image_path,
        'allergens', p.allergens,
        'price', coalesce(bp.price, p.base_price),
        'is_available', coalesce(bp.is_available, true),
        'model', case when m.product_id is null then null else jsonb_build_object(
          'glb_path', m.glb_path, 'usdz_path', m.usdz_path, 'poster_path', m.poster_path,
          'width_cm', m.width_cm, 'depth_cm', m.depth_cm, 'height_cm', m.height_cm) end
      ) order by p.sort_order, p.created_at)
      from public.products p
      left join public.branch_products bp on bp.product_id = p.id and bp.branch_id = v_branch.id
      left join public.product_models m on m.product_id = p.id
      where p.tenant_id = v_tenant.id and p.is_active and coalesce(bp.is_hidden, false) = false
    ), '[]'::jsonb)
  );
end $$;

-- QR çözümleme: token → menü adresi; aktifse qr_scan olayı yazar.
create function public.resolve_qr(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v record;
begin
  select q.id, q.tenant_id, q.branch_id, q.table_id, t.slug as tenant_slug, t.status,
         b.slug as branch_slug, b.is_published, tb.label as table_label
    into v
  from public.qr_codes q
  join public.tenants t on t.id = q.tenant_id
  join public.branches b on b.id = q.branch_id
  left join public.tables tb on tb.id = q.table_id
  where q.token = p_token and q.is_active;

  if not found then return null; end if;
  if v.status <> 'active' then return jsonb_build_object('status', 'suspended'); end if;
  if not v.is_published then return null; end if;

  insert into public.events (tenant_id, branch_id, table_id, type)
    values (v.tenant_id, v.branch_id, v.table_id, 'qr_scan');

  return jsonb_build_object('status', 'active', 'tenant_slug', v.tenant_slug,
    'branch_slug', v.branch_slug, 'table_label', v.table_label);
end $$;

-- Olay kaydı: tür listesi, şube yayında + işletme aktif, ürün aynı işletmede, şube başına dakikada 600 olay.
create function public.record_event(
  p_branch_id uuid, p_type public.event_type, p_product_id uuid default null, p_session_id uuid default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_tenant uuid;
begin
  if p_type not in ('menu_view', 'product_view', 'ar_open', 'ar_placed') then
    raise exception 'invalid_event_type' using errcode = '22023';
  end if;
  if p_type <> 'menu_view' and p_product_id is null then
    raise exception 'product_required' using errcode = '22023';
  end if;

  select b.tenant_id into v_tenant
  from public.branches b join public.tenants t on t.id = b.tenant_id
  where b.id = p_branch_id and b.is_published and t.status = 'active';
  if not found then return; end if;  -- askıdaki işletme: sessizce yok say

  if p_product_id is not null and not exists (
    select 1 from public.products where id = p_product_id and tenant_id = v_tenant
  ) then
    raise exception 'invalid_product' using errcode = '22023';
  end if;

  if (select count(*) from public.events
      where branch_id = p_branch_id and created_at > now() - interval '1 minute') >= 600 then
    return;
  end if;

  insert into public.events (tenant_id, branch_id, product_id, type, session_id)
    values (v_tenant, p_branch_id, p_product_id, p_type, p_session_id);
end $$;

revoke all on function public.get_public_menu(text, text), public.resolve_qr(text),
  public.record_event(uuid, public.event_type, uuid, uuid) from public;
grant execute on function public.get_public_menu(text, text), public.resolve_qr(text),
  public.record_event(uuid, public.event_type, uuid, uuid) to anon, authenticated;

-- Panel analitiği: şube filtresi + tarih aralığı. Manager yalnız yetkili olduğu şubeleri görür.
create function public.dashboard_stats(
  p_tenant_id uuid, p_from timestamptz, p_to timestamptz, p_branch_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_branches uuid[];
begin
  if not public.is_member(p_tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_to <= p_from or p_to - p_from > interval '366 days' then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  select array_agg(b.id) into v_branches
  from public.branches b
  where b.tenant_id = p_tenant_id
    and public.can_manage_branch(p_tenant_id, b.id)
    and (p_branch_id is null or b.id = p_branch_id);

  return (
    with e as (
      select * from public.events
      where tenant_id = p_tenant_id and branch_id = any (coalesce(v_branches, '{}'))
        and created_at >= p_from and created_at < p_to
    )
    select jsonb_build_object(
      'totals', (select jsonb_build_object(
          'qr_scans', count(*) filter (where type = 'qr_scan'),
          'menu_views', count(*) filter (where type = 'menu_view'),
          'product_views', count(*) filter (where type = 'product_view'),
          'ar_opens', count(*) filter (where type = 'ar_open'),
          'ar_placed', count(*) filter (where type = 'ar_placed'),
          'sessions', count(distinct session_id)) from e),
      'top_products', coalesce((select jsonb_agg(x order by x.product_views desc, x.ar_opens desc) from (
          select p.id, p.name_tr as name,
                 count(*) filter (where e.type = 'product_view') as product_views,
                 count(*) filter (where e.type = 'ar_open') as ar_opens,
                 count(*) filter (where e.type = 'ar_placed') as ar_placed
          from e join public.products p on p.id = e.product_id
          group by p.id, p.name_tr
          order by product_views desc, ar_opens desc
          limit 20) x), '[]'::jsonb),
      'by_branch', coalesce((select jsonb_agg(x order by x.product_views desc) from (
          select b.id, b.name,
                 count(e.*) filter (where e.type = 'qr_scan') as qr_scans,
                 count(e.*) filter (where e.type = 'product_view') as product_views,
                 count(e.*) filter (where e.type = 'ar_open') as ar_opens
          from public.branches b left join e on e.branch_id = b.id
          where b.id = any (coalesce(v_branches, '{}'))
          group by b.id, b.name) x), '[]'::jsonb),
      'daily', coalesce((select jsonb_agg(x order by x.day) from (
          select (date_trunc('day', created_at at time zone 'Europe/Istanbul'))::date as day,
                 count(*) filter (where type = 'qr_scan') as qr_scans,
                 count(*) filter (where type = 'product_view') as product_views,
                 count(*) filter (where type = 'ar_open') as ar_opens
          from e group by 1) x), '[]'::jsonb)
    )
  );
end $$;
revoke all on function public.dashboard_stats(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.dashboard_stats(uuid, timestamptz, timestamptz, uuid) to authenticated;
