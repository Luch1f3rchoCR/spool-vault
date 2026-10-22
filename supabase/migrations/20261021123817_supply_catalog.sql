-- Catalog creation is independent from the append-only stock ledger.
-- Existing clients can still create an opening balance via record_supply_movement.
create function public.valid_supply_tags(p_tags text[]) returns boolean
language sql immutable security invoker set search_path='' as $$
 select p_tags is not null and cardinality(p_tags)<=10
   and (cardinality(p_tags)=0 or array_ndims(p_tags)=1)
   and not exists(select 1 from unnest(p_tags) t where t is null or length(btrim(t)) not between 1 and 40);
$$;
revoke execute on function public.valid_supply_tags(text[]) from public,anon;
grant execute on function public.valid_supply_tags(text[]) to authenticated;

alter table public.supplies
 add column tags text[] not null default '{}' check (public.valid_supply_tags(tags)),
 add column description text not null default '' check (length(description)<=2000),
 add column creation_request_id uuid,
 add column creation_payload jsonb,
 add constraint supply_creation_request_pair check (
   (creation_request_id is null and creation_payload is null)
   or (creation_request_id is not null and creation_payload is not null and jsonb_typeof(creation_payload)='object')
 ),
 add constraint supply_creation_request_unique unique(user_id,creation_request_id);

-- Preserve existing column order and append only public catalog fields.
create or replace view public.supply_stock with (security_invoker=true) as
select s.id,s.user_id,s.name,s.category,s.unit,s.currency,s.created_at,
 coalesce(b.quantity,0) as quantity,
 case when coalesce(b.quantity,0)>0 then b.value/b.quantity else 0 end as unit_cost,
 s.tags,s.description
from public.supplies s left join lateral (
 select sum(m.quantity) quantity, sum(m.cost_amount) value
 from public.supply_movements m where m.supply_id=s.id and m.user_id=s.user_id
) b on true;

create function public.create_supply(p_request_id uuid,p_values jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_supply public.supplies; v_tags text[]; v_replayed boolean;
begin
 if auth.uid() is null or p_request_id is null then
   raise exception 'Sesion e identificador requeridos' using errcode='22023';
 end if;
 if jsonb_typeof(p_values) is distinct from 'object'
    or p_values->>'kind' is distinct from 'catalog'
    or (p_values->'supply_id' is not null and p_values->'supply_id'<>'null'::jsonb)
    or p_values ?| array['quantity','unit_cost','reason','user_id'] then
   raise exception 'La ficha no admite existencias, costos ni otro propietario' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||':supply-catalog-request:'||p_request_id::text,0));
 select * into v_supply from public.supplies where user_id=auth.uid() and creation_request_id=p_request_id;
 v_replayed:=found;
 if v_replayed then
   if v_supply.creation_payload is distinct from p_values then
     raise exception 'La ficha ya se guardo con otros datos' using errcode='22023';
   end if;
 else
   if exists(select 1 from unnest(array['name','category','unit','currency']) k where jsonb_typeof(p_values->k) is distinct from 'string')
      or (p_values ? 'description' and jsonb_typeof(p_values->'description') is distinct from 'string')
      or (p_values ? 'tags' and jsonb_typeof(p_values->'tags') is distinct from 'array') then
     raise exception 'Datos de ficha no validos' using errcode='22023';
   end if;
   if exists(select 1 from jsonb_array_elements(coalesce(p_values->'tags','[]'::jsonb)) t where jsonb_typeof(t)<>'string') then
     raise exception 'Las etiquetas deben ser texto' using errcode='22023';
   end if;
   select coalesce(array_agg(btrim(value) order by position),'{}'::text[]) into v_tags
     from jsonb_array_elements_text(coalesce(p_values->'tags','[]'::jsonb)) with ordinality as t(value,position);
   insert into public.supplies(name,category,unit,currency,tags,description,creation_request_id,creation_payload)
   values(btrim(p_values->>'name'),p_values->>'category',btrim(p_values->>'unit'),p_values->>'currency',
     v_tags,coalesce(p_values->>'description',''),p_request_id,p_values)
   returning * into v_supply;
 end if;
 return jsonb_build_object(
   'supply',(select to_jsonb(s) from public.supply_stock s where s.id=v_supply.id and s.user_id=auth.uid()),
   'movements',(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc,m.id),'[]') from public.supply_movements m where m.supply_id=v_supply.id and m.user_id=auth.uid()),
   'replayed',v_replayed);
end $$;
revoke execute on function public.create_supply(uuid,jsonb) from public,anon;
grant execute on function public.create_supply(uuid,jsonb) to authenticated;
