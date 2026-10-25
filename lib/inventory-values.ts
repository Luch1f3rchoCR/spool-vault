import type { SupabaseClient } from "@supabase/supabase-js";
import type { InventoryValueSummary, InventoryValueRow } from "./types";

export function inventoryValueTotal(rows: InventoryValueRow[], currency: "CRC" | "USD", kind?: InventoryValueRow["asset_type"]) {
  const selected = kind ? rows.filter(row => row.asset_type === kind) : rows;
  let total = 0, included = 0, missing = 0;
  for (const row of selected) {
    const value = currency === "CRC" ? row.remaining_crc_value : row.remaining_usd_value;
    if (value == null) missing++;
    else { total += value; included++; }
  }
  return { total: included || !selected.length ? total : null, included, missing };
}

export function isInventoryValueSummary(value: unknown, userId: string): value is InventoryValueSummary {
  if (!value || typeof value !== "object") return false;
  const data = value as InventoryValueSummary;
  const amount = (number: unknown) => number === null || typeof number === "number" && Number.isFinite(number) && number >= 0;
  return data.user_id === userId && typeof data.as_of === "string" && Number.isFinite(Date.parse(data.as_of))
    && Array.isArray(data.rows) && data.rows.every(row => row && ["filament", "supply"].includes(row.asset_type)
      && typeof row.id === "string" && typeof row.name === "string" && typeof row.quantity === "number" && row.quantity >= 0 && Number.isFinite(row.quantity)
      && typeof row.original_currency === "string" && amount(row.remaining_original_value)
      && amount(row.remaining_crc_value) && amount(row.remaining_usd_value) && (row.issue === null || typeof row.issue === "string"))
    && Array.isArray(data.pending_rates) && data.pending_rates.every(rate => rate && /^\d{4}-\d{2}-\d{2}$/.test(rate.acquisition_date) && ["CRC", "USD", "EUR"].includes(rate.source_currency))
    && Array.isArray(data.missing_supply_dates) && data.missing_supply_dates.every(date => date && typeof date.movement_id === "string"
      && typeof date.supply_name === "string" && typeof date.unit === "string" && typeof date.recorded_at === "string" && typeof date.quantity === "number" && date.quantity > 0);
}

// Bound the pre-fetch auth wait as well as network I/O.
export function awaitInventoryRequest<T>(request: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Se agotó el tiempo de espera. Podés reintentar."));
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(request).then(value => { signal.removeEventListener("abort", abort); resolve(value); }, error => {
      signal.removeEventListener("abort", abort); reject(error);
    });
    if (signal.aborted) abort();
  });
}

export async function loadInventoryValueSummary(client: SupabaseClient, userId: string, signal: AbortSignal) {
  const result = await awaitInventoryRequest(client.rpc("inventory_value_summary").abortSignal(signal), signal);
  if (result.error || !isInventoryValueSummary(result.data, userId)) throw new Error("No se pudo confirmar el saldo del inventario.");
  return result.data;
}
