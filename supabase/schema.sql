-- Liquor Audit App schema

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.store_users (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code4 text not null check (char_length(code4) = 4),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(code4)
);

create table if not exists public.daily_audits (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  audit_date date not null,
  opening_balance numeric not null default 0,
  total_sales numeric not null default 0,
  office_cash_night numeric not null default 0,
  office_cash_sheet numeric not null default 0,
  expenditure numeric not null default 0,
  balance numeric not null default 0,
  raw_ocr_text text,
  created_at timestamptz not null default now(),
  unique(store_id, audit_date)
);

create table if not exists public.audit_line_items (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.daily_audits(id) on delete cascade,
  brand_name text not null,
  size_ml integer,
  ob numeric,
  received numeric,
  total numeric,
  others numeric,
  cb numeric,
  sales_qty numeric,
  rate numeric,
  sales_amount numeric,
  created_at timestamptz not null default now()
);

-- Enable RLS if you want later; for simplicity this starter assumes server-side service role key only.
