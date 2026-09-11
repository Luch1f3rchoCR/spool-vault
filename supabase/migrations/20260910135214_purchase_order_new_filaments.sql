-- Compose existing roll and order operations in ONE transaction. No historical
-- purchases, balances or prices are rewritten. New rolls start at full weight.
create table public.purchase_order_creation_requests (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  request_id uuid not null,
  order_id uuid not null references public.purchase_orders(id) on delete cascade,
  payload jsonb not null,
  primary key (user_id, request_id)
);
create index purchase_order_creation_requests_order_idx on public.purchase_order_creation_requests(order_id);
alter table public.purchase_order_creation_requests enable row level security;
revoke all on public.purchase_order_creation_requests from public, anon, authenticated;
grant select, insert on public.purchase_order_creation_requests to authenticated;
grant all on public.purchase_order_creation_requests to service_role;
create policy order_requests_read on public.purchase_order_creation_requests for select to authenticated
using (user_id=(select auth.uid()));
create policy order_requests_insert on public.purchase_order_creation_requests for insert to authenticated
with check (user_id=(select auth.uid()) and exists (
 select 1 from public.purchase_orders o where o.id=order_id and o.user_id=(select auth.uid()) and o.request_id=purchase_order_creation_requests.request_id
));

create function public.create_purchase_order_v3(p_request_id uuid, p_order jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
 v_user uuid := auth.uid(); v_saved public.purchase_order_creation_requests;
 v_order_id uuid; v_ids uuid[]; v_line jsonb; v_created jsonb; v_result jsonb;
 v_manual jsonb; v_new jsonb; v_purchase_id uuid;
 v_amount text; v_field text;
 v_line_id uuid; v_seen uuid[] := '{}'; v_weight numeric; v_price numeric; v_spool numeric;
begin
 if v_user is null then raise exception 'Sesion requerida' using errcode='42501'; end if;
 if p_request_id is null or jsonb_typeof(p_order) is distinct from 'object'
   or octet_length(p_order::text)>100000 then raise exception 'Orden no valida' using errcode='22023'; end if;
 -- Same lock as v1/v2: old clients and concurrent retries cannot split an order.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':purchase-order:'||p_request_id::text,0));
 select * into v_saved from public.purchase_order_creation_requests where user_id=v_user and request_id=p_request_id;
 if found then
   if v_saved.payload <> p_order then raise exception 'La operacion ya existe con datos diferentes' using errcode='22023'; end if;
   v_order_id := v_saved.order_id;
 else
   if coalesce(p_order->>'allocation_method','') not in ('per_unit','by_value','manual')
     or coalesce(p_order->>'cost_confidence','') not in ('actual','estimated','incomplete') then raise exception 'Revisa el reparto y la confianza del costo'; end if;
   foreach v_field in array array['shipping_amount','other_charges_amount','paid_amount','exchange_rate'] loop
     v_amount := p_order->>v_field;
     if v_amount is not null and ((v_amount::numeric)::text in ('NaN','Infinity','-Infinity') or v_amount::numeric<0) then
       raise exception 'Los importes deben ser numeros finitos no negativos';
     end if;
   end loop;
   if exists(select 1 from public.purchase_orders where user_id=v_user and request_id=p_request_id) then
     raise exception 'Esta operacion pertenece a una orden anterior; no se agregaron filamentos';
   end if;
   if jsonb_typeof(p_order->'purchase_ids') is distinct from 'array'
     or jsonb_typeof(p_order->'new_rolls') is distinct from 'array' then raise exception 'Partidas no validas'; end if;
   v_new := p_order->'new_rolls';
   if jsonb_array_length(v_new)+jsonb_array_length(p_order->'purchase_ids') not between 1 and 100 then
     raise exception 'La orden requiere entre 1 y 100 partidas';
   end if;
   select coalesce(array_agg(value::uuid order by value),'{}') into v_ids from jsonb_array_elements_text(p_order->'purchase_ids');
   v_manual := coalesce(p_order->'manual_allocations','{}');
   if jsonb_typeof(v_manual)<>'object' then raise exception 'Reparto no valido'; end if;
   if jsonb_array_length(v_new)>0 and (
      coalesce(char_length(btrim(p_order->>'supplier_name')),0) not between 1 and 200
      or coalesce(p_order->>'currency','') !~ '^[A-Z]{3}$') then raise exception 'Indica proveedor y moneda de los filamentos nuevos'; end if;
   for v_line in select value from jsonb_array_elements(v_new) loop
     if jsonb_typeof(v_line)<>'object' then raise exception 'Filamento no valido'; end if;
     v_line_id := (v_line->>'line_id')::uuid;
     if v_line_id is null or v_line_id=any(v_seen) or v_line_id=any(v_ids) then raise exception 'Identificador de partida repetido o no valido'; end if;
     v_seen := array_append(v_seen,v_line_id);
     v_weight := (v_line->>'quantity_g')::numeric;
     v_price := (v_line->>'total_price')::numeric;
     v_spool := (v_line->>'spool_cost')::numeric;
     if v_weight is null or v_weight::text in ('NaN','Infinity','-Infinity') or v_weight<=0 or v_weight>999999
       or v_price is null or v_price::text in ('NaN','Infinity','-Infinity') or v_price<0 or v_price<>round(v_price,2)
       or v_spool is null or v_spool::text in ('NaN','Infinity','-Infinity') or v_spool<0 or v_spool>v_price or v_spool<>round(v_spool,2)
       or coalesce(v_line->>'package_type','') not in ('spooled','refill')
       or (v_line->>'package_type'='refill' and v_spool<>0) then raise exception 'Revisa peso, precio y costo de spool'; end if;
     -- line_id is a draft/allocation key, NOT a user-controlled roll request ID.
     v_created := public.create_roll_with_purchase(gen_random_uuid(),
       v_line->>'brand',v_line->>'product_line',v_line->>'material',v_line->>'color_name',v_line->>'color_hex',
       v_weight,v_weight,200,v_line->>'location',(p_order->>'purchased_at')::date,
       v_price,p_order->>'currency',p_order->>'supplier_name',v_line->>'package_type',v_spool,null,null,null);
     v_purchase_id := (v_created->'purchase'->>'id')::uuid;
     if v_purchase_id is null then raise exception 'No se pudo confirmar la compra del filamento'; end if;
     v_ids := array_append(v_ids,v_purchase_id);
     if p_order->>'allocation_method'='manual' then
       if not (v_manual ? v_line_id::text) then raise exception 'Falta el reparto de un filamento nuevo'; end if;
       v_manual := v_manual || jsonb_build_object(v_purchase_id::text,v_manual->v_line_id::text);
     end if;
   end loop;
   v_result := public.create_purchase_order_v2(p_request_id,v_ids,(p_order->>'purchased_at')::date,
     (p_order->>'shipping_amount')::numeric,(p_order->>'other_charges_amount')::numeric,
     p_order->>'allocation_method',p_order->>'cost_confidence',p_order->>'notes',v_manual,
     (p_order->>'paid_amount')::numeric,p_order->>'paid_currency',(p_order->>'exchange_rate')::numeric,
     (p_order->>'exchange_rate_date')::date,p_order->>'exchange_rate_kind',nullif(p_order->>'exchange_rate_source',''));
   v_order_id := (v_result->'order'->>'id')::uuid;
   insert into public.purchase_order_creation_requests(user_id,request_id,order_id,payload)
     values(v_user,p_request_id,v_order_id,p_order);
 end if;
 -- Read current roll balances on replay, never return a stale initial weight.
 return jsonb_build_object(
   'order',(select to_jsonb(o) from public.purchase_orders o where o.id=v_order_id and o.user_id=v_user),
   'items',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') from public.purchase_order_items i where i.order_id=v_order_id and i.user_id=v_user),
   'payment',(select to_jsonb(p) from public.purchase_order_payments p where p.order_id=v_order_id and p.user_id=v_user),
   'rolls',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.filament_rolls r where r.user_id=v_user and r.id in(select i.roll_id from public.purchase_order_items i where i.order_id=v_order_id and i.user_id=v_user)),
   'purchases',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.purchase_history p where p.user_id=v_user and p.id in(select i.purchase_history_id from public.purchase_order_items i where i.order_id=v_order_id and i.user_id=v_user)),
   'suppliers',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.suppliers s where s.user_id=v_user and s.id in(select o.supplier_id from public.purchase_orders o where o.id=v_order_id and o.user_id=v_user)),
   'replayed',v_saved.order_id is not null);
end $$;
revoke all on function public.create_purchase_order_v3(uuid,jsonb) from public,anon;
grant execute on function public.create_purchase_order_v3(uuid,jsonb) to authenticated;
