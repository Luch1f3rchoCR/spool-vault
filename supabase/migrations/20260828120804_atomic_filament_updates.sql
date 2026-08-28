-- Edición segura del filamento sin reescribir compras, consumos ni pesajes históricos.

alter table public.filament_rolls
  add column if not exists last_update_request_id uuid;

create unique index if not exists filament_rolls_user_last_update_request_idx
  on public.filament_rolls (user_id, last_update_request_id)
  where last_update_request_id is not null;

create or replace function public.update_filament_roll(
  p_request_id uuid,
  p_roll_id uuid,
  p_brand text,
  p_product_line text,
  p_material text,
  p_color_name text,
  p_color_hex text,
  p_initial_weight_g numeric,
  p_low_threshold_g numeric,
  p_location text,
  p_drying_notes text,
  p_photo_url text,
  p_purchase_url text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_roll public.filament_rolls;
  v_status text;
  v_color_hex text := upper(btrim(p_color_hex));
begin
  if v_user_id is null then raise exception 'Sesión requerida'; end if;
  if p_request_id is null then raise exception 'Identificador de operación requerido'; end if;

  select * into v_roll
  from public.filament_rolls
  where id = p_roll_id and user_id = v_user_id
  for update;

  if not found then raise exception 'Filamento no encontrado'; end if;

  if v_roll.last_update_request_id = p_request_id then
    return jsonb_build_object('roll', to_jsonb(v_roll), 'replayed', true);
  end if;

  if nullif(btrim(p_brand), '') is null then raise exception 'La marca es requerida'; end if;
  if nullif(btrim(p_material), '') is null then raise exception 'El material es requerido'; end if;
  if nullif(btrim(p_color_name), '') is null then raise exception 'El color es requerido'; end if;
  if v_color_hex is null or v_color_hex !~ '^#[0-9A-F]{6}$' then
    raise exception 'El HEX debe tener el formato #RRGGBB';
  end if;
  if p_initial_weight_g is null or p_initial_weight_g <= 0 then
    raise exception 'El peso inicial debe ser mayor que cero';
  end if;
  if p_initial_weight_g < v_roll.available_weight_g then
    raise exception 'El peso inicial no puede ser menor al saldo disponible';
  end if;
  if p_low_threshold_g is null or p_low_threshold_g < 0 or p_low_threshold_g > p_initial_weight_g then
    raise exception 'El umbral bajo debe estar entre cero y el peso inicial';
  end if;

  v_status := case
    when v_roll.status = 'archived' then 'archived'
    when v_roll.available_weight_g <= 0 then 'empty'
    when v_roll.available_weight_g <= p_low_threshold_g then 'low'
    when v_roll.available_weight_g < p_initial_weight_g then 'open'
    else 'new'
  end;

  update public.filament_rolls
  set
    brand = btrim(p_brand),
    product_line = nullif(btrim(p_product_line), ''),
    material = btrim(p_material),
    color_name = btrim(p_color_name),
    color_hex = v_color_hex,
    initial_weight_g = p_initial_weight_g,
    low_threshold_g = p_low_threshold_g,
    status = v_status,
    location = nullif(btrim(p_location), ''),
    drying_notes = nullif(btrim(p_drying_notes), ''),
    photo_url = nullif(btrim(p_photo_url), ''),
    purchase_url = nullif(btrim(p_purchase_url), ''),
    last_update_request_id = p_request_id
  where id = v_roll.id
  returning * into v_roll;

  return jsonb_build_object('roll', to_jsonb(v_roll), 'replayed', false);
end;
$$;

revoke execute on function public.update_filament_roll(
  uuid, uuid, text, text, text, text, text, numeric, numeric, text, text, text, text
) from public, anon;

grant execute on function public.update_filament_roll(
  uuid, uuid, text, text, text, text, text, numeric, numeric, text, text, text, text
) to authenticated;
