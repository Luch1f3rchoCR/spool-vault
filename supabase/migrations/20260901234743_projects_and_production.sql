-- Proyectos reutilizables, recetas y corridas de produccion con costos congelados.

create table if not exists public.print_projects (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creation_request_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  version text,
  file_path text,
  file_name text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes between 0 and 52428800),
  license_name text,
  commercial_use_allowed boolean not null default false,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 100000),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, creation_request_id)
);

create table if not exists public.project_filament_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.print_projects(id) on delete cascade,
  position smallint not null check (position between 1 and 32),
  label text,
  preferred_roll_id uuid references public.filament_rolls(id) on delete set null,
  brand text not null,
  material text not null,
  product_line text,
  color_name text not null,
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  planned_grams numeric(10, 2) not null check (planned_grams > 0),
  created_at timestamptz not null default now(),
  unique (project_id, position)
);

create table if not exists public.project_components (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.print_projects(id) on delete cascade,
  position smallint not null check (position between 1 and 64),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  unit text not null default 'unidad' check (char_length(btrim(unit)) between 1 and 40),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost numeric(14, 4) not null default 0 check (unit_cost >= 0),
  currency text not null default 'CRC' check (currency ~ '^[A-Z]{3}$'),
  supplier_name text,
  notes text,
  created_at timestamptz not null default now(),
  unique (project_id, position)
);

create table if not exists public.production_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  request_id uuid not null,
  project_id uuid references public.print_projects(id) on delete set null,
  project_name text not null,
  produced_at date not null default current_date,
  quantity integer not null default 1 check (quantity between 1 and 100000),
  status text not null default 'completed' check (status in ('completed', 'partial', 'failed')),
  actual_minutes integer check (actual_minutes is null or actual_minutes between 0 and 100000),
  sale_amount numeric(14, 2) check (sale_amount is null or sale_amount >= 0),
  sale_currency text check (sale_currency is null or sale_currency ~ '^[A-Z]{3}$'),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, request_id),
  check ((sale_amount is null and sale_currency is null) or (sale_amount is not null and sale_currency is not null))
);

create table if not exists public.production_run_filaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  run_id uuid not null references public.production_runs(id) on delete restrict,
  project_requirement_id uuid references public.project_filament_requirements(id) on delete set null,
  roll_id uuid references public.filament_rolls(id) on delete set null,
  brand text not null,
  material text not null,
  product_line text,
  color_name text not null,
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  grams_used numeric(10, 2) not null check (grams_used > 0),
  unit_cost_per_g numeric(16, 6) check (unit_cost_per_g is null or unit_cost_per_g >= 0),
  cost_amount numeric(16, 4) check (cost_amount is null or cost_amount >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.production_run_components (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  run_id uuid not null references public.production_runs(id) on delete restrict,
  project_component_id uuid references public.project_components(id) on delete set null,
  name text not null,
  unit text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_cost numeric(14, 4) not null check (unit_cost >= 0),
  cost_amount numeric(16, 4) not null check (cost_amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  supplier_name text,
  created_at timestamptz not null default now()
);

create index if not exists print_projects_user_created_idx
  on public.print_projects (user_id, created_at desc);
create index if not exists project_filament_requirements_project_idx
  on public.project_filament_requirements (project_id, position);
create index if not exists project_filament_requirements_roll_idx
  on public.project_filament_requirements (preferred_roll_id);
create index if not exists project_components_project_idx
  on public.project_components (project_id, position);
create index if not exists production_runs_user_date_idx
  on public.production_runs (user_id, produced_at desc, created_at desc);
create index if not exists production_runs_project_idx
  on public.production_runs (project_id, produced_at desc);
create index if not exists production_run_filaments_run_idx
  on public.production_run_filaments (run_id);
create index if not exists production_run_filaments_roll_idx
  on public.production_run_filaments (roll_id);
create index if not exists production_run_components_run_idx
  on public.production_run_components (run_id);

drop trigger if exists set_print_projects_updated_at on public.print_projects;
create trigger set_print_projects_updated_at
before update on public.print_projects
for each row execute function public.set_updated_at();

alter table public.print_projects enable row level security;
alter table public.project_filament_requirements enable row level security;
alter table public.project_components enable row level security;
alter table public.production_runs enable row level security;
alter table public.production_run_filaments enable row level security;
alter table public.production_run_components enable row level security;

drop policy if exists "Users can read their print projects" on public.print_projects;
create policy "Users can read their print projects"
on public.print_projects for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their print projects" on public.print_projects;
create policy "Users can insert their print projects"
on public.print_projects for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their print projects" on public.print_projects;
create policy "Users can update their print projects"
on public.print_projects for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their print projects" on public.print_projects;
create policy "Users can delete their print projects"
on public.print_projects for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their project filament requirements" on public.project_filament_requirements;
create policy "Users can read their project filament requirements"
on public.project_filament_requirements for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their project filament requirements" on public.project_filament_requirements;
create policy "Users can insert their project filament requirements"
on public.project_filament_requirements for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.print_projects p
    where p.id = project_filament_requirements.project_id
      and p.user_id = (select auth.uid())
  )
  and (
    preferred_roll_id is null
    or exists (
      select 1 from public.filament_rolls r
      where r.id = project_filament_requirements.preferred_roll_id
        and r.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can update their project filament requirements" on public.project_filament_requirements;
create policy "Users can update their project filament requirements"
on public.project_filament_requirements for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.print_projects p
    where p.id = project_filament_requirements.project_id
      and p.user_id = (select auth.uid())
  )
  and (
    preferred_roll_id is null
    or exists (
      select 1 from public.filament_rolls r
      where r.id = project_filament_requirements.preferred_roll_id
        and r.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can delete their project filament requirements" on public.project_filament_requirements;
create policy "Users can delete their project filament requirements"
on public.project_filament_requirements for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their project components" on public.project_components;
create policy "Users can read their project components"
on public.project_components for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their project components" on public.project_components;
create policy "Users can insert their project components"
on public.project_components for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.print_projects p
    where p.id = project_components.project_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update their project components" on public.project_components;
create policy "Users can update their project components"
on public.project_components for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.print_projects p
    where p.id = project_components.project_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete their project components" on public.project_components;
create policy "Users can delete their project components"
on public.project_components for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their production runs" on public.production_runs;
create policy "Users can read their production runs"
on public.production_runs for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their production runs" on public.production_runs;
create policy "Users can insert their production runs"
on public.production_runs for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    project_id is null
    or exists (
      select 1 from public.print_projects p
      where p.id = production_runs.project_id
        and p.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can read their production run filaments" on public.production_run_filaments;
create policy "Users can read their production run filaments"
on public.production_run_filaments for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their production run filaments" on public.production_run_filaments;
create policy "Users can insert their production run filaments"
on public.production_run_filaments for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.production_runs pr
    where pr.id = production_run_filaments.run_id
      and pr.user_id = (select auth.uid())
  )
  and (
    roll_id is null
    or exists (
      select 1 from public.filament_rolls r
      where r.id = production_run_filaments.roll_id
        and r.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users can read their production run components" on public.production_run_components;
create policy "Users can read their production run components"
on public.production_run_components for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their production run components" on public.production_run_components;
create policy "Users can insert their production run components"
on public.production_run_components for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.production_runs pr
    where pr.id = production_run_components.run_id
      and pr.user_id = (select auth.uid())
  )
);

revoke all on table public.print_projects from public, anon, authenticated;
revoke all on table public.project_filament_requirements from public, anon, authenticated;
revoke all on table public.project_components from public, anon, authenticated;
revoke all on table public.production_runs from public, anon, authenticated;
revoke all on table public.production_run_filaments from public, anon, authenticated;
revoke all on table public.production_run_components from public, anon, authenticated;

grant select, insert, update, delete on table public.print_projects to authenticated;
grant select, insert, update, delete on table public.project_filament_requirements to authenticated;
grant select, insert, update, delete on table public.project_components to authenticated;
grant select, insert on table public.production_runs to authenticated;
grant select, insert on table public.production_run_filaments to authenticated;
grant select, insert on table public.production_run_components to authenticated;

grant select, insert, update, delete on table public.print_projects to service_role;
grant select, insert, update, delete on table public.project_filament_requirements to service_role;
grant select, insert, update, delete on table public.project_components to service_role;
grant select, insert, update, delete on table public.production_runs to service_role;
grant select, insert, update, delete on table public.production_run_filaments to service_role;
grant select, insert, update, delete on table public.production_run_components to service_role;

create or replace function public.create_print_project(
  p_project_id uuid,
  p_request_id uuid,
  p_name text,
  p_description text,
  p_version text,
  p_file_path text,
  p_file_name text,
  p_file_size_bytes bigint,
  p_license_name text,
  p_commercial_use_allowed boolean,
  p_estimated_minutes integer,
  p_requirements jsonb,
  p_components jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_project public.print_projects;
  v_roll public.filament_rolls;
  v_entry record;
  v_item jsonb;
  v_grams numeric;
  v_quantity numeric;
  v_unit_cost numeric;
  v_currency text;
  v_requirements jsonb;
  v_components jsonb;
begin
  if v_user_id is null then raise exception 'Sesion requerida'; end if;
  if p_project_id is null then raise exception 'Proyecto requerido'; end if;
  if p_request_id is null then raise exception 'Identificador de operacion requerido'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':print-project:' || p_request_id::text, 0)
  );

  select * into v_project
  from public.print_projects
  where user_id = v_user_id and creation_request_id = p_request_id;

  if found then
    if v_project.id <> p_project_id then
      raise exception 'El identificador de operacion ya fue utilizado';
    end if;

    select coalesce(jsonb_agg(to_jsonb(r) order by r.position), '[]'::jsonb)
      into v_requirements
    from public.project_filament_requirements r
    where r.project_id = v_project.id and r.user_id = v_user_id;

    select coalesce(jsonb_agg(to_jsonb(c) order by c.position), '[]'::jsonb)
      into v_components
    from public.project_components c
    where c.project_id = v_project.id and c.user_id = v_user_id;

    return jsonb_build_object(
      'project', to_jsonb(v_project),
      'requirements', v_requirements,
      'components', v_components,
      'replayed', true
    );
  end if;

  if nullif(btrim(p_name), '') is null or char_length(btrim(p_name)) > 120 then
    raise exception 'El nombre del proyecto es requerido y no puede superar 120 caracteres';
  end if;
  if p_estimated_minutes is not null and (p_estimated_minutes < 1 or p_estimated_minutes > 100000) then
    raise exception 'La duracion estimada no es valida';
  end if;
  if p_file_size_bytes is not null and (p_file_size_bytes < 0 or p_file_size_bytes > 52428800) then
    raise exception 'El archivo no puede superar 50 MB';
  end if;
  if p_file_path is not null
    and p_file_path not like v_user_id::text || '/' || p_project_id::text || '/%' then
    raise exception 'La ruta del archivo no pertenece al proyecto';
  end if;
  if jsonb_typeof(p_requirements) <> 'array' or jsonb_array_length(p_requirements) = 0 then
    raise exception 'Agrega al menos un filamento a la receta';
  end if;
  if jsonb_array_length(p_requirements) > 32 then
    raise exception 'La receta no puede superar 32 filamentos';
  end if;
  if p_components is null then p_components := '[]'::jsonb; end if;
  if jsonb_typeof(p_components) <> 'array' or jsonb_array_length(p_components) > 64 then
    raise exception 'Los insumos adicionales no son validos';
  end if;

  insert into public.print_projects (
    id, user_id, creation_request_id, name, description, version,
    file_path, file_name, file_size_bytes, license_name,
    commercial_use_allowed, estimated_minutes
  ) values (
    p_project_id, v_user_id, p_request_id, btrim(p_name),
    nullif(btrim(p_description), ''), nullif(btrim(p_version), ''),
    nullif(btrim(p_file_path), ''), nullif(btrim(p_file_name), ''), p_file_size_bytes,
    nullif(btrim(p_license_name), ''), coalesce(p_commercial_use_allowed, false),
    p_estimated_minutes
  )
  returning * into v_project;

  for v_entry in
    select value as item, ordinality::smallint as position
    from jsonb_array_elements(p_requirements) with ordinality
  loop
    v_item := v_entry.item;
    v_grams := nullif(v_item ->> 'planned_grams', '')::numeric;

    if nullif(v_item ->> 'roll_id', '') is null then
      raise exception 'Cada filamento debe asociarse a un rollo';
    end if;
    if v_grams is null or v_grams <= 0 then
      raise exception 'Los gramos previstos deben ser mayores que cero';
    end if;

    select * into v_roll
    from public.filament_rolls
    where id = (v_item ->> 'roll_id')::uuid and user_id = v_user_id;

    if not found then raise exception 'Uno de los rollos no existe o no pertenece al usuario'; end if;

    insert into public.project_filament_requirements (
      user_id, project_id, position, label, preferred_roll_id,
      brand, material, product_line, color_name, color_hex, planned_grams
    ) values (
      v_user_id, v_project.id, v_entry.position,
      nullif(btrim(v_item ->> 'label'), ''), v_roll.id,
      v_roll.brand, v_roll.material, v_roll.product_line,
      v_roll.color_name, v_roll.color_hex, v_grams
    );
  end loop;

  for v_entry in
    select value as item, ordinality::smallint as position
    from jsonb_array_elements(p_components) with ordinality
  loop
    v_item := v_entry.item;
    v_quantity := nullif(v_item ->> 'quantity', '')::numeric;
    v_unit_cost := coalesce(nullif(v_item ->> 'unit_cost', '')::numeric, 0);
    v_currency := upper(btrim(coalesce(v_item ->> 'currency', 'CRC')));

    if nullif(btrim(v_item ->> 'name'), '') is null then
      raise exception 'Cada insumo debe tener nombre';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad del insumo debe ser mayor que cero';
    end if;
    if v_unit_cost < 0 then raise exception 'El costo del insumo no puede ser negativo'; end if;
    if v_currency !~ '^[A-Z]{3}$' then raise exception 'La moneda del insumo no es valida'; end if;

    insert into public.project_components (
      user_id, project_id, position, name, unit, quantity,
      unit_cost, currency, supplier_name, notes
    ) values (
      v_user_id, v_project.id, v_entry.position, btrim(v_item ->> 'name'),
      coalesce(nullif(btrim(v_item ->> 'unit'), ''), 'unidad'),
      v_quantity, v_unit_cost, v_currency,
      nullif(btrim(v_item ->> 'supplier_name'), ''),
      nullif(btrim(v_item ->> 'notes'), '')
    );
  end loop;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.position), '[]'::jsonb)
    into v_requirements
  from public.project_filament_requirements r
  where r.project_id = v_project.id and r.user_id = v_user_id;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.position), '[]'::jsonb)
    into v_components
  from public.project_components c
  where c.project_id = v_project.id and c.user_id = v_user_id;

  return jsonb_build_object(
    'project', to_jsonb(v_project),
    'requirements', v_requirements,
    'components', v_components,
    'replayed', false
  );
end;
$$;

create or replace function public.complete_production_run(
  p_request_id uuid,
  p_project_id uuid,
  p_produced_at date,
  p_quantity integer,
  p_status text,
  p_actual_minutes integer,
  p_sale_amount numeric,
  p_sale_currency text,
  p_notes text,
  p_filaments jsonb,
  p_components jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_project public.print_projects;
  v_run public.production_runs;
  v_roll public.filament_rolls;
  v_requirement public.project_filament_requirements;
  v_component public.project_components;
  v_entry record;
  v_usage record;
  v_item jsonb;
  v_grams numeric;
  v_component_quantity numeric;
  v_unit_cost_per_g numeric;
  v_cost_amount numeric;
  v_filament_line public.production_run_filaments;
  v_component_line public.production_run_components;
  v_log public.consumption_logs;
  v_filament_lines jsonb;
  v_component_lines jsonb;
  v_updated_rolls jsonb;
  v_logs jsonb;
  v_sale_currency text := upper(btrim(p_sale_currency));
begin
  if v_user_id is null then raise exception 'Sesion requerida'; end if;
  if p_request_id is null then raise exception 'Identificador de operacion requerido'; end if;
  if p_project_id is null then raise exception 'Proyecto requerido'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':production-run:' || p_request_id::text, 0)
  );

  select * into v_run
  from public.production_runs
  where user_id = v_user_id and request_id = p_request_id;

  if found then
    if v_run.project_id is distinct from p_project_id then
      raise exception 'El identificador de operacion ya fue utilizado';
    end if;

    select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at, f.id), '[]'::jsonb)
      into v_filament_lines
    from public.production_run_filaments f
    where f.run_id = v_run.id and f.user_id = v_user_id;

    select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at, c.id), '[]'::jsonb)
      into v_component_lines
    from public.production_run_components c
    where c.run_id = v_run.id and c.user_id = v_user_id;

    select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb)
      into v_updated_rolls
    from public.filament_rolls r
    where r.user_id = v_user_id
      and r.id in (
        select f.roll_id from public.production_run_filaments f
        where f.run_id = v_run.id and f.roll_id is not null
      );

    select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at, l.id), '[]'::jsonb)
      into v_logs
    from public.consumption_logs l
    where l.user_id = v_user_id
      and l.notes = 'production-run:' || v_run.id::text;

    return jsonb_build_object(
      'run', to_jsonb(v_run),
      'filaments', v_filament_lines,
      'components', v_component_lines,
      'rolls', v_updated_rolls,
      'logs', v_logs,
      'replayed', true
    );
  end if;

  select * into v_project
  from public.print_projects
  where id = p_project_id and user_id = v_user_id
  for share;

  if not found then raise exception 'Proyecto no encontrado'; end if;
  if p_produced_at is null then raise exception 'La fecha de produccion es requerida'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100000 then
    raise exception 'La cantidad producida no es valida';
  end if;
  if p_status not in ('completed', 'partial', 'failed') then
    raise exception 'El resultado de la corrida no es valido';
  end if;
  if p_actual_minutes is not null and (p_actual_minutes < 0 or p_actual_minutes > 100000) then
    raise exception 'La duracion real no es valida';
  end if;
  if (p_sale_amount is null) <> (p_sale_currency is null) then
    raise exception 'Indica monto y moneda de venta juntos';
  end if;
  if p_sale_amount is not null and p_sale_amount < 0 then
    raise exception 'El monto de venta no puede ser negativo';
  end if;
  if p_sale_amount is not null and v_sale_currency !~ '^[A-Z]{3}$' then
    raise exception 'La moneda de venta no es valida';
  end if;
  if jsonb_typeof(p_filaments) <> 'array' or jsonb_array_length(p_filaments) = 0 then
    raise exception 'Registra al menos un consumo de filamento';
  end if;
  if jsonb_array_length(p_filaments) > 32 then raise exception 'Demasiados consumos de filamento'; end if;
  if p_components is null then p_components := '[]'::jsonb; end if;
  if jsonb_typeof(p_components) <> 'array' or jsonb_array_length(p_components) > 64 then
    raise exception 'Los insumos consumidos no son validos';
  end if;

  -- Bloquea cada rollo una sola vez y en orden estable; tambien valida el saldo agregado.
  for v_usage in
    select
      (entry.value ->> 'roll_id')::uuid as roll_id,
      sum((entry.value ->> 'grams_used')::numeric) as grams_used
    from jsonb_array_elements(p_filaments) as entry(value)
    group by (entry.value ->> 'roll_id')::uuid
    order by (entry.value ->> 'roll_id')::uuid
  loop
    if v_usage.grams_used is null or v_usage.grams_used <= 0 then
      raise exception 'Los gramos consumidos deben ser mayores que cero';
    end if;

    select * into v_roll
    from public.filament_rolls
    where id = v_usage.roll_id and user_id = v_user_id
    for update;

    if not found then raise exception 'Uno de los rollos no existe o no pertenece al usuario'; end if;
    if v_usage.grams_used > v_roll.available_weight_g then
      raise exception 'El consumo de % supera los % g disponibles en %',
        v_usage.grams_used, v_roll.available_weight_g, v_roll.color_name;
    end if;
  end loop;

  insert into public.production_runs (
    user_id, request_id, project_id, project_name, produced_at,
    quantity, status, actual_minutes, sale_amount, sale_currency, notes
  ) values (
    v_user_id, p_request_id, v_project.id, v_project.name, p_produced_at,
    p_quantity, p_status, p_actual_minutes, p_sale_amount,
    case when p_sale_amount is null then null else v_sale_currency end,
    nullif(btrim(p_notes), '')
  )
  returning * into v_run;

  for v_entry in
    select value as item, ordinality
    from jsonb_array_elements(p_filaments) with ordinality
  loop
    v_item := v_entry.item;
    v_grams := nullif(v_item ->> 'grams_used', '')::numeric;

    select * into v_requirement
    from public.project_filament_requirements
    where id = (v_item ->> 'requirement_id')::uuid
      and project_id = v_project.id
      and user_id = v_user_id;

    if not found then raise exception 'Un requisito no pertenece al proyecto'; end if;

    select * into v_roll
    from public.filament_rolls
    where id = (v_item ->> 'roll_id')::uuid and user_id = v_user_id
    for update;

    if not found then raise exception 'Rollo no encontrado'; end if;

    v_unit_cost_per_g := case
      when v_roll.filament_cost_amount is null or v_roll.initial_weight_g <= 0 then null
      else round(v_roll.filament_cost_amount / v_roll.initial_weight_g, 6)
    end;
    v_cost_amount := case
      when v_unit_cost_per_g is null then null
      else round(v_unit_cost_per_g * v_grams, 4)
    end;

    insert into public.production_run_filaments (
      user_id, run_id, project_requirement_id, roll_id,
      brand, material, product_line, color_name, color_hex,
      grams_used, unit_cost_per_g, cost_amount, currency
    ) values (
      v_user_id, v_run.id, v_requirement.id, v_roll.id,
      v_roll.brand, v_roll.material, v_roll.product_line,
      v_roll.color_name, v_roll.color_hex, v_grams,
      v_unit_cost_per_g, v_cost_amount,
      case when v_cost_amount is null then null else v_roll.currency end
    )
    returning * into v_filament_line;

    insert into public.consumption_logs (
      user_id, roll_id, project_name, grams_used, consumed_at,
      notes, cost_amount, currency, request_id
    ) values (
      v_user_id, v_roll.id, v_project.name, v_grams, p_produced_at,
      'production-run:' || v_run.id::text, v_cost_amount,
      case when v_cost_amount is null then null else v_roll.currency end,
      gen_random_uuid()
    )
    returning * into v_log;

    update public.filament_rolls
    set available_weight_g = available_weight_g - v_grams
    where id = v_roll.id and user_id = v_user_id;
  end loop;

  for v_entry in
    select value as item, ordinality
    from jsonb_array_elements(p_components) with ordinality
  loop
    v_item := v_entry.item;
    v_component_quantity := nullif(v_item ->> 'quantity', '')::numeric;

    select * into v_component
    from public.project_components
    where id = (v_item ->> 'component_id')::uuid
      and project_id = v_project.id
      and user_id = v_user_id;

    if not found then raise exception 'Un insumo no pertenece al proyecto'; end if;
    if v_component_quantity is null or v_component_quantity <= 0 then
      raise exception 'La cantidad consumida del insumo debe ser mayor que cero';
    end if;

    insert into public.production_run_components (
      user_id, run_id, project_component_id, name, unit,
      quantity, unit_cost, cost_amount, currency, supplier_name
    ) values (
      v_user_id, v_run.id, v_component.id, v_component.name, v_component.unit,
      v_component_quantity, v_component.unit_cost,
      round(v_component_quantity * v_component.unit_cost, 4),
      v_component.currency, v_component.supplier_name
    )
    returning * into v_component_line;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at, f.id), '[]'::jsonb)
    into v_filament_lines
  from public.production_run_filaments f
  where f.run_id = v_run.id and f.user_id = v_user_id;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at, c.id), '[]'::jsonb)
    into v_component_lines
  from public.production_run_components c
  where c.run_id = v_run.id and c.user_id = v_user_id;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb)
    into v_updated_rolls
  from public.filament_rolls r
  where r.user_id = v_user_id
    and r.id in (
      select f.roll_id from public.production_run_filaments f
      where f.run_id = v_run.id and f.roll_id is not null
    );

  select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at, l.id), '[]'::jsonb)
    into v_logs
  from public.consumption_logs l
  where l.user_id = v_user_id
    and l.notes = 'production-run:' || v_run.id::text;

  return jsonb_build_object(
    'run', to_jsonb(v_run),
    'filaments', v_filament_lines,
    'components', v_component_lines,
    'rolls', v_updated_rolls,
    'logs', v_logs,
    'replayed', false
  );
end;
$$;

revoke execute on function public.create_print_project(
  uuid, uuid, text, text, text, text, text, bigint,
  text, boolean, integer, jsonb, jsonb
) from public, anon;
grant execute on function public.create_print_project(
  uuid, uuid, text, text, text, text, text, bigint,
  text, boolean, integer, jsonb, jsonb
) to authenticated;

revoke execute on function public.complete_production_run(
  uuid, uuid, date, integer, text, integer, numeric, text, text, jsonb, jsonb
) from public, anon;
grant execute on function public.complete_production_run(
  uuid, uuid, date, integer, text, integer, numeric, text, text, jsonb, jsonb
) to authenticated;

comment on table public.print_projects is
  'Recetas reutilizables de impresion; los archivos viven en un bucket privado.';
comment on table public.production_runs is
  'Corridas inmutables de produccion con venta opcional y costos congelados por partida.';
comment on function public.complete_production_run(
  uuid, uuid, date, integer, text, integer, numeric, text, text, jsonb, jsonb
) is 'Registra una corrida, congela costos y descuenta todos los rollos en una sola transaccion idempotente.';

-- Archivos privados por usuario: <user_id>/<project_id>/<archivo>.
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit;

drop policy if exists "Project owners can read project files" on storage.objects;
create policy "Project owners can read project files"
on storage.objects for select to authenticated
using (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Project owners can upload project files" on storage.objects;
create policy "Project owners can upload project files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Project owners can update project files" on storage.objects;
create policy "Project owners can update project files"
on storage.objects for update to authenticated
using (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Project owners can delete project files" on storage.objects;
create policy "Project owners can delete project files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
