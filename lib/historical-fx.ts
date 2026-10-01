export const BCCR_API_BASE = "https://apim.bccr.fi.cr/SDDE/api/Bccr.GE.SDDE.Publico.Indicadores.API";
export const BCCR_USD_CRC_INDICATOR = 318;
export const BCCR_EUR_USD_INDICATOR = 333;

export type HistoricalFxCurrency = "CRC" | "USD" | "EUR";

export type BccrObservation = {
  indicator: number;
  effectiveDate: string;
  rawValue: string;
};

type BccrResponse = {
  estado?: unknown;
  datos?: unknown;
};

function validIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

export function parseBccrObservation(payload: unknown, indicator: number, acquisitionDate: string): BccrObservation {
  if (!validIsoDate(acquisitionDate)) throw new Error("Fecha de adquisición inválida.");
  if (!payload || typeof payload !== "object" || (payload as BccrResponse).estado !== true || !Array.isArray((payload as BccrResponse).datos)) {
    throw new Error("BCCR devolvió una respuesta inválida.");
  }

  const matches: Array<{ fecha: string; valorDatoPorPeriodo: number }> = [];
  for (const group of (payload as { datos: unknown[] }).datos) {
    if (!group || typeof group !== "object" || !Array.isArray((group as { series?: unknown }).series)) continue;
    for (const entry of (group as { series: unknown[] }).series) {
      if (!entry || typeof entry !== "object") continue;
      const fecha = (entry as { fecha?: unknown }).fecha;
      const value = (entry as { valorDatoPorPeriodo?: unknown }).valorDatoPorPeriodo;
      if (fecha === acquisitionDate && typeof value === "number" && Number.isFinite(value) && value > 0) {
        matches.push({ fecha, valorDatoPorPeriodo: value });
      }
    }
  }

  if (matches.length !== 1) throw new Error("BCCR no devolvió un valor histórico único para la fecha solicitada.");
  return {
    indicator,
    effectiveDate: matches[0].fecha,
    rawValue: String(matches[0].valorDatoPorPeriodo)
  };
}

export async function fetchBccrObservation(
  token: string,
  indicator: number,
  acquisitionDate: string,
  fetcher: typeof fetch = fetch
): Promise<BccrObservation> {
  if (!token) throw new Error("BCCR no está configurado.");
  const encodedDate = encodeURIComponent(acquisitionDate.replaceAll("-", "/"));
  const response = await fetcher(
    `${BCCR_API_BASE}/indicadoresEconomicos/${indicator}/series?fechainicio=${encodedDate}&fechaFin=${encodedDate}&idioma=ES`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    }
  );
  if (!response.ok) throw new Error(`BCCR rechazó la consulta histórica (${response.status}).`);
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new Error("BCCR devolvió una respuesta que no es JSON."); }
  return parseBccrObservation(payload, indicator, acquisitionDate);
}

export async function resolveBccrObservations(
  token: string,
  currency: HistoricalFxCurrency,
  acquisitionDate: string,
  fetcher: typeof fetch = fetch
) {
  const usdCrc = fetchBccrObservation(token, BCCR_USD_CRC_INDICATOR, acquisitionDate, fetcher);
  if (currency !== "EUR") return { usdCrc: await usdCrc, eurUsd: null };
  const [resolvedUsdCrc, eurUsd] = await Promise.all([
    usdCrc,
    fetchBccrObservation(token, BCCR_EUR_USD_INDICATOR, acquisitionDate, fetcher)
  ]);
  return { usdCrc: resolvedUsdCrc, eurUsd };
}

export function isHistoricalFxCurrency(value: unknown): value is HistoricalFxCurrency {
  return value === "CRC" || value === "USD" || value === "EUR";
}

export function isIsoAcquisitionDate(value: unknown): value is string {
  return typeof value === "string" && validIsoDate(value);
}
