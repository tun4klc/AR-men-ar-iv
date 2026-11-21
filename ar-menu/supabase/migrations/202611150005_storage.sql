-- Medya deposu: ÖZEL bucket. Dosyalar yalnızca kısa ömürlü imzalı URL ile açılır ve
-- imzalı URL yalnızca işletme AKTİFKEN üretilebilir (kill-switch medyayı da keser).
-- Yol düzeni: <tenant_id>/products/<product_id>/<rastgele>.<uzantı>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-media', 'menu-media', false, 20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'model/gltf-binary', 'model/vnd.usdz+zip',
        'application/octet-stream']
)
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create function public.storage_tenant_id(p_name text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return (split_part(p_name, '/', 1))::uuid;
exception when others then
  return null;
end $$;
grant execute on function public.storage_tenant_id(text) to anon, authenticated;

-- Okuma (imzalı URL üretimi dahil): işletme aktifse herkes; misafir menüsü bunu kullanır.
create policy menu_media_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'menu-media' and public.is_tenant_active(public.storage_tenant_id(name)));

-- Yazma: yalnızca katalog düzenleme yetkisi olan üye, yalnızca kendi işletme klasörüne.
create policy menu_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'menu-media' and public.can_edit_catalog(public.storage_tenant_id(name)));
create policy menu_media_update on storage.objects for update to authenticated
  using (bucket_id = 'menu-media' and public.can_edit_catalog(public.storage_tenant_id(name)))
  with check (bucket_id = 'menu-media' and public.can_edit_catalog(public.storage_tenant_id(name)));
create policy menu_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'menu-media' and public.can_edit_catalog(public.storage_tenant_id(name)));

-- is_tenant_active anon için storage politikasında gerekli.
grant execute on function public.is_tenant_active(uuid) to anon;
