-- Sistem 2 (Kontrol Merkezi) — Menü Platformu'ndan TAMAMEN AYRI veritabanı.
-- Uygulama bu veritabanına yalnızca sunucu tarafından (DATABASE_URL) bağlanır.
-- RLS açık ve hiçbir politika yok → anon/authenticated (Supabase API) hiçbir satırı göremez.

create table public.admins (
  id               uuid primary key default gen_random_uuid(),
  email            text not null unique check (email = lower(email) and email like '%@%'),
  password_hash    text not null,
  totp_secret      text not null,
  is_active        boolean not null default true,
  failed_attempts  integer not null default 0,
  locked_until     timestamptz,
  last_totp_step   bigint,              -- aynı TOTP kodunun ikinci kez kullanılmasını engeller
  session_version  integer not null default 1,  -- artırılınca tüm oturumlar düşer
  last_login_at    timestamptz,
  created_at       timestamptz not null default now()
);

create table public.audit_log (
  id              bigint generated always as identity primary key,
  admin_id        uuid references public.admins (id) on delete set null,
  admin_email     text,
  action          text not null check (action in ('login', 'login_failed', 'login_locked', 'logout', 'suspend', 'activate')),
  tenant_id       uuid,
  tenant_slug     text,
  reason          text check (char_length(reason) <= 500),
  ip              text,
  request_id      uuid unique,
  upstream_status integer,             -- Sistem 1'in HTTP yanıt kodu (0 = ulaşılamadı)
  outcome         text check (outcome in ('pending', 'ok', 'failed')),
  created_at      timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_tenant_idx on public.audit_log (tenant_id, created_at desc);

-- Sistem 1'den son başarılı çekilen işletme listesi: Sistem 1 erişilemezse panel
-- son bilinen durumu (açıkça "eski veri" uyarısıyla) gösterebilsin diye.
create table public.tenant_snapshot (
  id         integer primary key default 1 check (id = 1),
  data       jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.admins enable row level security;
alter table public.audit_log enable row level security;
alter table public.tenant_snapshot enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.admins, public.audit_log, public.tenant_snapshot from anon, authenticated';
  end if;
end $$;
