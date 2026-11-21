-- Sistem 1 (Menü Platformu) çekirdek şema.
-- Kural: tenant kapsamı her zaman üyelikten çözülür; istemciden gelen tenant_id'ye güvenilmez.

create extension if not exists pgcrypto with schema extensions;

create type public.tenant_status as enum ('active', 'suspended');
create type public.member_role as enum ('owner', 'manager');
create type public.event_type as enum ('qr_scan', 'menu_view', 'product_view', 'ar_open', 'ar_placed');

-- İşletmeler -------------------------------------------------------------
create table public.tenants (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique
                   check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'),
  name             text not null check (char_length(name) between 2 and 120),
  status           public.tenant_status not null default 'active',
  suspended_at     timestamptz,
  suspended_reason text check (char_length(suspended_reason) <= 500),
  created_at       timestamptz not null default now(),
  constraint tenants_suspension_consistent
    check ((status = 'suspended') = (suspended_at is not null))
);

-- Şubeler ---------------------------------------------------------------
create table public.branches (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  slug         text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,46}[a-z0-9]$'),
  name         text not null check (char_length(name) between 1 and 120),
  address      text check (char_length(address) <= 300),
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (tenant_id, slug),
  unique (tenant_id, id)
);

-- Üyelik: owner tüm işletme; manager branch_id null ise tüm şubeler, değilse tek şube.
create table public.memberships (
  user_id    uuid not null references auth.users (id) on delete cascade,
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  role       public.member_role not null,
  branch_id  uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id),
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id) on delete cascade,
  constraint memberships_owner_has_no_branch check (role <> 'owner' or branch_id is null)
);
create index memberships_tenant_idx on public.memberships (tenant_id);

-- Katalog (işletme geneli) --------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  name_tr    text not null check (char_length(name_tr) between 1 and 80),
  name_en    text check (char_length(name_en) <= 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);
create index categories_tenant_idx on public.categories (tenant_id, sort_order);

create table public.products (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  category_id    uuid not null,
  name_tr        text not null check (char_length(name_tr) between 1 and 120),
  name_en        text check (char_length(name_en) <= 120),
  description_tr text check (char_length(description_tr) <= 1000),
  description_en text check (char_length(description_en) <= 1000),
  image_path     text,
  allergens      text[] not null default '{}',
  base_price     numeric(10, 2) not null check (base_price >= 0),
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, category_id) references public.categories (tenant_id, id) on delete cascade,
  constraint products_image_in_tenant_folder
    check (image_path is null or image_path like tenant_id::text || '/%')
);
create index products_category_idx on public.products (tenant_id, category_id, sort_order);

-- Şubeye özel fiyat / stok / gizleme. Satır yoksa ürün base_price ile görünür.
create table public.branch_products (
  tenant_id    uuid not null,
  branch_id    uuid not null,
  product_id   uuid not null,
  price        numeric(10, 2) check (price >= 0),
  is_available boolean not null default true,
  is_hidden    boolean not null default false,
  primary key (branch_id, product_id),
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id) on delete cascade,
  foreign key (tenant_id, product_id) references public.products (tenant_id, id) on delete cascade
);
create index branch_products_product_idx on public.branch_products (product_id);

-- 3D model: gerçek boyutlar santimetre cinsinden; AR'da ölçek sabitlenir.
create table public.product_models (
  product_id  uuid primary key,
  tenant_id   uuid not null,
  glb_path    text not null,
  usdz_path   text,
  poster_path text,
  width_cm    numeric(6, 1) not null check (width_cm > 0 and width_cm <= 200),
  depth_cm    numeric(6, 1) not null check (depth_cm > 0 and depth_cm <= 200),
  height_cm   numeric(6, 1) not null check (height_cm > 0 and height_cm <= 200),
  updated_at  timestamptz not null default now(),
  foreign key (tenant_id, product_id) references public.products (tenant_id, id) on delete cascade,
  constraint product_models_paths_in_tenant_folder check (
    glb_path like tenant_id::text || '/%'
    and (usdz_path is null or usdz_path like tenant_id::text || '/%')
    and (poster_path is null or poster_path like tenant_id::text || '/%')
  )
);

-- Masalar ve QR kodları --------------------------------------------------
create table public.tables (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  branch_id  uuid not null,
  label      text not null check (char_length(label) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (branch_id, label),
  unique (tenant_id, id),
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id) on delete cascade
);

create table public.qr_codes (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  branch_id  uuid not null,
  table_id   uuid,
  -- 128 bit rastgele, URL güvenli; tahmin edilemez.
  token      text not null unique
             default replace(replace(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+', '-'), '/', '_'),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, branch_id) references public.branches (tenant_id, id) on delete cascade,
  foreign key (tenant_id, table_id) references public.tables (tenant_id, id) on delete cascade
);
create index qr_codes_branch_idx on public.qr_codes (branch_id);

-- Ziyaretçi olayları (yalnızca RPC ile yazılır) ---------------------------
create table public.events (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  branch_id  uuid not null references public.branches (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  table_id   uuid references public.tables (id) on delete set null,
  type       public.event_type not null,
  session_id uuid,
  created_at timestamptz not null default now()
);
create index events_tenant_time_idx on public.events (tenant_id, created_at);
create index events_branch_time_idx on public.events (branch_id, created_at);
create index events_created_brin on public.events using brin (created_at);

-- Kontrol Merkezi'nden gelen komutların kaydı + replay koruması ------------
create table public.tenant_status_log (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  action     public.tenant_status not null,
  reason     text not null check (char_length(reason) between 3 and 500),
  request_id uuid not null unique,
  created_at timestamptz not null default now()
);

create table public.control_nonces (
  nonce      text primary key check (char_length(nonce) between 16 and 64),
  created_at timestamptz not null default now()
);
create index control_nonces_created_idx on public.control_nonces (created_at);

-- updated_at tetikleyicisi
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger product_models_touch before update on public.product_models
  for each row execute function public.touch_updated_at();
