import type { SupabaseClient } from "@supabase/supabase-js";
import type { FilamentInventoryValuation, HistoricalFxSnapshot, InventoryBalanceRow } from "./types";

type FxRequest = Pick<HistoricalFxSnapshot, "acquisition_date" | "source_currency">;

export function missingReportRates(rows: InventoryBalanceRow[], values: Map<string, FilamentInventoryValuation>) {
  const requests = new Map<string, FxRequest>();
  for (const row of rows) {
    const value = matchReportValuation(row, values.get(row.roll_id));
    const currency = value?.original_currency;
    if (value?.incompleteness_reason !== "missing_fx_snapshot" || value.fx_status !== "incomplete"
      || row.status === "archived" || !value.acquisition_date
      || (currency !== "CRC" && currency !== "USD" && currency !== "EUR")) continue;
    requests.set(`${value.acquisition_date}:${currency}`, { acquisition_date: value.acquisition_date, source_currency: currency });
  }
  return [...requests.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export async function requestReportRate(client: SupabaseClient, request: FxRequest, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  signal.throwIfAborted();
  let onAbort = () => {};
  const { data, error } = await new Promise<Awaited<ReturnType<typeof client.auth.getSession>>>((resolve, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    client.auth.getSession().then(resolve, reject);
  }).finally(() => signal.removeEventListener("abort", onAbort));
  signal.throwIfAborted();
  if (error || !data.session?.access_token) throw new Error("La sesión venció. Volvé a iniciar sesión.");
  // getSession only supplies the bearer; the existing server endpoint verifies getUser.
  const response = await fetcher("/api/financial/historical-fx", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(request), cache: "no-store", signal
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof result?.error === "string" && result.error.length < 250 ? result.error : "No se pudo confirmar la consulta histórica.");
  const snapshot = result?.snapshot;
  if (!snapshot?.id || snapshot.user_id !== data.session.user.id || snapshot.source !== "BCCR"
    || snapshot.acquisition_date !== request.acquisition_date || snapshot.source_currency !== request.source_currency) {
    throw new Error("La respuesta no confirma la tasa solicitada.");
  }
  return { reused: result.reused === true };
}

// Read only: opening/exporting a report never creates an FX snapshot.
export async function loadReportValuations(client: SupabaseClient, rollIds: string[], signal: AbortSignal) {
  const values: FilamentInventoryValuation[] = [];
  const ids = [...new Set(rollIds)];
  for (let offset = 0; offset < ids.length; offset += 200) {
    signal.throwIfAborted();
    const { data, error } = await client.from("filament_inventory_valuation")
      .select("*").in("roll_id", ids.slice(offset, offset + 200)).abortSignal(signal);
    if (error) throw error;
    values.push(...(data ?? []) as FilamentInventoryValuation[]);
  }
  return values;
}

export function matchReportValuation(row: InventoryBalanceRow, value?: FilamentInventoryValuation) {
  // These views are separate reads, not a shared transactional snapshot.
  // Hide a valuation if the physical balance changed between reads.
  if (!value || value.roll_id !== row.roll_id || value.status !== row.status
    || Number(value.available_weight_g) !== Number(row.available_weight_g)
    || Number(value.initial_weight_g) !== Number(row.initial_weight_g)
    || (row.user_id && value.user_id !== row.user_id)) return undefined;
  return value;
}

export function valuationNote(value?: FilamentInventoryValuation) {
  if (!value) return "Valoración no disponible; volvé a abrir el reporte.";
  if (value.fx_status === "excluded_archived") return "Archivado · excluido de la valoración";
  if (value.fx_status === "complete_zero") return "Sin saldo disponible";
  const reasons: Record<NonNullable<FilamentInventoryValuation["incompleteness_reason"]>, string> = {
    missing_cost: "Falta registrar el costo",
    missing_acquisition_date: "Falta la fecha de compra",
    unsupported_currency: "Moneda sin conversión disponible",
    missing_fx_snapshot: "Tasa histórica BCCR pendiente",
    corrected_order_mismatch: "Corrección pendiente de conciliar con la orden"
  };
  return value.incompleteness_reason ? reasons[value.incompleteness_reason] ?? "Valoración incompleta" : "Tasa histórica BCCR guardada";
}

export function valuationAmount(value: FilamentInventoryValuation | undefined, currency: "CRC" | "USD") {
  if (!value || value.fx_status === "excluded_archived") return null;
  const amount = currency === "CRC" ? value.remaining_crc_value : value.remaining_usd_value;
  return amount != null && Number.isFinite(Number(amount)) && Number(amount) >= 0 ? Number(amount) : null;
}

export function summarizeValuations(rows: InventoryBalanceRow[], byId: Map<string, FilamentInventoryValuation>) {
  return (["CRC", "USD"] as const).map((currency) => {
    let total = 0, included = 0, missing = 0;
    for (const row of rows) {
      if (row.status === "archived") continue;
      const amount = valuationAmount(matchReportValuation(row, byId.get(row.roll_id)), currency);
      if (amount == null) missing += 1;
      else { total += amount; included += 1; }
    }
    return { currency, total: included ? total : null, included, missing };
  });
}

export function valuationCsvCells(value?: FilamentInventoryValuation) {
  return [
    valuationAmount(value, "CRC"), valuationAmount(value, "USD"), valuationNote(value),
    value?.acquisition_date, value?.original_currency, value?.remaining_original_value,
    value?.cost_basis_source, value?.cost_confidence, value?.fx_source,
    value?.indicator_318_effective_date, value?.indicator_333_effective_date
  ];
}
