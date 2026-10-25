import type { FilamentPrintProfile, FilamentPrintProfileValues } from "./types";
import { printProfileNumericFields, validatePrintProfileName, validatePrintProfileNumber } from "./filament-print-profile-fields";

export type PrintProfileOperation = {
  p_request_id: string;
  p_profile_id: string;
  p_expected_version: number;
  p_values: FilamentPrintProfileValues;
};

// PostgREST can wait for an auth refresh before reaching fetch. Bound that wait too.
export function awaitPrintProfileRequest<T>(request: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Se agotó el tiempo de espera. Podés reintentar con la misma operación."));
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(request).then(value => { signal.removeEventListener("abort", abort); resolve(value); }, cause => {
      signal.removeEventListener("abort", abort); reject(cause);
    });
    if (signal.aborted) abort();
  });
}

export function printProfileValues(form: FormData, rollId: string): FilamentPrintProfileValues {
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const name = text("profile_name"), error = validatePrintProfileName(name);
  if (error) throw new Error(error);
  if (!text("printer_id")) throw new Error("Elegí una impresora.");
  const values: FilamentPrintProfileValues = {
    roll_id: rollId, printer_id: text("printer_id"), name, slicer: text("slicer") || null,
    notes: text("profile_notes") || null, nozzle_diameter_mm: null,
    nozzle_temperature_c: null, bed_temperature_c: null, flow_ratio: null
  };
  for (const field of printProfileNumericFields) {
    const result = validatePrintProfileNumber(text(field.name), field.positive);
    if (result.error) throw new Error(`${field.label}: ${result.error}`);
    values[field.name] = result.value;
  }
  if ((values.slicer?.length ?? 0) > 120 || (values.notes?.length ?? 0) > 2000) throw new Error("El texto excede el largo permitido.");
  return values;
}

export function confirmedPrintProfile(value: unknown, operation: PrintProfileOperation, userId: string): value is FilamentPrintProfile {
  if (!value || typeof value !== "object") return false;
  const row = value as FilamentPrintProfile;
  return typeof row.id === "string" && row.user_id === userId && row.profile_id === operation.p_profile_id
    && row.request_id === operation.p_request_id && row.version === operation.p_expected_version + 1
    && Object.entries(operation.p_values).every(([key, expected]) => {
      const actual = row[key as keyof FilamentPrintProfileValues];
      return typeof expected === "number" ? actual !== null && Number(actual) === expected : actual === expected;
    });
}

export function restorePrintProfileOperation(raw: string | null, rollId: string): PrintProfileOperation | null {
  if (!raw) return null;
  const value = JSON.parse(raw) as PrintProfileOperation;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(value.p_request_id) || !uuid.test(value.p_profile_id) || !Number.isInteger(value.p_expected_version)
    || value.p_expected_version < 0 || value.p_values?.roll_id !== rollId
    || !uuid.test(value.p_values.printer_id) || typeof value.p_values.name !== "string") {
    throw new Error("No se pudo recuperar el intento pendiente. No guardamos una configuración nueva.");
  }
  return value;
}
