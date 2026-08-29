-- Convierte el estado operativo del rollo en una consecuencia de sus pesos.
-- Archivado sigue siendo una decisión explícita del usuario.

create or replace function private.derive_roll_status(
  p_initial_weight_g numeric,
  p_available_weight_g numeric,
  p_low_threshold_g numeric,
  p_is_archived boolean
)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case
    when p_is_archived then 'archived'
    when p_available_weight_g <= 0 then 'empty'
    when p_available_weight_g <= p_low_threshold_g then 'low'
    when p_available_weight_g < p_initial_weight_g then 'open'
    else 'new'
  end;
$$;

create or replace function private.set_derived_roll_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_schema <> 'public' or tg_table_name <> 'filament_rolls' then
    raise exception 'Trigger de estado instalado en una tabla no permitida';
  end if;

  new.status := private.derive_roll_status(
    new.initial_weight_g,
    new.available_weight_g,
    new.low_threshold_g,
    new.status = 'archived'
  );

  return new;
end;
$$;

drop trigger if exists set_derived_roll_status on public.filament_rolls;
create trigger set_derived_roll_status
before insert or update of initial_weight_g, available_weight_g, low_threshold_g, status
on public.filament_rolls
for each row execute function private.set_derived_roll_status();

alter table public.filament_rolls
  drop constraint if exists filament_rolls_weight_bounds;

alter table public.filament_rolls
  add constraint filament_rolls_weight_bounds check (
    initial_weight_g > 0
    and available_weight_g >= 0
    and available_weight_g <= initial_weight_g
    and low_threshold_g >= 0
    and low_threshold_g <= initial_weight_g
  ) not valid;

alter table public.filament_rolls
  validate constraint filament_rolls_weight_bounds;

-- Repara etiquetas antiguas sin alterar gramos ni registros históricos.
update public.filament_rolls
set status = private.derive_roll_status(
  initial_weight_g,
  available_weight_g,
  low_threshold_g,
  status = 'archived'
)
where status <> private.derive_roll_status(
  initial_weight_g,
  available_weight_g,
  low_threshold_g,
  status = 'archived'
);

revoke all on function private.derive_roll_status(numeric, numeric, numeric, boolean)
  from public, anon, authenticated;
revoke all on function private.set_derived_roll_status()
  from public, anon, authenticated;

comment on function private.derive_roll_status(numeric, numeric, numeric, boolean) is
  'Deriva new, open, low, empty o archived desde los pesos y la decision de archivo.';
