"use client";

import { useMemo, useState } from "react";
import { Download, Search, X } from "lucide-react";
import type { InventoryBalanceRow, RollStatus } from "@/lib/types";

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

function downloadCsv(rows: InventoryBalanceRow[]) {
  const headers = [
    "Marca", "Material", "Línea", "Color", "HEX", "Gramos disponibles",
    "Porcentaje restante", "Estado", "Spool", "Proveedor", "Precio pagado",
    "Costo consumible restante", "Moneda", "Ubicación", "QR", "NFC"
  ];
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
    row.nfc_tag_id
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

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="panel modal-panel report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
        <div className="modal-head">
          <div><p className="eyebrow">Reporte de inventario</p><h2 id="report-title">Saldo de filamentos</h2></div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar reporte"><X size={20} /></button>
        </div>

        {mode !== "authenticated" && <p className="report-mode-note">{mode === "demo" ? "Vista con datos de demostración." : "Vista local · estos valores no están sincronizados."}</p>}
        {error && <p className="report-error" role="alert">{error}</p>}

        <div className="report-toolbar">
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en el reporte..." /></label>
          <label className="report-archive-toggle"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} /> Incluir archivados</label>
          <button type="button" onClick={() => downloadCsv(filteredRows)} disabled={!filteredRows.length || isLoading}><Download size={17} /> Descargar CSV</button>
        </div>

        <div className="report-totals" aria-label="Totales por moneda">
          {totals.map(([currency, total]) => <article key={currency}><span>{currency}</span><strong>{formatMoney(total.remaining, currency)}</strong><small>restante de {formatMoney(total.purchase, currency)} comprado{total.incomplete ? ` · ${total.incomplete} incompleto` : ""}</small></article>)}
        </div>

        {isLoading ? <p className="empty-state">Calculando saldo consistente…</p> : filteredRows.length ? (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead><tr><th>Filamento</th><th>Saldo</th><th>Estado</th><th>Spool</th><th>Proveedor</th><th>Compra</th><th>Valor restante</th><th>Ubicación</th></tr></thead>
              <tbody>{filteredRows.map((row) => <tr key={row.roll_id}>
                <td><span className="report-color" style={{ backgroundColor: row.color_hex }} /><strong>{row.color_name}</strong><small>{row.brand} · {row.product_line || row.material}</small></td>
                <td><strong>{Number(row.available_weight_g).toLocaleString("es-CR")} g</strong><small>{Number(row.remaining_percent).toLocaleString("es-CR")} %</small></td>
                <td>{statusLabels[row.status]}</td>
                <td>{row.spool_code || "Sin asignar"}</td>
                <td>{row.supplier_name || "Sin proveedor"}</td>
                <td>{formatMoney(row.purchase_total, row.currency)}</td>
                <td className={row.cost_status === "incomplete" ? "report-incomplete" : ""}>{formatMoney(row.remaining_filament_value, row.currency)}</td>
                <td>{row.location || "Sin ubicación"}</td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : <p className="empty-state">No hay rollos que coincidan con el reporte.</p>}
      </section>
    </div>
  );
}
