-- Çok dilli menü: Almanca, Rusça, Arapça çeviriler.
-- İngilizce mevcut name_en / description_en sütunlarında kalır; diğer diller burada tutulur:
--   {"de": {"name": "...", "description": "..."}, "ru": {...}, "ar": {...}}
-- Çeviriler panelde ürün kaydedilirken Claude ile otomatik üretilir, işletme sahibi düzeltebilir.

alter table public.categories
  add column translations jsonb not null default '{}'::jsonb
  constraint categories_translations_object check (jsonb_typeof(translations) = 'object' and pg_column_size(translations) < 8000);

alter table public.products
  add column translations jsonb not null default '{}'::jsonb
  constraint products_translations_object check (jsonb_typeof(translations) = 'object' and pg_column_size(translations) < 20000);

-- Misafir menüsü çevirileri de döndürür.
create or replace function public.get_public_menu(p_tenant_slug text, p_branch_slug text) returns jsonb
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
      select jsonb_agg(jsonb_build_object('id', c.id, 'name_tr', c.name_tr, 'name_en', c.name_en, 'translations', c.translations)
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
        'translations', p.translations,
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
