"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Search } from "lucide-react";
import { ModalFrame } from "@/components/modal-frame";
import { defaultLanguage, formatDate, languageLocale, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";
import type { FilamentInventoryValuation, InventoryBalanceRow, RollStatus } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase";
import { loadReportValuations, matchReportValuation, missingReportRates, requestReportRate, summarizeValuations, valuationAmount, valuationCsvCells, valuationNoteKey } from "@/lib/inventory-valuation-report";

const statusLabels: Record<RollStatus, string> = {
  new: "Nuevo",
  open: "Abierto",
  low: "Bajo",
  empty: "Agotado",
  archived: "Archivado"
};

function reportMoney(value: number | null, currency: string, language: AppLanguage) {
  if (value == null) return translate(language, "filamentReport.missingCost");
  return new Intl.NumberFormat(languageLocale(language), {
    style: "currency",
    currency,
    currencyDisplay: language === "en" ? "code" : "symbol",
    maximumFractionDigits: currency === "CRC" ? 0 : 2
  }).format(value);
}

function safeCsvCell(value: string | number | null | undefined) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(rows: InventoryBalanceRow[], valuations: Map<string, FilamentInventoryValuation> | null) {
  const headers = [
    "Marca", "Material", "Línea", "Color", "HEX", "Gramos disponibles",
    "Porcentaje restante", "Estado", "Spool", "Proveedor", "Precio pagado",
    "Costo consumible restante", "Moneda", "Ubicación", "QR", "NFC"
  ];
  if (valuations) headers.push("Restante histórico CRC", "Restante histórico USD", "Estado valoración", "Fecha adquisición", "Moneda valoración", "Restante histórico original", "Base de costo", "Confianza costo", "Fuente FX", "Fecha indicador 318", "Fecha indicador 333");
  const body = rows.map((row) => [
    row.brand,
    row.material,
    row.product_line,
    row.color_name,
    row.color_hex,
    row.available_weight_g,
    row.remaining_percent,
    statusLabels[row.status],
    row.spool_code,
    row.supplier_name,
    row.purchase_total,
    row.remaining_filament_value,
    row.currency,
    row.location,
    row.qr_payload,
    row.nfc_tag_id,
    ...(valuations ? valuationCsvCells(matchReportValuation(row, valuations.get(row.roll_id))) : [])
  ].map(safeCsvCell).join(","));
  const csv = `\uFEFF${headers.map(safeCsvCell).join(",")}\n${body.join("\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `saldo-filamentos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

type Props = {
  language?: AppLanguage;
  rows: InventoryBalanceRow[];
  mode: "authenticated" | "demo" | "local" | "error";
  isLoading: boolean;
  error: string;
  onClose: () => void;
};

export function InventoryReportModal({ rows, mode, isLoading, error, onClose, language = defaultLanguage }: Props) {
  const t = (key: MessageKey, params?: Readonly<Record<string, string | number>>) => translate(language, key, params);
  const locale = languageLocale(language);
  const formatMoney = (value: number | null, currency: string) => reportMoney(value, currency, language);
  const dateLabel = (value: string) => language === "es" ? value :
    formatDate(value, language, { dateStyle: "medium" }) ?? t("dateUnavailable");
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [valuationResult, setValuationResult] = useState<{
    rows: InventoryBalanceRow[]; values: FilamentInventoryValuation[]; error: "filamentReport.loadError" | "filamentReport.readError" | "";
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const [selectedRate, setSelectedRate] = useState("");
  const [isRequestingRate, setIsRequestingRate] = useState(false);
  const [rateNotice, setRateNotice] = useState<{ error: false; date: string; currency: string } | { error: true; original?: string } | null>(null);
  const rateRequest = useRef<AbortController | null>(null);
  const rateFeedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (rateNotice) rateFeedback.current?.focus(); }, [rateNotice]);
  useEffect(() => {
    setIsRequestingRate(false);
    setRateNotice(null);
    return () => { rateRequest.current?.abort(); rateRequest.current = null; };
  }, [mode, rows]);
  useEffect(() => {
    if (mode !== "authenticated" || isLoading || error) return;
    const controller = new AbortController();
    setValuationResult(null);
    async function load() {
      try {
        const client = getSupabaseClient();
        if (!client) throw new Error("Client unavailable");
        const values = await loadReportValuations(client, rows.map((row) => row.roll_id), controller.signal);
        if (!controller.signal.aborted) setValuationResult({ rows, values, error: "" });
      } catch {
        if (!controller.signal.aborted) setValuationResult({ rows, values: [], error: "filamentReport.loadError" });
      }
    }
    void load();
    return () => controller.abort();
  }, [rows, mode, isLoading, error, retry]);
  const currentValuation = mode === "authenticated" && !isLoading && !error && valuationResult?.rows === rows ? valuationResult : null;
  const valuations = useMemo(() => new Map((currentValuation?.values ?? []).map((value) => [value.roll_id, value])), [currentValuation]);
  const filteredRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!includeArchived && row.status === "archived") return false;
      return !cleanQuery || [row.brand, row.material, row.product_line, row.color_name, row.supplier_name, row.location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(cleanQuery);
    });
  }, [includeArchived, query, rows]);
  const totals = useMemo(() => {
    const grouped = new Map<string, { purchase: number; remaining: number; incomplete: number }>();
    for (const row of filteredRows) {
      const current = grouped.get(row.currency) ?? { purchase: 0, remaining: 0, incomplete: 0 };
      current.purchase += Number(row.purchase_total ?? 0);
      current.remaining += Number(row.remaining_filament_value ?? 0);
      if (row.cost_status === "incomplete") current.incomplete += 1;
      grouped.set(row.currency, current);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRows]);
  const historicalTotals = summarizeValuations(filteredRows, valuations);
  const missingRates = missingReportRates(filteredRows, valuations);
  const selectedRequest = missingRates.find(([key]) => key === selectedRate) ?? missingRates[0];

  async function consultRate() {
    if (rateRequest.current || mode !== "authenticated" || !currentValuation || currentValuation.error || !selectedRequest) return;
    const client = getSupabaseClient();
    if (!client) return;
    const controller = new AbortController();
    rateRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    setIsRequestingRate(true);
    setRateNotice(null);
    let confirmed = false;
    try {
      await requestReportRate(client, selectedRequest[1], controller.signal);
      confirmed = true;
      const values = await loadReportValuations(client, rows.map((row) => row.roll_id), controller.signal);
      if (rateRequest.current !== controller) return;
      setValuationResult({ rows, values, error: "" });
      setRateNotice({ error: false, date: selectedRequest[1].acquisition_date, currency: selectedRequest[1].source_currency });
    } catch (cause) {
      if (rateRequest.current !== controller) return;
      if (confirmed) {
        setValuationResult({ rows, values: [], error: "filamentReport.readError" });
        setRateNotice(null);
      } else setRateNotice({
        error: true,
        original: cause instanceof Error && cause.name !== "AbortError" && cause.name !== "TypeError" ? cause.message : undefined
      });
    } finally {
      window.clearTimeout(timeout);
      if (rateRequest.current === controller) { rateRequest.current = null; setIsRequestingRate(false); }
    }
  }

  return (
    <ModalFrame lang={language} title={t("filamentReport.title")} titleId="report-title" eyebrow={t("filamentReport.eyebrow")} className="report-modal" viewKey={currentValuation?.error ? "valuation-error" : "valuation"} busy={isRequestingRate} onClose={onClose} closeLabel={t("filamentReport.close")}>

        {mode !== "authenticated" && <p className="report-mode-note">{mode === "demo" ? t("filamentReport.demo") : t("filamentReport.local")}</p>}
        {error && <p className="report-error" role="alert">{language === "en" && <>{t("account.originalMessage")} </>}<span lang="">{error}</span></p>}

        <div className="report-toolbar">
          <label className="search-box"><Search size={17} /><input disabled={isRequestingRate} aria-label={t("filamentReport.search")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("filamentReport.searchPlaceholder")} /></label>
          <label className="report-archive-toggle"><input disabled={isRequestingRate} type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} /> {t("filamentReport.archived")}</label>
          <button type="button" onClick={() => downloadCsv(filteredRows, mode === "authenticated" ? valuations : null)} disabled={isRequestingRate || !filteredRows.length || isLoading || (mode === "authenticated" && !currentValuation && !error)}><Download size={17} /> {t("filamentReport.download")}</button>
        </div>

        {language === "en" && <p>{t("filamentReport.csvHelp")}</p>}
        <h3>{t("filamentReport.originalTitle")}</h3>
        <p>{t("filamentReport.originalHelp")}</p>
        <div className="report-totals" aria-label={t("filamentReport.originalTotals")}>
          {totals.map(([currency, total]) => <article key={currency}><span>{currency}</span><strong>{formatMoney(total.remaining, currency)}</strong><small>{t("filamentReport.purchased", { amount: formatMoney(total.purchase, currency) })}{total.incomplete ? t("filamentReport.incompleteCount", { count: total.incomplete.toLocaleString(locale) }) : ""}</small></article>)}
        </div>

        {mode === "authenticated" && !error && <section aria-labelledby="valuation-title">
          <h3 id="valuation-title">{t("filamentReport.historicalTitle")}</h3>
          <p>{t("filamentReport.historicalHelp")}</p>
          {!currentValuation ? <p role="status">{t("filamentReport.loadingValuation")}</p> : currentValuation.error ? <p className="report-error" role="alert">{t(currentValuation.error)} <button type="button" onClick={() => setRetry((value) => value + 1)}>{t("filamentReport.retryValuation")}</button></p> : <>
            <div className="report-totals" aria-label={t("filamentReport.historicalTotals")}>
              {historicalTotals.map((total) => <article key={total.currency}>
                <span>{total.currency} · {total.missing ? t("filamentReport.partial") : t("filamentReport.valued")}</span>
                <strong>{total.total == null ? t("filamentReport.unavailable") : formatMoney(total.total, total.currency)}</strong>
                <small>{t("filamentReport.valuedCount", { count: total.included.toLocaleString(locale) })}{total.missing ? t("filamentReport.pendingCount", { count: total.missing.toLocaleString(locale) }) : ""}{t("filamentReport.filtered")}</small>
              </article>)}
            </div>
            <p>{t("filamentReport.ratesHelp")}</p>
            {missingRates.length > 0 && <div>
              <p>{t("filamentReport.lookupHelp")}</p>
              <div className="report-toolbar">
                <label style={{ gridColumn: "1 / -1" }}>{t("filamentReport.dateCurrency")}<select value={selectedRequest?.[0] ?? ""} disabled={isRequestingRate} onChange={(event) => { setSelectedRate(event.target.value); setRateNotice(null); }}>
                  {missingRates.map(([key, request]) => <option key={key} value={key}>{dateLabel(request.acquisition_date)} · {request.source_currency}</option>)}
                </select></label>
                <button type="button" onClick={() => void consultRate()} disabled={isRequestingRate}>{isRequestingRate ? t("filamentReport.lookingUp") : t("filamentReport.lookup")}</button>
              </div>
            </div>}
          </>}
          {isRequestingRate && <p role="status">{t("filamentReport.lookupProgress")}</p>}
          {rateNotice && <p ref={rateFeedback} tabIndex={-1} className={rateNotice.error ? "report-error" : "report-mode-note"} role={rateNotice.error ? "alert" : "status"}>{rateNotice.error ? <>
            {rateNotice.original ? <>{language === "en" && <>{t("account.originalMessage")} </>}<span lang="">{rateNotice.original}</span></> : t("filamentReport.lookupError")}
            {" "}{t("filamentReport.lookupRetry")}
          </> : t("filamentReport.rateConfirmed", { date: dateLabel(rateNotice.date), currency: rateNotice.currency })}</p>}
        </section>}
        {mode !== "authenticated" && <p>{t("filamentReport.localHelp")}</p>}

        {isLoading ? <p className="empty-state">{t("filamentReport.loading")}</p> : filteredRows.length ? (
          <div className="report-table-wrap" tabIndex={0} role="region" aria-label={t("filamentReport.table")}>
            <table className="report-table">
              <thead><tr><th>{t("filamentReport.filament")}</th><th>{t("filamentReport.balance")}</th><th>{t("filamentReport.status")}</th><th>{t("filamentReport.spool")}</th><th>{t("filamentReport.supplier")}</th><th>{t("filamentReport.purchase")}</th><th>{t("filamentReport.remaining")}</th>{mode === "authenticated" && <><th>{t("filamentReport.crc")}</th><th>{t("filamentReport.usd")}</th><th>{t("filamentReport.valuation")}</th></>}<th>{t("location")}</th></tr></thead>
              <tbody>{filteredRows.map((row) => {
                const value = matchReportValuation(row, valuations.get(row.roll_id));
                return <tr key={row.roll_id}>
                <td><span className="report-color" style={{ backgroundColor: row.color_hex }} /><strong>{row.color_name}</strong><small>{row.brand} · {row.product_line || row.material}</small></td>
                <td><strong>{Number(row.available_weight_g).toLocaleString(locale)} g</strong><small>{Number(row.remaining_percent).toLocaleString(locale)} %</small></td>
                <td>{Object.hasOwn(statusLabels, row.status) ? t(`filamentReport.status.${row.status}`) : ""}</td>
                <td>{row.spool_code || t("filamentReport.unassigned")}</td>
                <td>{row.supplier_name || t("filamentReport.noSupplier")}</td>
                <td>{formatMoney(row.purchase_total, row.currency)}</td>
                <td className={row.cost_status === "incomplete" ? "report-incomplete" : ""}>{formatMoney(row.remaining_filament_value, row.currency)}</td>
                {mode === "authenticated" && <>
                  {(["CRC", "USD"] as const).map((currency) => <td key={currency}>{valuationAmount(value, currency) == null ? "—" : formatMoney(valuationAmount(value, currency), currency)}</td>)}
                  <td>{currentValuation ? t(`filamentReport.note.${valuationNoteKey(value)}`) : t("filamentReport.loadingRow")}
                    {value && <small>{value.acquisition_date ? t("filamentReport.acquisition", { date: dateLabel(value.acquisition_date) }) : t("filamentReport.noDate")} · {value.cost_basis_source === "purchase_order_landed" ? t("filamentReport.orderCharges") : t("filamentReport.rollCost")}{value.cost_confidence === "estimated" ? ` · ${t("filamentReport.estimated")}` : value.cost_confidence === "incomplete" ? ` · ${t("filamentReport.missingCost")}` : ""}</small>}
                  </td>
                </>}
                <td>{row.location || t("filamentReport.noLocation")}</td>
              </tr>; })}</tbody>
            </table>
          </div>
        ) : <p className="empty-state">{t("filamentReport.empty")}</p>}
    </ModalFrame>
  );
}
