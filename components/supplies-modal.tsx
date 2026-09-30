"use client";

import { useRef, useState } from "react";
import { Plus, PackagePlus, History } from "lucide-react";
import { ModalFrame } from "@/components/modal-frame";
import type { Supply, SupplyMovement, SupplyValues } from "@/lib/supplies";

const categories = ["Imanes", "Pines", "Tornillos", "Electrónica", "Pintura", "Empaque", "Otros"];
const money = (amount: number, currency: string) => new Intl.NumberFormat("es-CR", {style:"currency",currency,maximumFractionDigits:2}).format(amount);
type Pending = {id:string; values:SupplyValues};
function readPending(key:string): Pending | null {
  try { const item=JSON.parse(sessionStorage.getItem(key) ?? "null"); return item?.id && item?.values ? item : null; } catch {return null;}
}

export function SuppliesModal({supplies, movements, authenticated, baseCurrency, pendingKey, onSave, onClose}: {
  supplies: Supply[]; movements: SupplyMovement[]; authenticated: boolean; baseCurrency: string;
  pendingKey: string;
  onSave: (values: SupplyValues, requestId: string) => Promise<{error:string;uncertain:boolean}>; onClose: () => void;
}) {
  const [initialPending]=useState(()=>readPending(pendingKey));
  const [editing,setEditing]=useState<Supply | "new" | null>(()=>initialPending ? supplies.find(s=>s.id===initialPending.values.supply_id) ?? "new" : null);
  const [history,setHistory]=useState<Supply | null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [search,setSearch]=useState("");
  const [kind,setKind]=useState<"receipt" | "adjustment">("receipt");
  const [quantity,setQuantity]=useState("1");
  const [currency,setCurrency]=useState(baseCurrency);
  const [pending,setPending]=useState<Pending | null>(initialPending);
  const guard=useRef(false);
  const selected=editing && editing!=="new" ? editing : null;
  function start(item: Supply | "new") { setEditing(item); setKind("receipt");setQuantity("1");setMessage("");setPending(null); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(guard.current || !authenticated) return;
    const form=event.currentTarget, data=new FormData(form);
    const values: SupplyValues=pending?.values ?? {
      supply_id:selected?.id ?? null, name:String(data.get("name") ?? ""), category:String(data.get("category") ?? "Otros"),
      unit:selected?.unit ?? String(data.get("unit")), currency:selected?.currency ?? String(data.get("currency")),
      kind, quantity:Number(quantity), unit_cost:Number(data.get("cost") ?? 0), reason:String(data.get("reason"))
    };
    const requestId=pending?.id ?? crypto.randomUUID();
    guard.current=true;setBusy(true);setPending({id:requestId,values});setMessage("");
    try {
      sessionStorage.setItem(pendingKey,JSON.stringify({id:requestId,values}));
      const result=await onSave(values,requestId);
      if(result.error) {setMessage(result.error); if(!result.uncertain) {sessionStorage.removeItem(pendingKey);setPending(null);}}
      else { sessionStorage.removeItem(pendingKey);setEditing(null);setPending(null);setMessage("Insumo y existencias guardados correctamente."); }
    } catch {setMessage("No se pudo conservar o confirmar la operación. Reintentá sin cambiar los datos.");}
    finally {guard.current=false;setBusy(false);}
  }
  return <ModalFrame title="Insumos" titleId="supplies-title" eyebrow="Inventario del taller" className="projects-modal supplies-modal" busy={busy || !!pending} onClose={onClose} viewKey={editing ? "edit" : history?.id ?? "list"}>
    <p className="project-mode-note">Imanes, pines y otros materiales. Guardar un proyecto no consume stock; registrar su impresión sí. El costo promedio se congela en cada impresión.</p>
    {!authenticated && <p role="status" className="project-mode-note">Iniciá sesión para administrar existencias de insumos. Los extras manuales de proyectos siguen disponibles en modo local.</p>}
    {message && <p role="status" className="spool-operation-note">{message}</p>}
    {editing ? <form className="project-form" onSubmit={submit}>
      <h3>{selected ? selected.name : "Nuevo insumo"}</h3>
      <fieldset disabled={busy || !!pending} className="form-grid">
        {!selected && <><label>Nombre<input name="name" required maxLength={120} placeholder="Imán 6 × 2 mm" /></label>
        <label>Categoría<select name="category">{categories.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Unidad<input name="unit" required maxLength={30} defaultValue="unidad" /></label>
        <label>Moneda<select name="currency" value={currency} onChange={event=>setCurrency(event.target.value)}>{["CRC","USD","EUR"].map(c=><option key={c}>{c}</option>)}</select></label></>}
        {selected && <label>Movimiento<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="receipt">Entrada / compra</option><option value="adjustment">Ajuste con motivo</option></select></label>}
        <label>{kind==="receipt" ? "Cantidad que ingresa" : "Diferencia (+ agrega, − retira)"}<input type="number" required min={kind==="receipt" ? "0.001" : undefined} max="999999999" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)} /></label>
        <label>Costo por unidad ({selected?.currency ?? currency})<input name="cost" type="number" required min="0" max="999999999" step="0.0001" defaultValue={selected?.unit_cost.toFixed(4) ?? ""} disabled={Number(quantity)<0} /></label>
        <label className="wide">Motivo / proveedor / referencia<input name="reason" required maxLength={500} placeholder="Compra de paquete de 100 · proveedor…" /></label>
      </fieldset>
      <p className="project-mode-note">Ingresá el costo de una unidad, no el total del paquete. Las entradas recalculan el promedio ponderado. Los retiros usan el promedio actual. No se mezclan monedas ni se cambia el histórico.</p>
      {pending && !busy && <p role="alert">Operación pendiente: {pending.values.quantity} {pending.values.unit} · {pending.values.reason}. Reintentá sin cambiar los datos para evitar duplicados, incluso después de recargar.</p>}
      <div className="section-head"><button type="button" disabled={busy || !!pending} onClick={()=>setEditing(null)}>Cancelar</button><button className="primary-action" disabled={busy || Number(quantity)===0} type="submit">{busy ? "Guardando…" : pending ? "Reintentar" : "Guardar movimiento"}</button></div>
    </form> : history ? <section>
      <button type="button" onClick={()=>setHistory(null)}>Volver a insumos</button><h3>Historial · {history.name}</h3>
      {movements.filter(m=>m.supply_id===history.id).map(m=><article className="run-component-row" key={m.id}><div><strong>{m.kind==="production" ? "Producción" : m.kind==="receipt" ? "Entrada" : "Ajuste"} · {Number(m.quantity)>0 ? "+" : ""}{Number(m.quantity)} {history.unit}</strong><small>{m.reason} · {new Date(m.created_at).toLocaleDateString("es-CR")}</small></div><span>{money(Number(m.unit_cost),history.currency)} / {history.unit}</span></article>)}
    </section> : <>
      <div className="section-head"><label>Buscar insumo<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Imán, pin, empaque…" /></label><button className="primary-action" disabled={!authenticated} onClick={()=>start("new")}><Plus size={18}/>Nuevo insumo</button></div>
      <div className="project-list">{supplies.filter(s=>(s.name+" "+s.category).toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(s=><article className="project-card" key={s.id}>
        <p className="eyebrow">{s.category}</p><h3>{s.name}</h3><p><strong>{s.quantity.toLocaleString("es-CR")} {s.unit}</strong> disponibles</p><p>{money(s.unit_cost,s.currency)} / {s.unit} · costo promedio</p>
        <div className="section-head"><button disabled={!authenticated} onClick={()=>start(s)}><PackagePlus size={16}/>Entrada / ajuste</button><button onClick={()=>setHistory(s)}><History size={16}/>Historial</button></div>
      </article>)}</div>{!supplies.length && <p className="empty-state">Agregá tu primer insumo; luego elegilo desde la receta de un proyecto.</p>}
    </>}
  </ModalFrame>;
}
