"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, Wallet } from "lucide-react";
import { ModalFrame } from "./modal-frame";
import { defaultLanguage, formatDate, languageLocale, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";
import { getSupabaseClient } from "../lib/supabase";
import { awaitInventoryRequest, inventoryValueTotal, loadInventoryValueSummary } from "../lib/inventory-values";
import { requestReportRate } from "../lib/inventory-valuation-report";
import { isIsoAcquisitionDate } from "../lib/historical-fx";
import type { FilamentRoll, InventoryValueSummary } from "../lib/types";
import type { Supply } from "../lib/supplies";
import styles from "./inventory-value-summary.module.css";
import modalStyles from "./supplies-modal.module.css";

type Mode = "authenticated" | "demo" | "local" | "error";
type SummaryError = "inventoryValue.loadError" | "";
export function useInventoryValueSummary(rolls: FilamentRoll[], supplies: Supply[], mode: Mode, userId: string) {
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{ rolls: FilamentRoll[]; supplies: Supply[]; userId: string; revision: number; data: InventoryValueSummary | null; error: SummaryError } | null>(null);
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
        if (!cancelled) setLoaded({ rolls, supplies, userId, revision, data: null, error: "inventoryValue.loadError" });
      } finally { clearTimeout(timer); }
    }
    void load();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [rolls, supplies, mode, userId, revision]);
  const current = mode === "authenticated" && loaded?.rolls === rolls && loaded.supplies === supplies && loaded.userId === userId && loaded.revision === revision ? loaded : null;
  return { data: current?.data ?? null, error: current?.error ?? "", loading: mode === "authenticated" && !current, refresh: () => setRevision(value => value + 1) };
}

function money(value: number | null, currency: string, language = defaultLanguage) {
  if (value == null) return "—";
  return new Intl.NumberFormat(languageLocale(language), {
    style: "currency",
    currency,
    currencyDisplay: language === "en" ? "code" : "symbol",
    maximumFractionDigits: currency === "CRC" ? 0 : 2
  }).format(value);
}

export function InventoryValueCards({ data, loading, error, mode, onRefresh, onDetails, language = defaultLanguage }: {
  language?: AppLanguage;
  data: InventoryValueSummary | null; loading: boolean; error: SummaryError; mode: Mode; onRefresh: () => void; onDetails: () => void;
}) {
  const t = (key: MessageKey, values?: Readonly<Record<string, string | number>>) => translate(language, key, values);
  return <section className={styles.panel} lang={language} aria-label={t("inventoryValue.region")}>
    <header><Wallet size={19} aria-hidden="true" /><div><h2>{t("inventoryValue.title")}</h2><p className={styles.help}>{t("inventoryValue.subtitle")}</p></div></header>
    <div className={styles.cards}>{(["CRC", "USD"] as const).map(currency => {
      const total = data ? inventoryValueTotal(data.rows, currency) : null;
      return <article key={currency} aria-label={t("inventoryValue.balance", { currency })}>
        <span className={styles.currency}>{t(currency === "CRC" ? "inventoryValue.crc" : "inventoryValue.usd")}</span>
        <strong className={styles.amount}>{loading ? t("inventoryValue.loading") : money(total?.total ?? null, currency, language)}</strong>
        {total && <span>{total.missing
          ? t(total.missing === 1 ? "inventoryValue.partialOne" : "inventoryValue.partialMany", { count: total.missing.toLocaleString(languageLocale(language)) })
          : t("inventoryValue.complete")}</span>}
      </article>;
    })}</div>
    {mode === "authenticated" && <div className={styles.actions}>
      <button type="button" disabled={loading || !data} onClick={onDetails} aria-label={t("inventoryValue.detailsLabel")}>{t("inventoryValue.details")}</button>
      <button type="button" disabled={loading} onClick={onRefresh}><RefreshCw size={15} aria-hidden="true" />{loading ? t("inventoryValue.refreshing") : t("inventoryValue.refresh")}</button>
    </div>}
    {mode !== "authenticated" && <p className={styles.help}>{t("inventoryValue.signedOut")}</p>}
    {error && <p role="alert" className={styles.help}>{t(error)}</p>}
    {data && data.rows.some(row => row.remaining_crc_value == null || row.remaining_usd_value == null) && <p className={styles.help} role="status">{t("inventoryValue.partialHelp")}</p>}
  </section>;
}

type DateAttempt = { p_request_id: string; p_movement_id: string; p_purchased_at: string };
type DetailMessage = { key: MessageKey; original?: string; detail?: MessageKey };
const valuationIssues: Readonly<Partial<Record<string, MessageKey>>> = {
  missing_fx_snapshot: "inventoryDetail.missingRate",
  missing_acquisition_date: "inventoryDetail.missingPurchaseDate",
  missing_cost: "inventoryDetail.missingCost",
  corrected_order_mismatch: "inventoryDetail.orderMismatch",
  unsupported_currency: "inventoryDetail.unsupportedCurrency",
  ambiguous_movement_order: "inventoryDetail.ambiguousOrder"
};

export function InventoryValueDetails({ data, loading, error, userId, onRefresh, onClose, language = defaultLanguage }: {
  language?: AppLanguage;
  data: InventoryValueSummary | null; loading: boolean; error: SummaryError; userId: string; onRefresh: () => void; onClose: () => void;
}) {
  const t = (key: MessageKey, values?: Readonly<Record<string, string | number>>) => translate(language, key, values);
  const locale = languageLocale(language);
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
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<DetailMessage | null>(null);
  const guard = useRef(false), active = useRef<AbortController | null>(null), feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => { if (message || error) feedback.current?.focus(); }, [message, error]);
  const chosenRate = data?.pending_rates.find(rate => `${rate.acquisition_date}:${rate.source_currency}` === rateKey) ?? data?.pending_rates[0];
  const chosenMovement = pending?.p_movement_id || (data?.missing_supply_dates.some(item => item.movement_id === movement) ? movement : data?.missing_supply_dates[0]?.movement_id);

  async function perform(kind: "rate" | "date") {
    if (guard.current) return;
    const client = getSupabaseClient();
    if (!client) { setMessage({ key: "inventoryDetail.offline" }); return; }
    let operation: DateAttempt | null = null;
    if (kind === "date") {
      if (!chosenMovement || !isIsoAcquisitionDate(date)) { setMessage({ key: "inventoryDetail.chooseDate" }); return; }
      operation = pending ?? { p_request_id: crypto.randomUUID(), p_movement_id: chosenMovement, p_purchased_at: date };
      try { sessionStorage.setItem(key, JSON.stringify(operation)); } catch { setMessage({ key: "inventoryDetail.storageError" }); return; }
      setPending(operation);
    } else if (!chosenRate) return;
    guard.current = true; setBusy(true); setMessage(null);
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
          || result.data.movement_id !== operation!.p_movement_id || result.data.purchased_at !== operation!.p_purchased_at) {
          setMessage({ key: "inventoryDetail.operationError", detail: "inventoryDetail.dateUnconfirmed" });
          return;
        }
        sessionStorage.removeItem(key); setPending(null); setDate("");
      }
      setMessage({ key: kind === "rate" ? "inventoryDetail.rateSaved" : "inventoryDetail.dateSaved" });
      onRefresh();
    } catch (cause) {
      setMessage(cause instanceof Error
        ? { key: "inventoryDetail.operationError", original: cause.message }
        : { key: "inventoryDetail.operationError", detail: "inventoryDetail.tryAgain" });
    }
    finally { clearTimeout(timer); active.current = null; guard.current = false; setBusy(false); }
  }

  return <ModalFrame lang={language} title={t("inventoryDetail.title")} titleId="inventory-values-title" eyebrow={t("inventoryDetail.eyebrow")} className={modalStyles.modal}
    busy={busy} onClose={() => { if (!guard.current) onClose(); }} closeLabel={t("inventoryDetail.close")}>
    <p className={modalStyles.intro}>{t("inventoryDetail.intro")}</p>
    {(message || error) && <p ref={feedback} tabIndex={-1} role={error ? "alert" : "status"} className={modalStyles.feedback}>{message && <>
        {t(message.key)}
        {message.detail && <> {t(message.detail)}</>}
        {message.original && <> {language === "en" && <>{t("account.originalMessage")} </>}<span lang="">{message.original}</span></>}
      </>}
      {error && <>{message && " "}{t(error)}</>}</p>}
    {loading && <p role="status">{t("inventoryDetail.refreshing")}</p>}
    {error && <button type="button" disabled={busy || loading} onClick={onRefresh}>{t("inventoryDetail.retrySummary")}</button>}
    {(!!data?.missing_supply_dates.length || pending) && <form className={modalStyles.form} onSubmit={event => { event.preventDefault(); void perform("date"); }}>
      <fieldset className={modalStyles.fieldset} disabled={busy || loading || !!pending}>
        <legend>{t("inventoryDetail.completeDate")}</legend><p className={modalStyles.help}>{t("inventoryDetail.dateHelp")}</p>
        <label>{t("inventoryDetail.missingDate")}<select value={chosenMovement ?? ""} onChange={event => { setMovement(event.target.value); setDate(""); }}>
          {pending && !data?.missing_supply_dates.some(item => item.movement_id === pending.p_movement_id) && <option value={pending.p_movement_id}>{t("inventoryDetail.unconfirmed")}</option>}
          {data?.missing_supply_dates.map(item => <option key={item.movement_id} value={item.movement_id}>{t("inventoryDetail.recorded", {
            name: item.supply_name,
            quantity: language === "es" ? item.quantity : item.quantity.toLocaleString(locale),
            unit: item.unit,
            date: language === "es" ? new Date(item.recorded_at).toLocaleDateString(locale) :
              formatDate(item.recorded_at, language, { dateStyle: "medium" }) ?? t("dateUnavailable")
          })}</option>)}
        </select></label>
        <label>{t("inventoryDetail.actualDate")}<input type="date" required value={date} onChange={event => setDate(event.target.value)} /></label>
      </fieldset>
      {pending && <p className={modalStyles.pending}>{t("inventoryDetail.pending")}</p>}
      <button className={modalStyles.primary} type="submit" disabled={busy || loading}>{busy ? t("inventoryDetail.confirming") : pending ? t("inventoryDetail.retryDate") : t("inventoryDetail.confirmDate")}</button>
    </form>}
    {!!data?.pending_rates.length && <section className={modalStyles.fieldset}>
      <h3>{t("inventoryDetail.pendingRates")}</h3><p className={modalStyles.help}>{t("inventoryDetail.rateHelp")}</p>
      <label>{t("inventoryDetail.rateChoice")}<select disabled={busy || loading || !!pending} value={chosenRate ? `${chosenRate.acquisition_date}:${chosenRate.source_currency}` : ""} onChange={event => setRateKey(event.target.value)}>
        {data.pending_rates.map(rate => <option key={`${rate.acquisition_date}:${rate.source_currency}`} value={`${rate.acquisition_date}:${rate.source_currency}`}>{language === "es" ? rate.acquisition_date : formatDate(rate.acquisition_date, language, { dateStyle: "medium" }) ?? t("dateUnavailable")} · {rate.source_currency}</option>)}
      </select></label><button type="button" className={modalStyles.primary} disabled={busy || loading || !!pending} onClick={() => void perform("rate")}>{busy ? t("inventoryDetail.lookingUp") : t("inventoryDetail.lookup")}</button>
    </section>}
    <div className={styles.breakdown}>{data?.rows.map(row => <article key={`${row.asset_type}:${row.id}`}>
      <strong>{row.name}</strong><small>{row.asset_type === "filament" ? t("inventoryDetail.filament") : t("inventoryDetail.supply")}</small>
      <p>{(["CRC", "USD"] as const).map(currency => {
        const value = currency === "CRC" ? row.remaining_crc_value : row.remaining_usd_value;
        const formatted = money(value, currency, language);
        return language === "es" || value == null ? `${currency} ${formatted}` : formatted;
      }).join(" · ")}</p>
      {row.issue && <small>{t(Object.hasOwn(valuationIssues, row.issue) ? valuationIssues[row.issue] ?? "inventoryDetail.incomplete" : "inventoryDetail.incomplete")}</small>}
    </article>)}</div>
    {data && !data.rows.length && <p>{t("inventoryDetail.empty")}</p>}
  </ModalFrame>;
}
