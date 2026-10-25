"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Wallet } from "lucide-react";
import { ModalFrame } from "./modal-frame";
import { getSupabaseClient } from "../lib/supabase";
import { awaitInventoryRequest, inventoryValueTotal, loadInventoryValueSummary } from "../lib/inventory-values";
import { requestReportRate } from "../lib/inventory-valuation-report";
import { isIsoAcquisitionDate } from "../lib/historical-fx";
import type { FilamentRoll, InventoryValueSummary } from "../lib/types";
import type { Supply } from "../lib/supplies";
import styles from "./inventory-value-summary.module.css";
import modalStyles from "./supplies-modal.module.css";

type Mode = "authenticated" | "demo" | "local" | "error";
export function useInventoryValueSummary(rolls: FilamentRoll[], supplies: Supply[], mode: Mode, userId: string) {
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{ rolls: FilamentRoll[]; supplies: Supply[]; userId: string; revision: number; data: InventoryValueSummary | null; error: string } | null>(null);
  useEffect(() => {
    if (mode !== "authenticated" || !userId) return;
    let cancelled = false;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
    async function load() {
      try {
        const client = getSupabaseClient();
        if (!client) throw new Error();
        const data = await loadInventoryValueSummary(client, userId, controller.signal);
        if (!cancelled) setLoaded({ rolls, supplies, userId, revision, data, error: "" });
      } catch {
        if (!cancelled) setLoaded({ rolls, supplies, userId, revision, data: null, error: "No pudimos cargar el saldo histórico. Podés reintentar." });
      } finally { clearTimeout(timer); }
    }
    void load();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [rolls, supplies, mode, userId, revision]);
  const current = mode === "authenticated" && loaded?.rolls === rolls && loaded.supplies === supplies && loaded.userId === userId && loaded.revision === revision ? loaded : null;
  return { data: current?.data ?? null, error: current?.error ?? "", loading: mode === "authenticated" && !current, refresh: () => setRevision(value => value + 1) };
}

function money(value: number | null, currency: string) {
  return value == null ? "—" : new Intl.NumberFormat("es-CR", { style: "currency", currency, maximumFractionDigits: currency === "CRC" ? 0 : 2 }).format(value);
}

export function InventoryValueCards({ data, loading, error, mode, onRefresh, onDetails }: {
  data: InventoryValueSummary | null; loading: boolean; error: string; mode: Mode; onRefresh: () => void; onDetails: () => void;
}) {
  return <section className={styles.panel} aria-label="Saldo actual del inventario">
    <header><div><p className={styles.eyebrow}>TU INVERSIÓN DISPONIBLE</p><h2>Saldo actual del inventario</h2></div><Wallet size={23} aria-hidden="true" /></header>
    <p className={styles.help}>Filamentos e insumos que todavía tenés, a costo de compra. Conversión BCCR de cada adquisición.</p>
    <div className={styles.cards}>{(["CRC", "USD"] as const).map(currency => {
      const total = data ? inventoryValueTotal(data.rows, currency) : null;
      return <article key={currency} aria-label={`Saldo en ${currency}`}>
        <span className={styles.currency}>{currency === "CRC" ? "Colones · CRC" : "Dólares · USD"}</span>
        <strong className={styles.amount}>{loading ? "Cargando…" : money(total?.total ?? null, currency)}</strong>
        {total && <><span>{total.missing ? `Subtotal · ${total.missing} sin valorar` : "Saldo a costo histórico"}</span>
          <dl>{(["filament", "supply"] as const).map(kind => { const part = inventoryValueTotal(data!.rows, currency, kind); return <div key={kind}>
            <dt>{kind === "filament" ? "Filamentos" : "Insumos"}</dt><dd>{money(part.total, currency)}{part.missing > 0 ? " *" : ""}</dd>
          </div>; })}</dl></>}
      </article>;
    })}</div>
    {mode !== "authenticated" && <p className={styles.help}>Iniciá sesión para valorar tu inventario sincronizado. El modo local/demo no calcula conversiones.</p>}
    {error && <p role="alert" className={styles.help}>{error}</p>}
    {data && data.rows.some(row => row.remaining_crc_value == null || row.remaining_usd_value == null) && <p className={styles.help} role="status">Valoración parcial: los importes pendientes no se cuentan como cero. Completá los datos para obtener ambos totales.</p>}
    {mode === "authenticated" && <div className={styles.actions}>
      <button type="button" disabled={loading || !data} onClick={onDetails}>Ver desglose y completar</button>
      <button type="button" disabled={loading} onClick={onRefresh}><RefreshCw size={15} aria-hidden="true" />{loading ? "Actualizando…" : "Actualizar saldo"}</button>
    </div>}
  </section>;
}

type DateAttempt = { p_request_id: string; p_movement_id: string; p_purchased_at: string };
export function InventoryValueDetails({ data, loading, error, userId, onRefresh, onClose }: {
  data: InventoryValueSummary | null; loading: boolean; error: string; userId: string; onRefresh: () => void; onClose: () => void;
}) {
  const key = `proper-inventory-date-pending:${userId}`;
  const [pending, setPending] = useState<DateAttempt | null>(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
      return value && typeof value.p_request_id === "string" && typeof value.p_movement_id === "string" && isIsoAcquisitionDate(value.p_purchased_at) ? value : null;
    } catch { return null; }
  });
  const [rateKey, setRateKey] = useState("");
  const [movement, setMovement] = useState(pending?.p_movement_id ?? "");
  const [date, setDate] = useState(pending?.p_purchased_at ?? "");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const guard = useRef(false), active = useRef<AbortController | null>(null), feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => { if (message) feedback.current?.focus(); }, [message]);
  const chosenRate = data?.pending_rates.find(rate => `${rate.acquisition_date}:${rate.source_currency}` === rateKey) ?? data?.pending_rates[0];
  const chosenMovement = pending?.p_movement_id || (data?.missing_supply_dates.some(item => item.movement_id === movement) ? movement : data?.missing_supply_dates[0]?.movement_id);

  async function perform(kind: "rate" | "date") {
    if (guard.current) return;
    const client = getSupabaseClient();
    if (!client) { setMessage("La conexión no está disponible."); return; }
    let operation: DateAttempt | null = null;
    if (kind === "date") {
      if (!chosenMovement || !isIsoAcquisitionDate(date)) { setMessage("Elegí la compra y su fecha real de adquisición."); return; }
      operation = pending ?? { p_request_id: crypto.randomUUID(), p_movement_id: chosenMovement, p_purchased_at: date };
      try { sessionStorage.setItem(key, JSON.stringify(operation)); } catch { setMessage("No se pudo conservar el intento. No enviamos la operación."); return; }
      setPending(operation);
    } else if (!chosenRate) return;
    guard.current = true; setBusy(true); setMessage("");
    const controller = new AbortController(); active.current = controller;
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      if (kind === "rate") await requestReportRate(client, chosenRate!, controller.signal);
      else {
        const result = await awaitInventoryRequest(client.rpc("complete_supply_purchase_date", operation!).abortSignal(controller.signal), controller.signal);
        if (result.error) {
          if (["22023", "22007", "22008", "22P02", "42501", "40001", "23514"].includes(result.error.code)) { sessionStorage.removeItem(key); setPending(null); }
          if (result.error.code === "40001") onRefresh();
          throw new Error(result.error.message);
        }
        if (!result.data || result.data.user_id !== userId || result.data.request_id !== operation!.p_request_id
          || result.data.movement_id !== operation!.p_movement_id || result.data.purchased_at !== operation!.p_purchased_at) throw new Error("La respuesta no confirmó esta fecha.");
        sessionStorage.removeItem(key); setPending(null); setDate("");
      }
      setMessage(kind === "rate" ? "Tasa histórica confirmada. Actualizando el saldo…" : "Fecha de compra confirmada. Actualizando el saldo…");
      onRefresh();
    } catch (cause) { setMessage(`No pudimos confirmar la operación. ${cause instanceof Error ? cause.message : "Podés reintentar."}`); }
    finally { clearTimeout(timer); active.current = null; guard.current = false; setBusy(false); }
  }

  return <ModalFrame title="Valor del inventario" titleId="inventory-values-title" eyebrow="SALDO ACTUAL" className={modalStyles.modal}
    busy={busy} onClose={() => { if (!guard.current) onClose(); }} closeLabel="Cerrar valoración">
    <p className={modalStyles.intro}>Cantidad actual a costo histórico. Los consumos reducen el saldo; no se reescriben compras ni costos de producción.</p>
    {(message || error) && <p ref={feedback} tabIndex={-1} role="status" className={modalStyles.feedback}>{message || error}</p>}
    {loading && <p role="status">Actualizando valoración…</p>}
    {error && <button type="button" disabled={busy || loading} onClick={onRefresh}>Reintentar resumen</button>}
    {(!!data?.missing_supply_dates.length || pending) && <form className={modalStyles.form} onSubmit={event => { event.preventDefault(); void perform("date"); }}>
      <fieldset className={modalStyles.fieldset} disabled={busy || loading || !!pending}>
        <legend>Completar fecha de un insumo</legend><p className={modalStyles.help}>La fecha de registro puede ser distinta de la compra. Indicá la fecha real; se agrega como dato histórico, sin modificar la entrada original.</p>
        <label>Entrada sin fecha<select value={chosenMovement ?? ""} onChange={event => { setMovement(event.target.value); setDate(""); }}>
          {pending && !data?.missing_supply_dates.some(item => item.movement_id === pending.p_movement_id) && <option value={pending.p_movement_id}>Intento pendiente de confirmar</option>}
          {data?.missing_supply_dates.map(item => <option key={item.movement_id} value={item.movement_id}>{item.supply_name} · {item.quantity} {item.unit} · registrado {new Date(item.recorded_at).toLocaleDateString("es-CR")}</option>)}
        </select></label>
        <label>Fecha real de compra<input type="date" required value={date} onChange={event => setDate(event.target.value)} /></label>
      </fieldset>
      {pending && <p className={modalStyles.pending}>Conservamos el intento en esta pestaña. Reintentá con los mismos datos para confirmar el resultado.</p>}
      <button className={modalStyles.primary} type="submit" disabled={busy || loading}>{busy ? "Confirmando…" : pending ? "Reintentar fecha" : "Confirmar fecha de compra"}</button>
    </form>}
    {!!data?.pending_rates.length && <section className={modalStyles.fieldset}>
      <h3>Tasas históricas pendientes</h3><p className={modalStyles.help}>Cada consulta confirma una fecha y moneda. Una tasa guardada se reutiliza en todas tus compras que coincidan.</p>
      <label>Fecha y moneda para valorar<select disabled={busy || loading || !!pending} value={chosenRate ? `${chosenRate.acquisition_date}:${chosenRate.source_currency}` : ""} onChange={event => setRateKey(event.target.value)}>
        {data.pending_rates.map(rate => <option key={`${rate.acquisition_date}:${rate.source_currency}`} value={`${rate.acquisition_date}:${rate.source_currency}`}>{rate.acquisition_date} · {rate.source_currency}</option>)}
      </select></label><button type="button" className={modalStyles.primary} disabled={busy || loading || !!pending} onClick={() => void perform("rate")}>{busy ? "Consultando…" : "Consultar tasa BCCR"}</button>
    </section>}
    <div className={styles.breakdown}>{data?.rows.map(row => <article key={`${row.asset_type}:${row.id}`}>
      <strong>{row.name}</strong><small>{row.asset_type === "filament" ? "Filamento" : "Insumo"}</small>
      <p>CRC {money(row.remaining_crc_value, "CRC")} · USD {money(row.remaining_usd_value, "USD")}</p>
      {row.issue && <small>{({ missing_fx_snapshot: "Tasa histórica pendiente", missing_acquisition_date: "Falta fecha de compra", missing_cost: "Completá el costo desde la ficha de compra", corrected_order_mismatch: "La corrección requiere conciliación con su orden", unsupported_currency: "Moneda sin conversión disponible", ambiguous_movement_order: "No hay un orden histórico comprobable para convertir este saldo" } as Record<string,string>)[row.issue] ?? "Valoración incompleta"}</small>}
    </article>)}</div>
    {data && !data.rows.length && <p>Todavía no hay filamentos ni insumos que valorar.</p>}
  </ModalFrame>;
}
