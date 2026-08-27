create or replace function public.assign_spool_to_roll(
  p_roll_id uuid,
  p_spool_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_roll public.filament_rolls;
  v_spool public.spools;
begin
  if (select auth.uid()) is null then
    raise exception 'Sesión requerida';
  end if;

  select *
  into v_roll
  from public.filament_rolls
  where id = p_roll_id
    and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Filamento no encontrado';
  end if;

  if v_roll.spool_id is not null then
    raise exception 'El filamento ya tiene un spool asignado';
  end if;

  select *
  into v_spool
  from public.spools
  where id = p_spool_id
    and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Spool no encontrado';
  end if;

  if v_spool.status <> 'empty' then
    raise exception 'El spool no está disponible';
  end if;

  update public.filament_rolls
  set spool_id = p_spool_id
  where id = p_roll_id
  returning * into v_roll;

  update public.spools
  set status = 'in_use'
  where id = p_spool_id
  returning * into v_spool;

  return jsonb_build_object(
    'roll', to_jsonb(v_roll),
    'spool', to_jsonb(v_spool)
  );
end;
$$;

create or replace function public.release_spool_from_roll(
  p_roll_id uuid,
  p_retire boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_roll public.filament_rolls;
  v_spool public.spools;
begin
  if (select auth.uid()) is null then
    raise exception 'Sesión requerida';
  end if;

  select *
  into v_roll
  from public.filament_rolls
  where id = p_roll_id
    and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Filamento no encontrado';
  end if;

  if v_roll.spool_id is null then
    raise exception 'El filamento no tiene un spool asignado';
  end if;

  select *
  into v_spool
  from public.spools
  where id = v_roll.spool_id
    and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Spool no encontrado';
  end if;

  update public.filament_rolls
  set spool_id = null
  where id = p_roll_id
  returning * into v_roll;

  update public.spools
  set status = case when p_retire then 'retired' else 'empty' end
  where id = v_spool.id
  returning * into v_spool;

  return jsonb_build_object(
    'roll', to_jsonb(v_roll),
    'spool', to_jsonb(v_spool)
  );
end;
$$;

create or replace function public.set_spool_retired(
  p_spool_id uuid,
  p_retired boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_roll public.filament_rolls;
  v_spool public.spools;
begin
  if (select auth.uid()) is null then
    raise exception 'Sesión requerida';
  end if;

  select *
  into v_spool
  from public.spools
  where id = p_spool_id
    and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Spool no encontrado';
  end if;

  if p_retired then
    select *
    into v_roll
    from public.filament_rolls
    where spool_id = p_spool_id
      and user_id = (select auth.uid())
      and status <> 'archived'
    for update;

    if found then
      update public.filament_rolls
      set spool_id = null
      where id = v_roll.id
      returning * into v_roll;
    end if;

    update public.spools
    set status = 'retired'
    where id = p_spool_id
    returning * into v_spool;
  else
    if v_spool.status <> 'retired' then
      raise exception 'El spool no está inactivo';
    end if;

    update public.spools
    set status = 'empty'
    where id = p_spool_id
    returning * into v_spool;
  end if;

  return jsonb_build_object(
    'roll', case when v_roll.id is null then null else to_jsonb(v_roll) end,
    'spool', to_jsonb(v_spool)
  );
end;
$$;

revoke execute on function public.assign_spool_to_roll(uuid, uuid) from public, anon;
revoke execute on function public.release_spool_from_roll(uuid, boolean) from public, anon;
revoke execute on function public.set_spool_retired(uuid, boolean) from public, anon;

grant execute on function public.assign_spool_to_roll(uuid, uuid) to authenticated;
grant execute on function public.release_spool_from_roll(uuid, boolean) to authenticated;
grant execute on function public.set_spool_retired(uuid, boolean) to authenticated;
