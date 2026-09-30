-- Stock is an append-only ledger. No editable balance or historical rewrite.
create table public.supplies (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check (length(btrim(name)) between 1 and 120),
 category text not null check (category in ('Imanes','Pines','Tornillos','Electrónica','Pintura','Empaque','Otros')),
 unit text not null check (length(btrim(unit)) between 1 and 30),
 currency text not null check (currency in ('CRC','USD','EUR')),
 created_at timestamptz not null default now(),
 unique(id,user_id)
);
create index supplies_user_idx on public.supplies(user_id);
create table public.supply_movements (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 supply_id uuid not null,
 request_id uuid not null,
 request_payload jsonb not null,
 kind text not null check (kind in ('receipt','adjustment','production')),
 quantity numeric(16,3) not null check (quantity <> 0 and quantity > -1000000000 and quantity < 1000000000),
 unit_cost numeric not null check (unit_cost >= 0 and unit_cost < 1000000000),
 cost_amount numeric not null,
 reason text not null check (length(btrim(reason)) between 1 and 500),
 run_id uuid references public.production_runs(id),
 created_at timestamptz not null default now(),
 unique(user_id,request_id),
 foreign key(supply_id,user_id) references public.supplies(id,user_id)
);
create index supply_movements_stock_idx on public.supply_movements(supply_id,user_id);
create index supply_movements_run_idx on public.supply_movements(run_id) where run_id is not null;
alter table public.supplies enable row level security;
alter table public.supply_movements enable row level security;
create policy supplies_read on public.supplies for select to authenticated using ((select auth.uid())=user_id);
create policy supplies_insert on public.supplies for insert to authenticated with check ((select auth.uid())=user_id);
create policy supply_movements_read on public.supply_movements for select to authenticated using ((select auth.uid())=user_id);
create policy supply_movements_insert on public.supply_movements for insert to authenticated with check ((select auth.uid())=user_id);
revoke all on public.supplies, public.supply_movements from anon, authenticated;
grant select,insert on public.supplies, public.supply_movements to authenticated;

create view public.supply_stock with (security_invoker=true) as
select s.*, coalesce(b.quantity,0) as quantity,
 case when coalesce(b.quantity,0)>0 then b.value/b.quantity else 0 end as unit_cost
from public.supplies s left join lateral (
 select sum(m.quantity) quantity, sum(m.cost_amount) value
 from public.supply_movements m where m.supply_id=s.id and m.user_id=s.user_id
) b on true;
revoke all on public.supply_stock from anon,authenticated;
grant select on public.supply_stock to authenticated;

-- Every ledger insertion, including direct API inserts, is serialized and checked.
create function public.validate_supply_movement() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_stock public.supply_stock;
begin
 if auth.uid() is null or new.user_id is distinct from auth.uid() then raise exception 'Sesion requerida'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text||':supply:'||new.supply_id::text,0));
 select * into v_stock from public.supply_stock where id=new.supply_id and user_id=auth.uid();
 if not found then raise exception 'Insumo no encontrado'; end if;
 if new.kind='production' and (pg_trigger_depth()<2 or new.run_id is null) then raise exception 'Consumo reservado a produccion'; end if;
 if new.kind<>'production' and new.run_id is not null then raise exception 'Movimiento no valido'; end if;
 if new.kind='receipt' and new.quantity<=0 then raise exception 'La entrada debe ser positiva'; end if;
 if new.kind='production' and new.quantity>=0 then raise exception 'Consumo no valido'; end if;
 if new.quantity<0 then
   if -new.quantity>v_stock.quantity then raise exception 'Saldo insuficiente de %: disponible % %',v_stock.name,v_stock.quantity,v_stock.unit; end if;
   new.unit_cost:=v_stock.unit_cost;
 end if;
 new.cost_amount:=new.quantity*new.unit_cost;
 return new;
end $$;
create trigger supply_movement_check before insert on public.supply_movements for each row execute function public.validate_supply_movement();
revoke execute on function public.validate_supply_movement() from public,anon,authenticated;

-- One retry key covers creation of a supply and its opening balance/receipt.
create function public.record_supply_movement(p_request_id uuid,p_values jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_supply_id uuid; v_old public.supply_movements; v_qty numeric; v_cost numeric;
begin
 if auth.uid() is null or p_request_id is null then raise exception 'Sesion e identificador requeridos'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||':supply-request:'||p_request_id::text,0));
 select * into v_old from public.supply_movements where user_id=auth.uid() and request_id=p_request_id;
 if found then
   if v_old.request_payload is distinct from p_values then raise exception 'La operacion ya se guardo con otros datos' using errcode='22023'; end if;
   v_supply_id:=v_old.supply_id;
 else
   v_supply_id:=nullif(p_values->>'supply_id','')::uuid;
   v_qty:=(p_values->>'quantity')::numeric;
   v_cost:=(p_values->>'unit_cost')::numeric;
   if v_qty is null or v_qty=0 or abs(v_qty)>=1000000000 or v_qty<>round(v_qty,3)
      or v_cost is null or v_cost<0 or v_cost>=1000000000 then raise exception 'Cantidad o costo no valido'; end if;
   if p_values->>'kind' not in ('receipt','adjustment') or p_values->>'kind' is null then raise exception 'Tipo no valido'; end if;
   if v_supply_id is null then
     if p_values->>'kind'<>'receipt' then raise exception 'El saldo inicial debe ser una entrada'; end if;
     insert into public.supplies(name,category,unit,currency)
     values(btrim(p_values->>'name'),p_values->>'category',btrim(p_values->>'unit'),p_values->>'currency')
     returning id into v_supply_id;
   end if;
   insert into public.supply_movements(supply_id,request_id,request_payload,kind,quantity,unit_cost,cost_amount,reason)
   values(v_supply_id,p_request_id,p_values,p_values->>'kind',v_qty,v_cost,0,btrim(p_values->>'reason'));
 end if;
 return jsonb_build_object('supply',(select to_jsonb(s) from public.supply_stock s where s.id=v_supply_id and s.user_id=auth.uid()),
 'movements',(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc,m.id),'[]') from public.supply_movements m where m.supply_id=v_supply_id and m.user_id=auth.uid()),
 'replayed',v_old.id is not null);
end $$;
revoke execute on function public.record_supply_movement(uuid,jsonb) from public,anon;
grant execute on function public.record_supply_movement(uuid,jsonb) to authenticated;

alter table public.project_components add column supply_id uuid;
alter table public.project_components add constraint project_component_supply_owner foreign key(supply_id,user_id) references public.supplies(id,user_id);
create index project_components_supply_idx on public.project_components(supply_id,user_id) where supply_id is not null;
alter table public.production_run_components add column supply_id uuid;
alter table public.production_run_components add constraint run_component_supply_owner foreign key(supply_id,user_id) references public.supplies(id,user_id);
create index run_components_supply_idx on public.production_run_components(supply_id,user_id) where supply_id is not null;

-- All supplies in a run are locked in the same order before any component is used.
create function public.lock_project_supplies() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
 for v_id in select distinct supply_id from public.project_components
 where project_id=new.project_id and user_id=auth.uid() and supply_id is not null order by supply_id loop
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||':supply:'||v_id::text,0));
 end loop;
 return new;
end $$;
create trigger production_lock_supplies before insert on public.production_runs for each row execute function public.lock_project_supplies();
revoke execute on function public.lock_project_supplies() from public,anon,authenticated;

-- Trigger covers all existing versions of the production RPC (including old clients).
-- Any failure rolls back the run, filament consumption and all supply movements.
create function public.consume_project_supply() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_supply_id uuid; v_stock public.supply_stock;
begin
 if new.user_id is distinct from auth.uid() then raise exception 'Sesion requerida'; end if;
 select c.supply_id into v_supply_id from public.project_components c
 join public.production_runs r on r.project_id=c.project_id and r.user_id=c.user_id
 where c.id=new.project_component_id and c.user_id=auth.uid() and r.id=new.run_id;
 if not found then raise exception 'Insumo ajeno a la corrida'; end if;
 new.supply_id:=v_supply_id;
 if v_supply_id is null then return new; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||':supply:'||v_supply_id::text,0));
 select * into strict v_stock from public.supply_stock where id=v_supply_id and user_id=auth.uid();
 insert into public.supply_movements(supply_id,request_id,request_payload,kind,quantity,unit_cost,cost_amount,reason,run_id)
 values(v_supply_id,new.id,jsonb_build_object('run_id',new.run_id,'line_id',new.id),'production',-new.quantity,0,0,'Consumo de produccion',new.run_id);
 new.name:=v_stock.name; new.unit:=v_stock.unit; new.currency:=v_stock.currency;
 new.unit_cost:=v_stock.unit_cost; new.cost_amount:=round(new.quantity*v_stock.unit_cost,4);
 new.supplier_name:=null;
 return new;
end $$;
create trigger production_consume_supply before insert on public.production_run_components for each row execute function public.consume_project_supply();
revoke execute on function public.consume_project_supply() from public,anon,authenticated;

create function public.complete_production_run_v4(p_request_id uuid,p_values jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;
begin
 v_result:=public.complete_production_run_v3(p_request_id,(p_values->>'project_id')::uuid,
 (p_values->>'produced_at')::date,(p_values->>'quantity')::integer,p_values->>'status',
 (p_values->>'actual_minutes')::integer,(p_values->>'sale_amount')::numeric,p_values->>'sale_currency',
 p_values->>'notes',p_values->'filaments',p_values->'components',(p_values->>'actual_labor_minutes')::integer,
 (p_values->>'failure_cost_amount')::numeric,(p_values->>'printer_id')::uuid);
 return v_result||jsonb_build_object('supplies',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.supply_stock s where s.user_id=auth.uid()),
 'supply_movements',(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc),'[]') from public.supply_movements m where m.user_id=auth.uid()));
end $$;
revoke execute on function public.complete_production_run_v4(uuid,jsonb) from public,anon;
grant execute on function public.complete_production_run_v4(uuid,jsonb) to authenticated;

create or replace function public.export_my_data() returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare v_table text; v_rows jsonb; v_tables jsonb := '{}'::jsonb;
begin
 if auth.uid() is null then raise exception 'Inicia sesion.' using errcode='42501'; end if;
 foreach v_table in array array[
 'supplies','supply_movements','user_profiles','filament_rolls','consumption_logs','spools','spool_types','weighing_events','suppliers',
 'purchase_history','purchase_corrections','purchase_orders','purchase_order_items','purchase_order_payments',
 'print_projects','project_filament_requirements','project_components','production_runs',
 'production_run_filaments','production_run_components','production_run_costs','printers',
 'tester_memberships','user_feedback','tester_first_visits'
 ] loop
  if to_regclass(format('public.%I',v_table)) is not null then
   execute format('select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) from public.%I r where user_id=$1',v_table)
    into v_rows using auth.uid();
   v_tables := v_tables || jsonb_build_object(v_table,v_rows);
  end if;
 end loop;
 return jsonb_build_object('format','spool-vault-account','version',1,'source','supabase',
 'exported_at',now(),'user_id',auth.uid(),'includes_binary_files',false,'tables',v_tables,
 'shared_spool_types',(select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from public.spool_types s where user_id is null));
end $$;

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
  v_supply public.supply_stock;
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
    if nullif(v_item->>'supply_id','') is not null then
      select * into v_supply from public.supply_stock where id=(v_item->>'supply_id')::uuid and user_id=v_user_id;
      if not found then raise exception 'Insumo no encontrado'; end if;
      v_item:=v_item||jsonb_build_object('name',v_supply.name,'unit',v_supply.unit,'unit_cost',v_supply.unit_cost,'currency',v_supply.currency,'supplier_name','');
    end if;
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
      unit_cost, currency, supplier_name, notes, supply_id
    ) values (
      v_user_id, v_project.id, v_entry.position, btrim(v_item ->> 'name'),
      coalesce(nullif(btrim(v_item ->> 'unit'), ''), 'unidad'),
      v_quantity, v_unit_cost, v_currency,
      nullif(btrim(v_item ->> 'supplier_name'), ''),
      nullif(btrim(v_item ->> 'notes'), ''), nullif(v_item->>'supply_id','')::uuid
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
