"use client";

import { useRef, useState, type FormEvent } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { ModalFrame } from "@/components/modal-frame";
import { currencyLabel, formatMoney } from "@/lib/i18n";
import type { QuotationAttempt, QuotationCursor, QuotationSaveResult } from "@/lib/quotations-client";
import { quotationCostCategories, type QuotationCurrency, type QuotationSnapshot, type QuotationVersion } from "@/lib/quotations";
import styles from "./quotation-modal.module.css";

type ProjectChoice = { id: string; description: string; colors: string };
type LineDraft = Omit<QuotationSnapshot["lines"][number], "unit_price_minor"> & { price: string; key: string };
type CostDraft = Omit<QuotationSnapshot["internal_costs"][number], "amount_minor"> & { amount: string; key: string };
type Draft = Omit<QuotationSnapshot, "lines" | "internal_costs"> & { lines: LineDraft[]; internal_costs: CostDraft[] };
type Props = {
  ownerId: string;
  sellerName: string;
  currency: QuotationCurrency;
  projects: ProjectChoice[];
  initialProjectId?: string;
  onSave: (attempt: QuotationAttempt) => Promise<QuotationSaveResult>;
  onList: (before?: QuotationCursor) => Promise<QuotationVersion[]>;
  onClose: () => void;
};

const currencies: QuotationCurrency[] = ["CRC", "USD", "EUR"];
const categoryLabels = {
  filament: "Filamento", supplies: "Insumos", labor: "Mano de obra", electricity: "Electricidad",
  machine: "Uso de máquina", finishing: "Acabados", packaging: "Empaque", other: "Otros"
};

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function draftFromSnapshot(snapshot: QuotationSnapshot): Draft {
  return {
    ...snapshot,
    observations: snapshot.observations ?? "",
    lines: snapshot.lines.map(({ unit_price_minor, ...line }) => ({ ...line, price: (unit_price_minor / 100).toFixed(2), key: crypto.randomUUID() })),
    internal_costs: snapshot.internal_costs.map(({ amount_minor, ...cost }) => ({ ...cost, amount: (amount_minor / 100).toFixed(2), key: crypto.randomUUID() }))
  };
}

function minorUnits(value: string) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return NaN;
  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

const logoMaxLength = 120000;
const logoMaxFileSize = 5 * 1024 * 1024;

async function readQuotationLogo(file: File) {
  if (!["image/png", "image/jpeg"].includes(file.type) || file.size > logoMaxFileSize) {
    throw new Error("Elegí un PNG o JPG de hasta 5 MB.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 200 / image.naturalWidth, 100 / image.naturalHeight);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar el logo.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    if (dataUrl.length > logoMaxLength) throw new Error("El logo quedó muy pesado. Probá con una imagen más simple.");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function restoreAttempt(key: string): QuotationAttempt | null {
  try {
    const attempt = JSON.parse(sessionStorage.getItem(key) ?? "null") as QuotationAttempt | null;
    return attempt?.requestId && attempt.quoteId && Array.isArray(attempt.snapshot?.lines)
      && Array.isArray(attempt.snapshot.internal_costs) ? attempt : null;
  } catch {
    return null;
  }
}

export function QuotationModal({ ownerId, sellerName, currency, projects, initialProjectId, onSave, onList, onClose }: Props) {
  const storageKey = `proper:quotation-attempt:${ownerId}`;
  const [pending, setPending] = useState(() => restoreAttempt(storageKey));
  const [draft, setDraft] = useState<Draft>(() => {
    if (pending) return draftFromSnapshot(pending.snapshot);
    const project = projects.find(({ id }) => id === initialProjectId);
    return {
      seller_name: sellerName, customer_name: "", customer_contact: "", terms: "", observations: "",
      issued_on: dateOffset(0), valid_until: dateOffset(15), currency, internal_costs: [],
      lines: [{ key: crypto.randomUUID(), project_id: project?.id ?? "", description: project?.description ?? "", colors: project?.colors ?? "", quantity: 1, price: "" }]
    };
  });
  const [includeDeposit, setIncludeDeposit] = useState(Boolean(pending?.snapshot.deposit_terms));
  const [source, setSource] = useState<QuotationVersion | null>(null);
  const [saved, setSaved] = useState<QuotationVersion | null>(null);
  const [history, setHistory] = useState<QuotationVersion[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [readingLogo, setReadingLogo] = useState(false);
  const [message, setMessage] = useState(pending ? "Hay un guardado pendiente. Recuperá su resultado antes de editar." : "");
  const working = useRef(false);
  const money = (minor: number, code = draft.currency) => formatMoney(minor / 100, code, "es");
  const total = draft.lines.reduce((sum, item) => sum + item.quantity * (minorUnits(item.price) || 0), 0);

  function changeLine(key: string, values: Partial<LineDraft>) {
    setDraft((current) => ({ ...current, lines: current.lines.map((line) => line.key === key ? { ...line, ...values } : line) }));
  }

  function changeCost(key: string, values: Partial<CostDraft>) {
    setDraft((current) => ({ ...current, internal_costs: current.internal_costs.map((cost) => cost.key === key ? { ...cost, ...values } : cost) }));
  }

  async function selectLogo(file: File) {
    if (working.current || pending) return;
    working.current = true;
    setReadingLogo(true);
    setMessage("");
    try {
      const logo = await readQuotationLogo(file);
      setDraft((current) => ({ ...current, seller_logo: logo }));
    } catch (error) {
      setMessage(error instanceof Error && error.name === "Error" ? error.message : "No se pudo leer la imagen. Probá con otro PNG o JPG.");
    } finally {
      working.current = false;
      setReadingLogo(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working.current) return;
    const { lines, internal_costs, ...header } = draft;
    const snapshot: QuotationSnapshot = {
      ...header,
      seller_name: header.seller_name.trim(), customer_name: header.customer_name.trim(),
      observations: header.observations?.trim(),
      deposit_terms: includeDeposit ? header.deposit_terms?.trim() : undefined,
      lines: lines.map(({ key: _, price, ...line }) => ({ ...line, description: line.description.trim(), unit_price_minor: minorUnits(price) })),
      internal_costs: internal_costs.map(({ key: _, amount, ...cost }) => ({ ...cost, amount_minor: minorUnits(amount) }))
    };
    if (!pending && includeDeposit && !snapshot.deposit_terms) {
      setMessage("Indicá el monto o porcentaje del anticipo.");
      return;
    }
    const validMoney = (amount: number) => Number.isSafeInteger(amount) && amount >= 0 && amount <= 1_000_000_000;
    if (!pending && (!snapshot.seller_name || !snapshot.customer_name
      || snapshot.lines.some((line) => !line.description || !validMoney(line.unit_price_minor))
      || snapshot.internal_costs.some((cost) => !validMoney(cost.amount_minor)))) {
      setMessage("Revisá los nombres y los montos. Usá hasta dos decimales, sin separadores de miles.");
      return;
    }
    const attempt = pending ?? {
      requestId: crypto.randomUUID(), quoteId: source?.quote_id ?? crypto.randomUUID(),
      expectedVersion: source?.version ?? 0, snapshot
    };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(attempt));
    } catch {
      setMessage("Habilitá el almacenamiento de esta pestaña para poder recuperar el guardado si se interrumpe.");
      return;
    }
    working.current = true;
    setBusy(true);
    setPending(attempt);
    setMessage("");
    try {
      const result = await onSave(attempt);
      if (result.status === "uncertain") {
        setMessage(result.message);
        return;
      }
      sessionStorage.removeItem(storageKey);
      setPending(null);
      if (result.status === "saved") {
        setSaved(result.version);
        setMessage(`Cotización guardada · versión ${result.version.version}.`);
      } else {
        setMessage(result.message);
      }
    } catch {
      setMessage("No se pudo confirmar el guardado. Reintentá con los mismos datos.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function openHistory(before?: QuotationCursor) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage("");
    try {
      const versions = await onList(before);
      setHistory((current) => before ? [...(current ?? []), ...versions] : versions);
      setMore(versions.length === 20);
    } catch {
      setMessage("No se pudo cargar el historial. Probá de nuevo.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function download(quotation: QuotationVersion) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      const { createQuotationPdf } = await import("@/lib/quotation-pdf");
      const url = URL.createObjectURL(await createQuotationPdf(quotation));
      const link = document.createElement("a");
      link.href = url;
      link.download = `cotizacion-${quotation.quote_id}-v${quotation.version}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setMessage("No se pudo preparar el PDF. La cotización guardada sigue disponible.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  function editVersion(version: QuotationVersion) {
    setSource(version);
    setDraft(draftFromSnapshot(version.snapshot));
    setIncludeDeposit(Boolean(version.snapshot.deposit_terms));
    setSaved(null);
    setHistory(null);
    setMessage("");
  }

  return (
    <ModalFrame title="Cotización" titleId="quotation-title" eyebrow="Proyectos" className={styles.modal} busy={busy || readingLogo} onClose={onClose} onBack={onClose} backLabel="Volver a Proyectos">
      {message && <p className="form-help" role="status">{message}</p>}
      {history ? (
        <section className={styles.body} aria-label="Historial de cotizaciones">
          <button type="button" onClick={() => setHistory(null)} disabled={busy}>Volver</button>
          <h3>Historial de versiones</h3>
          {!history.length && <p>Todavía no hay cotizaciones guardadas.</p>}
          {history.map((version) => (
            <article className={styles.card} key={`${version.quote_id}:${version.version}`}>
              <strong>{version.snapshot.customer_name} · V{version.version}</strong>
              <span>{version.snapshot.issued_on} · {money(version.total_minor, version.snapshot.currency)}</span>
              <div className={styles.actions}>
                <button type="button" onClick={() => void download(version)} disabled={busy}>Descargar PDF</button>
                <button type="button" onClick={() => editVersion(version)} disabled={busy}>Preparar revisión</button>
              </div>
            </article>
          ))}
          {more && <button type="button" onClick={() => void openHistory(history.at(-1))} disabled={busy}>Ver más</button>}
        </section>
      ) : saved ? (
        <section className={styles.body} aria-label="Cotización guardada">
          <h3>{saved.snapshot.customer_name}</h3>
          <p>Total · {money(saved.total_minor, saved.snapshot.currency)}</p>
          <p>Descargá el PDF y adjuntalo en WhatsApp para compartirlo con tu cliente.</p>
          <div className={styles.actions}>
            <button className="primary-action" type="button" onClick={() => void download(saved)} disabled={busy}><Download size={16} /> Descargar PDF</button>
            <button type="button" onClick={() => editVersion(saved)} disabled={busy}>Preparar revisión</button>
            <button type="button" onClick={() => void openHistory()} disabled={busy}>Ver historial</button>
          </div>
        </section>
      ) : (
        <form className={styles.body} onSubmit={submit} aria-busy={busy} noValidate={Boolean(pending)}>
          <fieldset className={styles.fields} disabled={Boolean(pending) || busy || readingLogo}>
            <legend>{source ? `Nueva versión a partir de V${source.version}` : "Datos de la cotización"}</legend>
            <div className="form-grid">
              <label>Tu taller<input required maxLength={120} value={draft.seller_name} onChange={(e) => setDraft({ ...draft, seller_name: e.target.value })} /></label>
              <div className={styles.logoField}>
                <label>Logo del taller (opcional)
                  <input type="file" accept="image/png,image/jpeg" aria-describedby="quotation-logo-help" onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (file) void selectLogo(file);
                  }} />
                </label>
                <small id="quotation-logo-help">{readingLogo ? "Preparando logo…" : "PNG o JPG de hasta 5 MB. Aparece junto al nombre en el PDF."}</small>
                {draft.seller_logo && (
                  <div className={styles.logoPreview}>
                    {/* A local, bounded PNG needs no image optimization or network request. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={draft.seller_logo} alt="Vista previa del logo del taller" />
                    <button type="button" onClick={() => setDraft((current) => ({ ...current, seller_logo: undefined }))}>Quitar logo</button>
                  </div>
                )}
              </div>
              <label>Contacto del taller<input maxLength={200} value={draft.seller_contact ?? ""} placeholder="Correo o teléfono comercial" onChange={(e) => setDraft({ ...draft, seller_contact: e.target.value })} /></label>
              <label>Cliente<input required maxLength={120} value={draft.customer_name} onChange={(e) => setDraft({ ...draft, customer_name: e.target.value })} /></label>
              <label>Contacto del cliente<input maxLength={200} value={draft.customer_contact} onChange={(e) => setDraft({ ...draft, customer_contact: e.target.value })} /></label>
              <label>Moneda de venta<select value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value as QuotationCurrency })}>
                {currencies.map((code) => <option key={code} value={code}>{currencyLabel(code, "es")}</option>)}
              </select></label>
              <label>Fecha de emisión<input required type="date" value={draft.issued_on} onChange={(e) => setDraft({ ...draft, issued_on: e.target.value })} /></label>
              <label>Válida hasta<input required type="date" min={draft.issued_on} value={draft.valid_until} onChange={(e) => setDraft({ ...draft, valid_until: e.target.value })} /></label>
            </div>
            <h3>Partidas</h3>
            {draft.lines.map((line, index) => (
              <div className={`form-grid ${styles.card}`} key={line.key}>
                <label className="wide">Proyecto o variante<select required value={line.project_id} onChange={(e) => {
                  const project = projects.find(({ id }) => id === e.target.value);
                  changeLine(line.key, { project_id: e.target.value, description: project?.description ?? "", colors: project?.colors ?? "" });
                }}>
                  <option value="">Seleccionar proyecto</option>
                  {line.project_id && !projects.some(({ id }) => id === line.project_id) && <option value={line.project_id}>{line.description}</option>}
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.description}</option>)}
                </select></label>
                <label>Descripción<input required maxLength={220} value={line.description} onChange={(e) => changeLine(line.key, { description: e.target.value })} /></label>
                <label>Colores<input maxLength={300} value={line.colors} onChange={(e) => changeLine(line.key, { colors: e.target.value })} /></label>
                <label>Cantidad<input required type="number" min={1} max={100000} value={line.quantity || ""} onChange={(e) => changeLine(line.key, { quantity: Number(e.target.value) })} /></label>
                <label>Precio unitario ({draft.currency})<input required inputMode="decimal" value={line.price} onChange={(e) => changeLine(line.key, { price: e.target.value })} /></label>
                <button type="button" disabled={draft.lines.length === 1} aria-label={`Quitar partida ${index + 1}`} onClick={() => setDraft({ ...draft, lines: draft.lines.filter(({ key }) => key !== line.key) })}><Trash2 size={16} /> Quitar</button>
              </div>
            ))}
            <button type="button" disabled={draft.lines.length >= 50} onClick={() => setDraft({ ...draft, lines: [...draft.lines, {
              key: crypto.randomUUID(), project_id: "", description: "", colors: "", quantity: 1, price: ""
            }] })}><Plus size={16} /> Agregar partida</button>
            <details>
              <summary>Costos internos</summary>
              <p className="form-help">Estos montos son opcionales y quedan fuera del PDF. Conservá la moneda de cada costo.</p>
              {draft.internal_costs.map((cost, index) => (
                <div className={`form-grid ${styles.card}`} key={cost.key}>
                  <label>Rubro<select value={cost.category} onChange={(e) => changeCost(cost.key, { category: e.target.value as CostDraft["category"] })}>
                    {quotationCostCategories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
                  </select></label>
                  <label>Moneda<select value={cost.currency} onChange={(e) => changeCost(cost.key, { currency: e.target.value as QuotationCurrency })}>
                    {currencies.map((code) => <option key={code}>{code}</option>)}
                  </select></label>
                  <label>Monto<input required inputMode="decimal" value={cost.amount} onChange={(e) => changeCost(cost.key, { amount: e.target.value })} /></label>
                  <button type="button" aria-label={`Quitar costo ${index + 1}`} onClick={() => setDraft({ ...draft, internal_costs: draft.internal_costs.filter(({ key }) => key !== cost.key) })}><Trash2 size={16} /> Quitar</button>
                </div>
              ))}
              <button type="button" disabled={draft.internal_costs.length >= 24} onClick={() => setDraft({ ...draft, internal_costs: [...draft.internal_costs, {
                key: crypto.randomUUID(), category: "filament", currency: draft.currency, amount: ""
              }] })}><Plus size={16} /> Agregar costo</button>
            </details>
            <div className="form-grid">
              <label>Entrega<input maxLength={300} value={draft.delivery ?? ""} placeholder="Ej. Retiro en el taller en 5 días hábiles" onChange={(e) => setDraft({ ...draft, delivery: e.target.value })} /></label>
              <label>Forma de pago<input maxLength={300} value={draft.payment_terms ?? ""} placeholder="Ej. Transferencia o SINPE Móvil" onChange={(e) => setDraft({ ...draft, payment_terms: e.target.value })} /></label>
            </div>
            <label className={styles.depositToggle}>
              <input type="checkbox" checked={includeDeposit} onChange={(e) => setIncludeDeposit(e.target.checked)} />
              Solicitar anticipo
            </label>
            {includeDeposit && <label>Anticipo<input required maxLength={300} value={draft.deposit_terms ?? ""} placeholder="Ej. 50% para iniciar el trabajo" onChange={(e) => setDraft({ ...draft, deposit_terms: e.target.value })} /></label>}
            <label>Observaciones para el cliente<textarea maxLength={1500} value={draft.observations ?? ""} onChange={(e) => setDraft({ ...draft, observations: e.target.value })} /></label>
            <label>Condiciones<textarea maxLength={1500} placeholder="Alcance, garantía o indicaciones sobre impuestos, si aplican." value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} /></label>
          </fieldset>
          <p><strong>Total de venta · {money(total)}</strong></p>
          <div className={styles.actions}>
            <button className="primary-action" type="submit" disabled={busy || readingLogo}>{busy ? "Guardando…" : pending ? "Recuperar guardado" : "Guardar cotización"}</button>
            <button type="button" onClick={() => void openHistory()} disabled={busy || readingLogo || Boolean(pending)}>Ver historial</button>
          </div>
        </form>
      )}
    </ModalFrame>
  );
}
