"use client";

import { useRef, useState } from "react";
import { Plus, PackagePlus, History, Boxes, Search, ArrowLeft, Info } from "lucide-react";
import { ModalFrame } from "@/components/modal-frame";
import { parseSupplyTags, type Supply, type SupplyMovement, type SupplySaveValues } from "@/lib/supplies";
import styles from "./supplies-modal.module.css";

const categories = ["Imanes", "Pines", "Tornillos", "Electrónica", "Pintura", "Empaque", "Otros"];
const unitOptions = [
  { value: "unidad", label: "Unidad (pieza)" },
  { value: "metro", label: "Metro (m)" },
  { value: "gramo", label: "Gramo (g)" },
  { value: "kilogramo", label: "Kilogramo (kg)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "litro", label: "Litro (l)" }
];
const money = (amount: number, currency: string) => new Intl.NumberFormat("es-CR", {style:"currency",currency,maximumFractionDigits:2}).format(amount);
type Pending = {id:string; values:SupplySaveValues};
function readPending(key:string): Pending | null {
  try { const item=JSON.parse(sessionStorage.getItem(key) ?? "null"); return item?.id && item?.values ? item : null; } catch {return null;}
}

export function SuppliesModal({supplies, movements, authenticated, baseCurrency, pendingKey, onSave, onClose}: {
  supplies: Supply[]; movements: SupplyMovement[]; authenticated: boolean; baseCurrency: string;
  pendingKey: string;
  onSave: (values: SupplySaveValues, requestId: string) => Promise<{error:string;uncertain:boolean}>; onClose: () => void;
}) {
  const [initialPending]=useState(()=>readPending(pendingKey));
  const [editing,setEditing]=useState<Supply | "new" | null>(()=>initialPending ? supplies.find(s=>s.id===initialPending.values.supply_id) ?? "new" : null);
  const [history,setHistory]=useState<Supply | null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [search,setSearch]=useState("");
  const [kind,setKind]=useState<"receipt" | "adjustment">("receipt");
  const [quantity,setQuantity]=useState("1");
  const [currency,setCurrency]=useState(initialPending?.values.currency ?? baseCurrency);
  const pendingUnit=initialPending?.values.unit ?? "unidad";
  const [unitChoice,setUnitChoice]=useState(()=>unitOptions.some(option=>option.value===pendingUnit) ? pendingUnit : "__custom__");
  const [customUnit,setCustomUnit]=useState(()=>unitOptions.some(option=>option.value===pendingUnit) ? "" : pendingUnit);
  const [pending,setPending]=useState<Pending | null>(initialPending);
  const guard=useRef(false);
  const selected=editing && editing!=="new" ? editing : null;
  // Old pending opening balances must still retry their original operation after deployment.
  const creating=!selected && (!pending || pending.values.kind==="catalog");
  const catalogDraft=pending?.values.kind==="catalog" ? pending.values : null;
  const filteredSupplies=supplies.filter(s=>(s.name+" "+s.category+" "+(s.tags ?? []).join(" ")).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const historyMovements=history ? movements.filter(m=>m.supply_id===history.id) : [];
  function start(item: Supply | "new") { setEditing(item); setKind("receipt");setQuantity("1");setMessage("");setPending(null);setUnitChoice("unidad");setCustomUnit(""); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(guard.current || !authenticated) return;
    const form=event.currentTarget, data=new FormData(form);
    let tags: string[]=[];
    if(creating && !pending) {
      try { tags=parseSupplyTags(String(data.get("tags") ?? "")); }
      catch(error) { setMessage(error instanceof Error ? error.message : "Revisá las etiquetas."); return; }
    }
    const values: SupplySaveValues=pending?.values ?? (creating ? {
      kind:"catalog", supply_id:null, name:String(data.get("name") ?? ""), category:String(data.get("category")),
      unit:String(data.get("unit")), currency:String(data.get("currency")), tags, description:String(data.get("description") ?? "")
    } : {
      supply_id:selected?.id ?? null, name:String(data.get("name") ?? ""), category:String(data.get("category") ?? "Otros"),
      unit:selected?.unit ?? String(data.get("unit")), currency:selected?.currency ?? String(data.get("currency")),
      kind, quantity:Number(quantity), unit_cost:Number(data.get("cost") ?? 0), reason:String(data.get("reason")),
      ...(Number(quantity)>0 ? {purchased_at:String(data.get("purchased_at") ?? "")} : {})
    });
    const requestId=pending?.id ?? crypto.randomUUID();
    guard.current=true;setBusy(true);setPending({id:requestId,values});setMessage("");
    try {
      sessionStorage.setItem(pendingKey,JSON.stringify({id:requestId,values}));
      const result=await onSave(values,requestId);
      if(result.error) {setMessage(result.error); if(!result.uncertain) {sessionStorage.removeItem(pendingKey);setPending(null);}}
      else { sessionStorage.removeItem(pendingKey);setEditing(null);setPending(null);setMessage(values.kind==="catalog" ? "Ficha creada sin existencias. Usá Entrada / ajuste para ingresar cantidades y costos." : "Insumo y existencias guardados correctamente."); }
    } catch {setMessage("No se pudo conservar o confirmar la operación. Reintentá sin cambiar los datos.");}
    finally {guard.current=false;setBusy(false);}
  }
  return <ModalFrame title="Insumos" titleId="supplies-title" eyebrow="Inventario del taller" className={`supplies-modal ${styles.modal}`} busy={busy || !!pending} onClose={onClose} viewKey={editing ? "edit" : history?.id ?? "list"}>
    <p className={styles.intro}>Imanes, pines y materiales que completan tus proyectos.</p>
    {!authenticated && <div role="status" className={styles.notice}><Info size={20} aria-hidden="true"/><p><strong>Tu inventario de insumos está en tu cuenta</strong>Iniciá sesión para administrar existencias. Los extras manuales de proyectos siguen disponibles en modo local.</p></div>}
    {message && <p role="status" className={styles.feedback}>{message}</p>}
    {editing ? <form className={styles.form} onSubmit={submit}>
      <header className={styles.viewHeading}>
        <h3>{selected ? selected.name : "Nuevo insumo"}</h3>
        <p>{selected ? `${selected.quantity.toLocaleString("es-CR")} ${selected.unit} disponibles · ${selected.category}` : creating ? "Creá la ficha del material. Las existencias se ingresan después." : "Recuperamos tu entrada pendiente. Reintentá sin cambiar sus datos."}</p>
      </header>
      {!selected && <fieldset disabled={busy || !!pending} className={styles.fieldset}>
        <legend>Datos del insumo</legend>
        <div className={styles.fields}>
          <label>Nombre<input name="name" required maxLength={120} pattern=".*\S.*" defaultValue={catalogDraft?.name} placeholder="Imán 6 × 2 mm" /></label>
          <label>Categoría<select name="category" defaultValue={catalogDraft?.category}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
          <label>Unidad de medida<select name={unitChoice==="__custom__" ? undefined : "unit"} value={unitChoice} onChange={event=>setUnitChoice(event.target.value)} aria-describedby="supply-unit-help">
            {unitOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
            <option value="__custom__">Otra unidad…</option>
          </select></label>
          <label>Moneda<select name="currency" value={currency} onChange={event=>setCurrency(event.target.value)}>{["CRC","USD","EUR"].map(c=><option key={c}>{c}</option>)}</select></label>
          {unitChoice==="__custom__" && <label className={styles.wide}>Nombre de la unidad<input name="unit" required maxLength={30} pattern=".*\S.*" value={customUnit} onChange={event=>setCustomUnit(event.target.value)} placeholder="Por ejemplo: par" aria-describedby="supply-unit-help" /></label>}
          {creating && <>
            <label className={styles.wide}>Etiquetas (opcional)<input name="tags" maxLength={418} defaultValue={catalogDraft?.tags.join(", ")} placeholder="Neodimio, cajas, figuras" aria-describedby="supply-tags-help" /></label>
            <p id="supply-tags-help" className={`${styles.help} ${styles.wide}`}>Separalas con comas: hasta 10 etiquetas de 40 caracteres.</p>
            <label className={styles.wide}>Descripción (opcional)<textarea name="description" maxLength={2000} rows={3} defaultValue={catalogDraft?.description} placeholder="Medidas, características o notas del material…" /></label>
          </>}
        </div>
        <p id="supply-unit-help" className={styles.help}>Usá la misma unidad para la cantidad y el costo: por pieza, metro, gramo… No se convierten unidades automáticamente.</p>
      </fieldset>}
      {!creating && <fieldset disabled={busy || !!pending} className={styles.fieldset}>
        <legend>{selected ? "Movimiento de existencias" : "Existencias iniciales"}</legend>
        <div className={styles.fields}>
        {selected && <label className={styles.wide}>Movimiento<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="receipt">Entrada de existencias</option><option value="adjustment">Ajuste con motivo</option></select></label>}
        <label>{kind==="receipt" ? "Cantidad que ingresa" : "Diferencia (+ agrega, − retira)"}<input type="number" required min={kind==="receipt" ? "0.001" : undefined} max="999999999" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)} /></label>
        <label>Costo por unidad ({selected?.currency ?? currency})<input name="cost" type="number" required min="0" max="999999999" step="0.0001" defaultValue={selected?.unit_cost.toFixed(4) ?? ""} disabled={Number(quantity)<0} aria-describedby="supply-cost-help" /></label>
        {Number(quantity)>0 && <label>Fecha de compra / adquisición<input name="purchased_at" type="date" required
          defaultValue={pending && pending.values.kind!=="catalog" ? pending.values.purchased_at ?? "" : new Intl.DateTimeFormat("en-CA",{timeZone:"America/Costa_Rica"}).format(new Date())} /></label>}
        <label className={styles.wide}>Motivo / proveedor / referencia<input name="reason" required maxLength={500} placeholder="Compra de paquete de 100 · proveedor…" /></label>
        </div>
        <p id="supply-cost-help" className={styles.help}>Ingresá el costo de una unidad, no el total del paquete. Los retiros usan el costo promedio actual.</p>
      </fieldset>}
      <p className={styles.help}>{creating ? "La ficha empieza con 0 existencias. No crea una compra, un costo ni un movimiento de inventario. La moneda se usará para las entradas directas; no convierte importes." : "Las entradas actualizan el promedio ponderado, sin cambiar costos históricos. Este movimiento no crea una orden de compra."}</p>
      {pending && !busy && <p role="alert" className={styles.pending}>Operación pendiente: {pending.values.kind==="catalog" ? `ficha de ${pending.values.name}` : `${pending.values.quantity} ${pending.values.unit} · ${pending.values.reason}`}. Reintentá sin cambiar los datos para evitar duplicados, incluso después de recargar.</p>}
      <div className={styles.formActions}><button type="button" disabled={busy || !!pending} onClick={()=>setEditing(null)}>Cancelar</button><button className={styles.primary} disabled={busy || (!creating && Number(quantity)===0)} type="submit">{busy ? "Guardando…" : pending ? "Reintentar" : creating ? "Crear ficha" : "Guardar movimiento"}</button></div>
    </form> : history ? <section className={styles.history}>
      <button className={styles.back} type="button" onClick={()=>setHistory(null)}><ArrowLeft size={17} aria-hidden="true"/>Volver a insumos</button>
      <header className={styles.viewHeading}><h3>Historial · {history.name}</h3><p>Entradas, ajustes y consumos de este insumo.</p></header>
      <div className={styles.historyList}>{historyMovements.map(m=><article className={styles.movement} key={m.id}>
        <div><span className={styles.category}>{m.kind==="production" ? "Producción" : m.kind==="receipt" ? "Entrada" : "Ajuste"}</span><p>{m.reason}</p><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleDateString("es-CR")}</time></div>
        <div className={styles.movementAmount}><strong>{Number(m.quantity)>0 ? "+" : ""}{Number(m.quantity).toLocaleString("es-CR")} {history.unit}</strong><span>{money(Number(m.unit_cost),history.currency)} / {history.unit}</span></div>
      </article>)}</div>
      {!historyMovements.length && <div className={styles.empty}><History size={28} aria-hidden="true"/><h4>Sin movimientos registrados</h4><p>Las entradas, ajustes y consumos aparecerán aquí.</p></div>}
    </section> : <>
      <div className={styles.toolbar}><label>Buscar insumo<span className={styles.search}><Search size={18} aria-hidden="true"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre, categoría o etiqueta" /></span></label><button className={styles.primary} disabled={!authenticated} onClick={()=>start("new")}><Plus size={18} aria-hidden="true"/>Nuevo insumo</button></div>
      {!!supplies.length && <p className={styles.resultCount} role="status">{filteredSupplies.length} de {supplies.length} insumos</p>}
      <div className={styles.list}>{filteredSupplies.map(s=><article className={styles.card} key={s.id}>
        <header><span className={styles.category}>{s.category}</span><h3>{s.name}</h3></header>
        {(s.description || !!s.tags?.length) && <div className={styles.details}>
          {!!s.tags?.length && <ul aria-label="Etiquetas" className={styles.tags}>{s.tags.map((tag,index)=><li key={`${tag}-${index}`}>{tag}</li>)}</ul>}
          {s.description && <details><summary>Descripción</summary><p>{s.description}</p></details>}
        </div>}
        <dl className={styles.stock}>
          <div><dt>Disponible</dt><dd>{s.quantity.toLocaleString("es-CR")} <span>{s.unit}</span></dd></div>
          <div><dt>Costo promedio / {s.unit}</dt><dd>{money(s.unit_cost,s.currency)}</dd></div>
        </dl>
        <div className={styles.cardActions}><button disabled={!authenticated} onClick={()=>start(s)}><PackagePlus size={17} aria-hidden="true"/>Entrada / ajuste</button><button onClick={()=>setHistory(s)}><History size={17} aria-hidden="true"/>Historial</button></div>
      </article>)}</div>
      {!supplies.length && authenticated && <div className={styles.empty}><Boxes size={32} aria-hidden="true"/><h3>Todo empieza con tu primer insumo</h3><p>Registrá imanes, pines o materiales que ya tenés y elegilos desde la receta de un proyecto.</p></div>}
      {!!supplies.length && !filteredSupplies.length && <div className={styles.empty}><Search size={28} aria-hidden="true"/><h3>No encontramos ese insumo</h3><p>Probá con otro nombre o categoría.</p><button type="button" onClick={()=>setSearch("")}>Limpiar búsqueda</button></div>}
      {authenticated && <p className={styles.footnote}><Info size={17} aria-hidden="true"/>Guardar una receta no consume existencias. Registrar su impresión sí, y conserva el costo de ese momento.</p>}
    </>}
  </ModalFrame>;
}
