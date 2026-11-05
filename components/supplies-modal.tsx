"use client";

import { useRef, useState } from "react";
import { Plus, PackagePlus, History, Boxes, Search, ArrowLeft, Info } from "lucide-react";
import { ModalFrame } from "@/components/modal-frame";
import { defaultLanguage, formatDate, languageLocale, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";
import { parseSupplyTags, type Supply, type SupplyMovement, type SupplySaveValues } from "@/lib/supplies";
import styles from "./supplies-modal.module.css";

const categories = ["Imanes", "Pines", "Tornillos", "Electrónica", "Pintura", "Empaque", "Otros"];
const unitOptions = [
  { value: "unidad", label: "supplies.unit.unidad", symbol: "pc" },
  { value: "metro", label: "supplies.unit.metro", symbol: "m" },
  { value: "gramo", label: "supplies.unit.gramo", symbol: "g" },
  { value: "kilogramo", label: "supplies.unit.kilogramo", symbol: "kg" },
  { value: "ml", label: "supplies.unit.ml", symbol: "ml" },
  { value: "litro", label: "supplies.unit.litro", symbol: "l" }
] as const;
const categoryLabels: Readonly<Record<string, MessageKey>> = {
  "Imanes": "supplies.category.magnets",
  "Pines": "supplies.category.pins",
  "Tornillos": "supplies.category.screws",
  "Electrónica": "supplies.category.electronics",
  "Pintura": "supplies.category.paint",
  "Empaque": "supplies.category.packaging",
  "Otros": "supplies.category.other",
};
type SupplyMessage = { key: MessageKey } | { original: string };
type Pending = {id:string; values:SupplySaveValues};
function readPending(key:string): Pending | null {
  try { const item=JSON.parse(sessionStorage.getItem(key) ?? "null"); return item?.id && item?.values ? item : null; } catch {return null;}
}

export function SuppliesModal({supplies, movements, authenticated, baseCurrency, pendingKey, onSave, onClose, language = defaultLanguage}: {
  language?: AppLanguage;
  supplies: Supply[]; movements: SupplyMovement[]; authenticated: boolean; baseCurrency: string;
  pendingKey: string;
  onSave: (values: SupplySaveValues, requestId: string) => Promise<{error:string;uncertain:boolean}>; onClose: () => void;
}) {
  const t = (key: MessageKey, values?: Readonly<Record<string, string | number>>) => translate(language, key, values);
  const locale = languageLocale(language);
  const money = (amount: number, currency: string) => new Intl.NumberFormat(locale, {
    style: "currency", currency, currencyDisplay: language === "en" ? "code" : "symbol", maximumFractionDigits: 2
  }).format(amount);
  const displayUnit = (unit: string) => {
    const option = unitOptions.find(option => option.value === unit);
    return language === "en" && option ? option.symbol : unit;
  };
  const displayCategory = (category: string) => Object.hasOwn(categoryLabels, category) ? t(categoryLabels[category]) : category;
  const [initialPending]=useState(()=>readPending(pendingKey));
  const [editing,setEditing]=useState<Supply | "new" | null>(()=>initialPending ? supplies.find(s=>s.id===initialPending.values.supply_id) ?? "new" : null);
  const [history,setHistory]=useState<Supply | null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<SupplyMessage | null>(null);
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
  const filteredSupplies=supplies.filter(s=>(s.name+" "+s.category+" "+displayCategory(s.category)+" "+(s.tags ?? []).join(" ")).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const historyMovements=history ? movements.filter(m=>m.supply_id===history.id) : [];
  function start(item: Supply | "new") { setEditing(item); setKind("receipt");setQuantity("1");setMessage(null);setPending(null);setUnitChoice("unidad");setCustomUnit(""); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(guard.current || !authenticated) return;
    const form=event.currentTarget, data=new FormData(form);
    let tags: string[]=[];
    if(creating && !pending) {
      try { tags=parseSupplyTags(String(data.get("tags") ?? "")); }
      catch { setMessage({ key: "supplies.tagsError" }); return; }
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
    guard.current=true;setBusy(true);setPending({id:requestId,values});setMessage(null);
    try {
      sessionStorage.setItem(pendingKey,JSON.stringify({id:requestId,values}));
      const result=await onSave(values,requestId);
      if(result.error) {setMessage({ original: result.error }); if(!result.uncertain) {sessionStorage.removeItem(pendingKey);setPending(null);}}
      else { sessionStorage.removeItem(pendingKey);setEditing(null);setPending(null);setMessage({ key: values.kind==="catalog" ? "supplies.catalogSaved" : "supplies.stockSaved" }); }
    } catch {setMessage({ key: "supplies.uncertain" });}
    finally {guard.current=false;setBusy(false);}
  }
  return <ModalFrame lang={language} closeLabel={t("supplies.close")} title={t("nav.supplies")} titleId="supplies-title" eyebrow={t("supplies.eyebrow")} className={`supplies-modal ${styles.modal}`} busy={busy || !!pending} onClose={onClose} viewKey={editing ? "edit" : history?.id ?? "list"}>
    <p className={styles.intro}>{t("supplies.intro")}</p>
    {!authenticated && <div role="status" className={styles.notice}><Info size={20} aria-hidden="true"/><p><strong>{t("supplies.account")}</strong>{t("supplies.signIn")}</p></div>}
    {message && <p role="status" className={styles.feedback}>{"key" in message ? t(message.key) : <>{language === "en" && <>{t("account.originalMessage")} </>}<span lang="">{message.original}</span></>}</p>}
    {editing ? <form className={styles.form} onSubmit={submit}>
      <header className={styles.viewHeading}>
        <h3>{selected ? selected.name : t("supplies.new")}</h3>
        <p>{selected ? t("supplies.selected", { quantity: selected.quantity.toLocaleString(locale), unit: displayUnit(selected.unit), category: displayCategory(selected.category) }) : creating ? t("supplies.createHelp") : t("supplies.restored")}</p>
      </header>
      {!selected && <fieldset disabled={busy || !!pending} className={styles.fieldset}>
        <legend>{t("supplies.data")}</legend>
        <div className={styles.fields}>
          <label>{t("supplies.name")}<input name="name" required maxLength={120} pattern=".*\S.*" defaultValue={catalogDraft?.name} placeholder={t("supplies.nameExample")} /></label>
          <label>{t("supplies.category")}<select name="category" defaultValue={catalogDraft?.category}>{categories.map(c=><option key={c} value={c}>{displayCategory(c)}</option>)}</select></label>
          <label>{t("supplies.unit")}<select name={unitChoice==="__custom__" ? undefined : "unit"} value={unitChoice} onChange={event=>setUnitChoice(event.target.value)} aria-describedby="supply-unit-help">
            {unitOptions.map(option=><option key={option.value} value={option.value}>{t(option.label)}</option>)}
            <option value="__custom__">{t("supplies.otherUnit")}</option>
          </select></label>
          <label>{t("purchaseRecord.currency")}<select name="currency" value={currency} onChange={event=>setCurrency(event.target.value)}>{["CRC","USD","EUR"].map(c=><option key={c}>{c}</option>)}</select></label>
          {unitChoice==="__custom__" && <label className={styles.wide}>{t("supplies.unitName")}<input name="unit" required maxLength={30} pattern=".*\S.*" value={customUnit} onChange={event=>setCustomUnit(event.target.value)} placeholder={t("supplies.unitExample")} aria-describedby="supply-unit-help" /></label>}
          {creating && <>
            <label className={styles.wide}>{t("supplies.tags")}<input name="tags" maxLength={418} defaultValue={catalogDraft?.tags.join(", ")} placeholder={t("supplies.tagsExample")} aria-describedby="supply-tags-help" /></label>
            <p id="supply-tags-help" className={`${styles.help} ${styles.wide}`}>{t("supplies.tagsHelp")}</p>
            <label className={styles.wide}>{t("supplies.description")}<textarea name="description" maxLength={2000} rows={3} defaultValue={catalogDraft?.description} placeholder={t("supplies.descriptionExample")} /></label>
          </>}
        </div>
        <p id="supply-unit-help" className={styles.help}>{t("supplies.unitHelp")}</p>
      </fieldset>}
      {!creating && <fieldset disabled={busy || !!pending} className={styles.fieldset}>
        <legend>{selected ? t("supplies.movement") : t("supplies.initial")}</legend>
        <div className={styles.fields}>
        {selected && <label className={styles.wide}>{t("supplies.kind")}<select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="receipt">{t("supplies.receiptOption")}</option><option value="adjustment">{t("supplies.adjustmentOption")}</option></select></label>}
        <label>{kind==="receipt" ? t("supplies.quantity") : t("supplies.difference")}<input type="number" required min={kind==="receipt" ? "0.001" : undefined} max="999999999" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)} /></label>
        <label>{t("supplies.cost", { currency: selected?.currency ?? currency })}<input name="cost" type="number" required min="0" max="999999999" step="0.0001" defaultValue={selected?.unit_cost.toFixed(4) ?? ""} disabled={Number(quantity)<0} aria-describedby="supply-cost-help" /></label>
        {Number(quantity)>0 && <label>{t("supplies.purchaseDate")}<input name="purchased_at" type="date" required
          defaultValue={pending && pending.values.kind!=="catalog" ? pending.values.purchased_at ?? "" : new Intl.DateTimeFormat("en-CA",{timeZone:"America/Costa_Rica"}).format(new Date())} /></label>}
        <label className={styles.wide}>{t("supplies.reason")}<input name="reason" required maxLength={500} placeholder={t("supplies.reasonExample")} /></label>
        </div>
        <p id="supply-cost-help" className={styles.help}>{t("supplies.costHelp")}</p>
      </fieldset>}
      <p className={styles.help}>{creating ? t("supplies.catalogHelp") : t("supplies.receiptHelp")}</p>
      {pending && !busy && <p role="alert" className={styles.pending}>{t("supplies.pending", { details: pending.values.kind==="catalog" ? t("supplies.pendingCatalog", { name: pending.values.name }) : `${pending.values.quantity.toLocaleString(locale)} ${displayUnit(pending.values.unit)} · ${pending.values.reason}` })}</p>}
      <div className={styles.formActions}><button type="button" disabled={busy || !!pending} onClick={()=>setEditing(null)}>{t("orderForm.cancel")}</button><button className={styles.primary} disabled={busy || (!creating && Number(quantity)===0)} type="submit">{busy ? t("supplies.saving") : pending ? t("supplies.retry") : creating ? t("supplies.create") : t("supplies.save")}</button></div>
    </form> : history ? <section className={styles.history}>
      <button className={styles.back} type="button" onClick={()=>setHistory(null)}><ArrowLeft size={17} aria-hidden="true"/>{t("supplies.back")}</button>
      <header className={styles.viewHeading}><h3>{t("supplies.historyTitle", { name: history.name })}</h3><p>{t("supplies.historyHelp")}</p></header>
      <div className={styles.historyList}>{historyMovements.map(m=><article className={styles.movement} key={m.id}>
        <div><span className={styles.category}>{m.kind==="production" ? t("supplies.production") : m.kind==="receipt" ? t("supplies.receipt") : t("supplies.adjustment")}</span><p>{m.reason}</p><time dateTime={m.created_at}>{language === "es" ? new Date(m.created_at).toLocaleDateString(locale) : formatDate(m.created_at, language, { dateStyle: "medium" }) ?? t("dateUnavailable")}</time></div>
        <div className={styles.movementAmount}><strong>{Number(m.quantity)>0 ? "+" : ""}{Number(m.quantity).toLocaleString(locale)} {displayUnit(history.unit)}</strong><span>{money(Number(m.unit_cost),history.currency)} / {displayUnit(history.unit)}</span></div>
      </article>)}</div>
      {!historyMovements.length && <div className={styles.empty}><History size={28} aria-hidden="true"/><h4>{t("supplies.noMovements")}</h4><p>{t("supplies.noMovementsHelp")}</p></div>}
    </section> : <>
      <div className={styles.toolbar}><label>{t("supplies.search")}<span className={styles.search}><Search size={18} aria-hidden="true"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t("supplies.searchExample")} /></span></label><button className={styles.primary} disabled={!authenticated} onClick={()=>start("new")}><Plus size={18} aria-hidden="true"/>{t("supplies.new")}</button></div>
      {!!supplies.length && <p className={styles.resultCount} role="status">{t("supplies.resultCount", { shown: filteredSupplies.length.toLocaleString(locale), total: supplies.length.toLocaleString(locale) })}</p>}
      <div className={styles.list}>{filteredSupplies.map(s=><article className={styles.card} key={s.id}>
        <header><span className={styles.category}>{displayCategory(s.category)}</span><h3>{s.name}</h3></header>
        {(s.description || !!s.tags?.length) && <div className={styles.details}>
          {!!s.tags?.length && <ul aria-label={t("supplies.tagList")} className={styles.tags}>{s.tags.map((tag,index)=><li key={`${tag}-${index}`}>{tag}</li>)}</ul>}
          {s.description && <details><summary>{t("supplies.descriptionTitle")}</summary><p>{s.description}</p></details>}
        </div>}
        <dl className={styles.stock}>
          <div><dt>{t("supplies.available")}</dt><dd>{s.quantity.toLocaleString(locale)} <span>{displayUnit(s.unit)}</span></dd></div>
          <div><dt>{t("supplies.average", { unit: displayUnit(s.unit) })}</dt><dd>{money(s.unit_cost,s.currency)}</dd></div>
        </dl>
        <div className={styles.cardActions}><button disabled={!authenticated} onClick={()=>start(s)}><PackagePlus size={17} aria-hidden="true"/>{t("supplies.entry")}</button><button onClick={()=>setHistory(s)}><History size={17} aria-hidden="true"/>{t("supplies.history")}</button></div>
      </article>)}</div>
      {!supplies.length && authenticated && <div className={styles.empty}><Boxes size={32} aria-hidden="true"/><h3>{t("supplies.empty")}</h3><p>{t("supplies.emptyHelp")}</p></div>}
      {!!supplies.length && !filteredSupplies.length && <div className={styles.empty}><Search size={28} aria-hidden="true"/><h3>{t("supplies.notFound")}</h3><p>{t("supplies.notFoundHelp")}</p><button type="button" onClick={()=>setSearch("")}>{t("supplies.clear")}</button></div>}
      {authenticated && <p className={styles.footnote}><Info size={17} aria-hidden="true"/>{t("supplies.footnote")}</p>}
    </>}
  </ModalFrame>;
}
