// Presentation metadata and single-field validation, not a persisted profile DTO.
// Values are intentionally blank by default; these are not printer recommendations.
export const printProfileNumericFields = [
  { name: "nozzle_diameter_mm", label: "Diámetro de boquilla (mm)", positive: true },
  { name: "nozzle_temperature_c", label: "Temperatura de boquilla (°C)", positive: false },
  { name: "bed_temperature_c", label: "Temperatura de cama (°C)", positive: false },
  { name: "flow_ratio", label: "Multiplicador de flujo (ratio, no porcentaje)", positive: true }
] as const;

export function validatePrintProfileNumber(raw: string, positive: boolean) {
  const text = raw.trim();
  if (!text) return { value: null, error: null };
  // Both decimal separators are accepted, never thousands separators or units.
  if (!/^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) {
    return { value: null, error: "Usá un número decimal, sin unidades ni separadores de miles." };
  }
  const value = Number(text.replace(",", "."));
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    return { value: null, error: "El número excede la precisión admitida." };
  }
  if (value < 0 || (positive && value === 0)) {
    return { value: null, error: positive ? "El valor debe ser mayor que cero." : "El valor no puede ser negativo." };
  }
  return { value: Object.is(value, -0) ? 0 : value, error: null };
}

export function validatePrintProfileName(raw: string) {
  const value = raw.trim();
  if (!value) return "Escribí un nombre para reconocer esta configuración.";
  if (value.length > 120) return "Usá un nombre de hasta 120 caracteres.";
  return null;
}
