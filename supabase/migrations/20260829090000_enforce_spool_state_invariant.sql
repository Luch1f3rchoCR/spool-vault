-- Garantiza al confirmar cada transaccion que la asignacion fisica y el estado
-- del spool describan la misma realidad.

create schema if not exists private;

-- Un spool fisico no puede quedar en dos fichas, aunque una este archivada.
create unique index if not exists filament_rolls_spool_unique_idx
  on public.filament_rolls (spool_id)
  where spool_id is not null;

drop index if exists public.filament_rolls_active_spool_idx;

create or replace function private.enforce_spool_state_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_spool_id uuid;
  v_spool_ids uuid[];
  v_spool_status text;
  v_spool_user_id uuid;
  v_assignment_count integer;
  v_cross_user_count integer;
begin
  if tg_table_schema <> 'public'
    or tg_table_name not in ('filament_rolls', 'spools') then
    raise exception 'Trigger de consistencia instalado en una tabla no permitida';
  end if;

  if tg_table_name = 'filament_rolls' then
    if tg_op = 'INSERT' then
      v_spool_ids := array[new.spool_id];
    elsif tg_op = 'DELETE' then
      v_spool_ids := array[old.spool_id];
    else
      v_spool_ids := array[old.spool_id, new.spool_id];
    end if;
  else
    if tg_op = 'INSERT' then
      v_spool_ids := array[new.id];
    elsif tg_op = 'DELETE' then
      v_spool_ids := array[old.id];
    else
      v_spool_ids := array[old.id, new.id];
    end if;
  end if;

  foreach v_spool_id in array v_spool_ids loop
    continue when v_spool_id is null;

    select s.status, s.user_id
    into v_spool_status, v_spool_user_id
    from public.spools s
    where s.id = v_spool_id;

    if not found then
      if exists (
        select 1 from public.filament_rolls r where r.spool_id = v_spool_id
      ) then
        raise exception 'Un filamento referencia un spool inexistente';
      end if;
      continue;
    end if;

    select
      count(*)::integer,
      count(*) filter (where r.user_id <> v_spool_user_id)::integer
    into v_assignment_count, v_cross_user_count
    from public.filament_rolls r
    where r.spool_id = v_spool_id;

    if v_cross_user_count > 0 then
      raise exception 'El spool y el filamento deben pertenecer al mismo usuario';
    end if;

    if v_spool_status = 'in_use' and v_assignment_count <> 1 then
      raise exception 'Un spool en uso debe estar asignado exactamente a un filamento';
    end if;

    if v_spool_status <> 'in_use' and v_assignment_count <> 0 then
      raise exception 'Un spool asignado debe tener estado en uso';
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists enforce_spool_state_after_roll_change on public.filament_rolls;
create constraint trigger enforce_spool_state_after_roll_change
after insert or update or delete on public.filament_rolls
deferrable initially deferred
for each row execute function private.enforce_spool_state_consistency();

drop trigger if exists enforce_spool_state_after_spool_change on public.spools;
create constraint trigger enforce_spool_state_after_spool_change
after insert or update or delete on public.spools
deferrable initially deferred
for each row execute function private.enforce_spool_state_consistency();

-- Los flujos del producto conservan registros y usan inactivacion, no borrado.
revoke delete, truncate on table public.filament_rolls from authenticated;
revoke delete, truncate on table public.spools from authenticated;

revoke all on function private.enforce_spool_state_consistency() from public, anon, authenticated;

comment on function private.enforce_spool_state_consistency() is
  'Valida al commit que spool_id y spools.status permanezcan sincronizados.';
