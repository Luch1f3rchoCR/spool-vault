-- Filament Vault MVP schema for Supabase.
-- Run this in the Supabase SQL editor after creating your project.

create extension if not exists pgcrypto;

create table if not exists public.filament_rolls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand text not null,
  product_line text,
  material text not null default 'PLA',
  color_name text not null,
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  initial_weight_g numeric(8, 2) not null default 1000 check (initial_weight_g > 0),
  available_weight_g numeric(8, 2) not null default 1000 check (available_weight_g >= 0),
  low_threshold_g numeric(8, 2) not null default 200 check (low_threshold_g >= 0),
  status text not null default 'new' check (status in ('new', 'open', 'low', 'empty', 'archived')),
  location text,
  purchase_date date,
  price_amount numeric(10, 2) check (price_amount is null or price_amount >= 0),
  currency text not null default 'USD',
  drying_notes text,
  photo_url text,
  purchase_url text,
  nfc_tag_id text,
  qr_payload text,
  opened_at timestamptz,
  last_dried_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consumption_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  roll_id uuid not null references public.filament_rolls(id) on delete cascade,
  project_name text not null,
  grams_used numeric(8, 2) not null check (grams_used > 0),
  consumed_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists filament_rolls_user_status_idx
  on public.filament_rolls (user_id, status);

create index if not exists filament_rolls_user_material_idx
  on public.filament_rolls (user_id, material);

create index if not exists filament_rolls_user_brand_idx
  on public.filament_rolls (user_id, brand);

create index if not exists consumption_logs_user_roll_idx
  on public.consumption_logs (user_id, roll_id, consumed_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_filament_rolls_updated_at on public.filament_rolls;
create trigger set_filament_rolls_updated_at
before update on public.filament_rolls
for each row execute function public.set_updated_at();

create or replace function public.sync_roll_after_consumption()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected_roll uuid;
  delta numeric(8, 2);
  next_weight numeric(8, 2);
begin
  if tg_op = 'INSERT' then
    affected_roll := new.roll_id;
    delta := new.grams_used;
  elsif tg_op = 'DELETE' then
    affected_roll := old.roll_id;
    delta := -old.grams_used;
  else
    if old.roll_id <> new.roll_id then
      update public.filament_rolls
      set
        available_weight_g = least(initial_weight_g, available_weight_g + old.grams_used),
        status = case
          when least(initial_weight_g, available_weight_g + old.grams_used) <= 0 then 'empty'
          when least(initial_weight_g, available_weight_g + old.grams_used) <= low_threshold_g then 'low'
          else 'open'
        end
      where id = old.roll_id and user_id = (select auth.uid());

      affected_roll := new.roll_id;
      delta := new.grams_used;
    else
      affected_roll := new.roll_id;
      delta := new.grams_used - old.grams_used;
    end if;
  end if;

  update public.filament_rolls
  set
    available_weight_g = least(initial_weight_g, greatest(0, available_weight_g - delta)),
    status = case
      when least(initial_weight_g, greatest(0, available_weight_g - delta)) <= 0 then 'empty'
      when least(initial_weight_g, greatest(0, available_weight_g - delta)) <= low_threshold_g then 'low'
      else 'open'
    end
  where id = affected_roll and user_id = (select auth.uid())
  returning available_weight_g into next_weight;

  if next_weight is null then
    raise exception 'No matching filament roll found for this user';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_roll_after_consumption_insert on public.consumption_logs;
create trigger sync_roll_after_consumption_insert
after insert on public.consumption_logs
for each row execute function public.sync_roll_after_consumption();

drop trigger if exists sync_roll_after_consumption_update on public.consumption_logs;
create trigger sync_roll_after_consumption_update
after update on public.consumption_logs
for each row execute function public.sync_roll_after_consumption();

drop trigger if exists sync_roll_after_consumption_delete on public.consumption_logs;
create trigger sync_roll_after_consumption_delete
after delete on public.consumption_logs
for each row execute function public.sync_roll_after_consumption();

create or replace view public.low_filament_rolls
with (security_invoker = true)
as
select
  id,
  user_id,
  brand,
  product_line,
  material,
  color_name,
  color_hex,
  available_weight_g,
  low_threshold_g,
  status,
  location,
  purchase_url,
  updated_at
from public.filament_rolls
where status in ('low', 'empty')
   or available_weight_g <= low_threshold_g;

create or replace view public.filament_inventory_summary
with (security_invoker = true)
as
select
  totals.user_id,
  totals.roll_count,
  totals.low_roll_count,
  totals.total_available_g,
  coalesce(materials.rolls_by_material, '{}'::jsonb) as rolls_by_material
from (
  select
    user_id,
    count(*) as roll_count,
    count(*) filter (where status in ('low', 'empty')) as low_roll_count,
    coalesce(sum(available_weight_g), 0) as total_available_g
  from public.filament_rolls
  group by user_id
) totals
left join (
  select
    user_id,
    jsonb_object_agg(material, roll_count order by material) as rolls_by_material
  from (
    select user_id, material, count(*) as roll_count
    from public.filament_rolls
    group by user_id, material
  ) material_counts
  group by user_id
) materials on materials.user_id = totals.user_id;

alter table public.filament_rolls enable row level security;
alter table public.consumption_logs enable row level security;

drop policy if exists "Users can read their filament rolls" on public.filament_rolls;
create policy "Users can read their filament rolls"
on public.filament_rolls
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their filament rolls" on public.filament_rolls;
create policy "Users can insert their filament rolls"
on public.filament_rolls
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their filament rolls" on public.filament_rolls;
create policy "Users can update their filament rolls"
on public.filament_rolls
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their filament rolls" on public.filament_rolls;
create policy "Users can delete their filament rolls"
on public.filament_rolls
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their consumption logs" on public.consumption_logs;
create policy "Users can read their consumption logs"
on public.consumption_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their consumption logs" on public.consumption_logs;
create policy "Users can insert their consumption logs"
on public.consumption_logs
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.filament_rolls
    where filament_rolls.id = consumption_logs.roll_id
      and filament_rolls.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update their consumption logs" on public.consumption_logs;
create policy "Users can update their consumption logs"
on public.consumption_logs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.filament_rolls
    where filament_rolls.id = consumption_logs.roll_id
      and filament_rolls.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete their consumption logs" on public.consumption_logs;
create policy "Users can delete their consumption logs"
on public.consumption_logs
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.filament_rolls to authenticated;
grant select, insert, update, delete on table public.consumption_logs to authenticated;
grant select on public.low_filament_rolls to authenticated;
grant select on public.filament_inventory_summary to authenticated;

revoke all on table public.filament_rolls from anon;
revoke all on table public.consumption_logs from anon;
revoke all on public.low_filament_rolls from anon;
revoke all on public.filament_inventory_summary from anon;

-- Purchasing, suppliers, reusable spools and price history.
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  website_url text,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.spools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null,
  brand text,
  spool_material text not null default 'Plástico reutilizable',
  tare_weight_g numeric(8, 2) check (tare_weight_g is null or tare_weight_g >= 0),
  acquisition_cost numeric(10, 2) not null default 1000 check (acquisition_cost >= 0),
  currency text not null default 'CRC',
  status text not null default 'empty' check (status in ('empty', 'in_use', 'reserved', 'retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

alter table public.filament_rolls
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null,
  add column if not exists package_type text not null default 'spooled'
    check (package_type in ('spooled', 'refill')),
  add column if not exists spool_id uuid references public.spools(id) on delete set null,
  add column if not exists spool_cost_amount numeric(10, 2) not null default 0
    check (spool_cost_amount >= 0),
  add column if not exists filament_cost_amount numeric(10, 2)
    check (filament_cost_amount is null or filament_cost_amount >= 0);

alter table public.consumption_logs
  add column if not exists cost_amount numeric(12, 4) check (cost_amount is null or cost_amount >= 0),
  add column if not exists currency text;

create unique index if not exists filament_rolls_active_spool_idx
  on public.filament_rolls (spool_id)
  where spool_id is not null and status <> 'archived';

create table if not exists public.purchase_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  roll_id uuid references public.filament_rolls(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text not null,
  brand text not null,
  material text not null,
  product_line text,
  color_name text not null,
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  purchased_at date not null default current_date,
  package_type text not null check (package_type in ('spooled', 'refill')),
  total_price numeric(10, 2) not null check (total_price >= 0),
  spool_cost numeric(10, 2) not null default 0 check (spool_cost >= 0),
  filament_cost numeric(10, 2) not null check (filament_cost >= 0),
  currency text not null default 'CRC',
  quantity_g numeric(8, 2) not null default 1000 check (quantity_g > 0),
  created_at timestamptz not null default now(),
  check (spool_cost <= total_price),
  check (filament_cost = total_price - spool_cost)
);

create index if not exists purchase_history_user_product_idx
  on public.purchase_history (user_id, brand, material, product_line, color_name, purchased_at desc);

create index if not exists spools_user_status_idx
  on public.spools (user_id, status, code);

drop trigger if exists set_spools_updated_at on public.spools;
create trigger set_spools_updated_at
before update on public.spools
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;
alter table public.spools enable row level security;
alter table public.purchase_history enable row level security;

drop policy if exists "Users can read their suppliers" on public.suppliers;
create policy "Users can read their suppliers" on public.suppliers for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert their suppliers" on public.suppliers;
create policy "Users can insert their suppliers" on public.suppliers for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their suppliers" on public.suppliers;
create policy "Users can update their suppliers" on public.suppliers for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their suppliers" on public.suppliers;
create policy "Users can delete their suppliers" on public.suppliers for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their spools" on public.spools;
create policy "Users can read their spools" on public.spools for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert their spools" on public.spools;
create policy "Users can insert their spools" on public.spools for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their spools" on public.spools;
create policy "Users can update their spools" on public.spools for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their spools" on public.spools;
create policy "Users can delete their spools" on public.spools for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their purchase history" on public.purchase_history;
create policy "Users can read their purchase history" on public.purchase_history for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert their purchase history" on public.purchase_history;
create policy "Users can insert their purchase history" on public.purchase_history for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (roll_id is null or exists (
    select 1 from public.filament_rolls r
    where r.id = purchase_history.roll_id and r.user_id = (select auth.uid())
  ))
  and (supplier_id is null or exists (
    select 1 from public.suppliers s
    where s.id = purchase_history.supplier_id and s.user_id = (select auth.uid())
  ))
);
drop policy if exists "Users can update their purchase history" on public.purchase_history;
create policy "Users can update their purchase history" on public.purchase_history for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their purchase history" on public.purchase_history;
create policy "Users can delete their purchase history" on public.purchase_history for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their filament rolls" on public.filament_rolls;
create policy "Users can insert their filament rolls" on public.filament_rolls for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (supplier_id is null or exists (
    select 1 from public.suppliers s
    where s.id = filament_rolls.supplier_id and s.user_id = (select auth.uid())
  ))
  and (spool_id is null or exists (
    select 1 from public.spools s
    where s.id = filament_rolls.spool_id and s.user_id = (select auth.uid())
  ))
);

drop policy if exists "Users can update their filament rolls" on public.filament_rolls;
create policy "Users can update their filament rolls" on public.filament_rolls for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (supplier_id is null or exists (
    select 1 from public.suppliers s
    where s.id = filament_rolls.supplier_id and s.user_id = (select auth.uid())
  ))
  and (spool_id is null or exists (
    select 1 from public.spools s
    where s.id = filament_rolls.spool_id and s.user_id = (select auth.uid())
  ))
);

grant select, insert, update, delete on table public.suppliers to authenticated;
grant select, insert, update, delete on table public.spools to authenticated;
grant select, insert, update, delete on table public.purchase_history to authenticated;
revoke all on table public.suppliers from anon;
revoke all on table public.spools from anon;
revoke all on table public.purchase_history from anon;
