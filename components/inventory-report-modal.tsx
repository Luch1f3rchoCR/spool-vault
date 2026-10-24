"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Search } from "lucide-react";
import { ModalFrame } from "@/components/modal-frame";
import type { FilamentInventoryValuation, InventoryBalanceRow, RollStatus } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase";
import { loadReportValuations, matchReportValuation, missingReportRates, requestReportRate, summarizeValuations, valuationAmount, valuationCsvCells, valuationNote } from "@/lib/inventory-valuation-report";

const statusLabels: Record<RollStatus, string> = {
  new: "Nuevo",
  open: "Abierto",
  low: "Bajo",
  empty: "Agotado",
  archived: "Archivado"
};

function formatMoney(value: number | null, currency: string) {
  if (value == null) return "Costo incompleto";
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency,
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
  rows: InventoryBalanceRow[];
  mode: "authenticated" | "demo" | "local" | "error";
  isLoading: boolean;
  error: string;
  onClose: () => void;
};

export function InventoryReportModal({ rows, mode, isLoading, error, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [valuationResult, setValuationResult] = useState<{
    rows: InventoryBalanceRow[]; values: FilamentInventoryValuation[]; error: string;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const [selectedRate, setSelectedRate] = useState("");
  const [isRequestingRate, setIsRequestingRate] = useState(false);
  const [rateNotice, setRateNotice] = useState<{ text: string; error: boolean } | null>(null);
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
        if (!controller.signal.aborted) setValuationResult({ rows, values: [], error: "No se pudo cargar la valoración histórica. Los importes originales siguen disponibles." });
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
      setRateNotice({ text: `Tasa BCCR confirmada para ${selectedRequest[1].acquisition_date} · ${selectedRequest[1].source_currency}. Valoración actualizada; compras y costos originales sin cambios.`, error: false });
    } catch (cause) {
      if (rateRequest.current !== controller) return;
      if (confirmed) {
        setValuationResult({ rows, values: [], error: "La tasa fue confirmada, pero no se pudo recargar la valoración. Reintentá la lectura." });
        setRateNotice(null);
      } else setRateNotice({ text: `${cause instanceof Error && cause.name !== "AbortError" && cause.name !== "TypeError" ? cause.message : "No pudimos confirmar el resultado de la consulta."} Podés reintentar la misma fecha y moneda sin duplicar la tasa.`, error: true });
    } finally {
      window.clearTimeout(timeout);
      if (rateRequest.current === controller) { rateRequest.current = null; setIsRequestingRate(false); }
    }
  }

  return (
    <ModalFrame title="Saldo de filamentos" titleId="report-title" eyebrow="Reporte de inventario" className="report-modal" viewKey={currentValuation?.error ? "valuation-error" : "valuation"} busy={isRequestingRate} onClose={onClose} closeLabel="Cerrar reporte">

        {mode !== "authenticated" && <p className="report-mode-note">{mode === "demo" ? "Vista con datos de demostración." : "Vista local · estos valores no están sincronizados."}</p>}
        {error && <p className="report-error" role="alert">{error}</p>}

        <div className="report-toolbar">
          <label className="search-box"><Search size={17} /><input disabled={isRequestingRate} aria-label="Buscar en el reporte" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en el reporte..." /></label>
          <label className="report-archive-toggle"><input disabled={isRequestingRate} type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} /> Incluir archivados</label>
          <button type="button" onClick={() => downloadCsv(filteredRows, mode === "authenticated" ? valuations : null)} disabled={isRequestingRate || !filteredRows.length || isLoading || (mode === "authenticated" && !currentValuation && !error)}><Download size={17} /> Descargar CSV</button>
        </div>

        <h3>Importes originales · por moneda</h3>
        <p>El saldo original no incluye cargos de la orden ni conversiones.</p>
        <div className="report-totals" aria-label="Totales originales por moneda">
          {totals.map(([currency, total]) => <article key={currency}><span>{currency}</span><strong>{formatMoney(total.remaining, currency)}</strong><small>restante de {formatMoney(total.purchase, currency)} comprado{total.incomplete ? ` · ${total.incomplete} incompleto` : ""}</small></article>)}
        </div>

        {mode === "authenticated" && !error && <section aria-labelledby="valuation-title">
          <h3 id="valuation-title">Valor histórico del filamento restante</h3>
          <p>Incluye cargos asignados de la orden cuando existen. Excluye spools, insumos y archivados. No es valor de mercado ni monto realmente pagado.</p>
          {!currentValuation ? <p role="status">Cargando valoración histórica…</p> : currentValuation.error ? <p className="report-error" role="alert">{currentValuation.error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Reintentar valoración</button></p> : <>
            <div className="report-totals" aria-label="Valor histórico en CRC y USD">
              {historicalTotals.map((total) => <article key={total.currency}>
                <span>{total.currency} · {total.missing ? "Subtotal disponible" : "Saldo valorado"}</span>
                <strong>{total.total == null ? "Sin valoración disponible" : formatMoney(total.total, total.currency)}</strong>
                <small>{total.included} rollos valorados{total.missing ? ` · ${total.missing} pendientes, no incluidos` : ""} · según filtros</small>
              </article>)}
            </div>
            <p>Las conversiones usan tasas BCCR guardadas para la fecha de adquisición; los importes en su propia moneda no requieren conversión. Las tasas faltantes no se consultan automáticamente.</p>
            {missingRates.length > 0 && <div>
              <p>Elegí una fecha y moneda pendiente según los filtros. Consultar guarda o recupera una tasa histórica para todos tus filamentos de esa fecha y moneda, incluidos los que no muestra el filtro. No cambia compras ni el monto pagado.</p>
              <div className="report-toolbar">
                <label style={{ gridColumn: "1 / -1" }}>Fecha y moneda<select value={selectedRequest?.[0] ?? ""} disabled={isRequestingRate} onChange={(event) => { setSelectedRate(event.target.value); setRateNotice(null); }}>
                  {missingRates.map(([key, request]) => <option key={key} value={key}>{request.acquisition_date} · {request.source_currency}</option>)}
                </select></label>
                <button type="button" onClick={() => void consultRate()} disabled={isRequestingRate}>{isRequestingRate ? "Consultando BCCR…" : "Consultar tasa BCCR"}</button>
              </div>
            </div>}
          </>}
          {isRequestingRate && <p role="status">Consultando y actualizando la valoración. Esperá la confirmación.</p>}
          {rateNotice && <p ref={rateFeedback} tabIndex={-1} className={rateNotice.error ? "report-error" : "report-mode-note"} role={rateNotice.error ? "alert" : "status"}>{rateNotice.text}</p>}
        </section>}
        {mode !== "authenticated" && <p>La valoración histórica BCCR requiere un inventario sincronizado. No se calculan conversiones en modo local/demo.</p>}

        {isLoading ? <p className="empty-state">Calculando saldo consistente…</p> : filteredRows.length ? (
          <div className="report-table-wrap" tabIndex={0} role="region" aria-label="Saldo de filamentos; desplazamiento horizontal">
            <table className="report-table">
              <thead><tr><th>Filamento</th><th>Saldo</th><th>Estado</th><th>Spool</th><th>Proveedor</th><th>Compra</th><th>Restante original</th>{mode === "authenticated" && <><th>Histórico CRC</th><th>Histórico USD</th><th>Detalle valoración</th></>}<th>Ubicación</th></tr></thead>
              <tbody>{filteredRows.map((row) => {
                const value = matchReportValuation(row, valuations.get(row.roll_id));
                return <tr key={row.roll_id}>
                <td><span className="report-color" style={{ backgroundColor: row.color_hex }} /><strong>{row.color_name}</strong><small>{row.brand} · {row.product_line || row.material}</small></td>
                <td><strong>{Number(row.available_weight_g).toLocaleString("es-CR")} g</strong><small>{Number(row.remaining_percent).toLocaleString("es-CR")} %</small></td>
                <td>{statusLabels[row.status]}</td>
                <td>{row.spool_code || "Sin asignar"}</td>
                <td>{row.supplier_name || "Sin proveedor"}</td>
                <td>{formatMoney(row.purchase_total, row.currency)}</td>
                <td className={row.cost_status === "incomplete" ? "report-incomplete" : ""}>{formatMoney(row.remaining_filament_value, row.currency)}</td>
                {mode === "authenticated" && <>
                  {(["CRC", "USD"] as const).map((currency) => <td key={currency}>{valuationAmount(value, currency) == null ? "—" : formatMoney(valuationAmount(value, currency), currency)}</td>)}
                  <td>{currentValuation ? valuationNote(value) : "Cargando…"}
                    {value && <small>{value.acquisition_date ? `Adquisición: ${value.acquisition_date}` : "Sin fecha"} · {value.cost_basis_source === "purchase_order_landed" ? "Con cargos de orden" : "Costo del rollo"}{value.cost_confidence === "estimated" ? " · Costo estimado" : value.cost_confidence === "incomplete" ? " · Costo incompleto" : ""}</small>}
                  </td>
                </>}
                <td>{row.location || "Sin ubicación"}</td>
              </tr>; })}</tbody>
            </table>
          </div>
        ) : <p className="empty-state">No hay rollos que coincidan con el reporte.</p>}
    </ModalFrame>
  );
}
