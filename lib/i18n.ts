export const appLanguages = ["es", "en"] as const;
export type AppLanguage = typeof appLanguages[number];
export const defaultLanguage: AppLanguage = "es";

export function resolveLanguage(value: unknown): AppLanguage {
  return value === "en" || value === "es" ? value : defaultLanguage;
}

export function languageLocale(language: AppLanguage) {
  return language === "en" ? "en" : "es-CR";
}

const spanish = {
  back: "Volver", projects: "Proyectos", equipment: "Equipo", edit: "Editar",
  printers: "Mis impresoras", editPrinter: "Editar impresora", newPrinter: "Nueva impresora",
  addPrinter: "Agregar impresora", savePrinter: "Guardar impresora", savingPrinter: "Guardando impresora…",
  formHelp: "Registrá tu equipo. La potencia y el costo por hora son opcionales: podés completarlos después.",
  name: "Nombre", namePlaceholder: "Ej. P1S principal", brand: "Marca", brandPlaceholder: "Ej. Bambu Lab",
  model: "Modelo", modelPlaceholder: "Ej. P1S", nozzle: "Boquilla (mm)", location: "Ubicación",
  locationPlaceholder: "Taller, oficina…", power: "Potencia promedio (W)", optional: "Opcional",
  powerHelp: "Consumo eléctrico medio mientras imprime, en watts; no la potencia máxima de la etiqueta. Podés medirlo con un medidor de consumo.",
  powerMissing: "Vacío: usa la potencia de Perfil; actualmente no está configurada.",
  powerInherited: "Vacío: usa {watts} W de Perfil.", kwhHelp: "El precio por kWh se configura en Perfil.",
  machineRate: "Costo de máquina por hora", useProfileRate: "Usar tarifa de Perfil",
  rateHelp: "Desgaste y mantenimiento por hora de uso. No incluyás filamento, electricidad ni mano de obra. Vacío: usa {amount} / h de Perfil. Escribí 0 solo si querés excluir este costo.",
  rateCurrency: "Moneda de la tarifa",
  currencyHelp: "Moneda del costo por hora que escribís para esta impresora. Para usar una tarifa propia al registrar una impresión, debe coincidir con la moneda de costos de Perfil: {currency}. No hacemos conversiones automáticas.",
  currencyCRC: "CRC — Colón costarricense", currencyUSD: "USD — Dólar estadounidense", currencyEUR: "EUR — Euro",
  notes: "Notas", notesPlaceholder: "Mantenimiento, perfil recomendado, observaciones…",
  available: "Disponible para nuevas impresiones", guideTitle: "¿Cómo defino el costo de máquina?",
  guideMethod: "Una forma de estimarlo es dividir el costo del equipo que querés recuperar entre las horas de uso previstas y sumar una reserva de mantenimiento por hora.",
  guideExample: "Ejemplo ilustrativo: {equipment} ÷ {hours} horas = {hourly} por hora, antes de mantenimiento. No es una tarifa recomendada para tu modelo ni se aplica automáticamente.",
  guideSeparation: "La electricidad se calcula aparte con los watts, el precio por kWh y la duración de la impresión. La mano de obra usa el tiempo de trabajo y la tarifa de Perfil. Así evitás contar un mismo gasto dos veces.",
  listHelp: "Elegí la máquina real al registrar cada impresión. Las corridas anteriores no cambian.",
  noTechnicalDetails: "Sin detalles técnicos", noLocation: "Sin ubicación", profileRate: "Tarifa de Perfil", profilePower: "Potencia de Perfil",
  averageWatts: "{watts} W promedio", hourlyAmount: "{amount} / h", active: "Activa", inactive: "Inactiva",
  firstPrinter: "Registrá tu primera impresora", firstPrinterHelp: "Así cada impresión usa su potencia y costo de máquina reales."
} as const;

export type MessageKey = keyof typeof spanish;

const english: Record<MessageKey, string> = {
  back: "Back", projects: "Projects", equipment: "Equipment", edit: "Edit",
  printers: "My printers", editPrinter: "Edit printer", newPrinter: "New printer",
  addPrinter: "Add printer", savePrinter: "Save printer", savingPrinter: "Saving printer…",
  formHelp: "Add your equipment. Average power and hourly machine cost are optional; you can fill them in later.",
  name: "Name", namePlaceholder: "e.g. Main P1S", brand: "Brand", brandPlaceholder: "e.g. Bambu Lab",
  model: "Model", modelPlaceholder: "e.g. P1S", nozzle: "Nozzle (mm)", location: "Location",
  locationPlaceholder: "Workshop, office…", power: "Average power (W)", optional: "Optional",
  powerHelp: "Average electrical power while printing, in watts; not the maximum power on the label. You can measure it with an energy meter.",
  powerMissing: "If left blank, this uses the power setting in Profile, which is not currently configured.",
  powerInherited: "If left blank, this uses {watts} W from Profile.", kwhHelp: "Set the price per kWh in Profile.",
  machineRate: "Hourly machine cost", useProfileRate: "Use Profile rate",
  rateHelp: "Wear and maintenance per hour of use. Keep filament, electricity and labor separate. If left blank, this uses {amount} / h from Profile. Enter 0 only if you want to exclude this machine cost.",
  rateCurrency: "Rate currency",
  currencyHelp: "Currency of the hourly cost you enter for this printer. To use a printer-specific rate when recording a print, it must match the production cost currency in Profile: {currency}. We do not convert amounts automatically.",
  currencyCRC: "CRC — Costa Rican colón", currencyUSD: "USD — US dollar", currencyEUR: "EUR — Euro",
  notes: "Notes", notesPlaceholder: "Maintenance, recommended profile, observations…",
  available: "Available for new prints", guideTitle: "How do I work out the machine cost?",
  guideMethod: "One way to estimate it is to divide the equipment cost you want to recover by its expected hours of use, then add an hourly maintenance allowance.",
  guideExample: "Illustrative example: {equipment} ÷ {hours} hours = {hourly} per hour, before maintenance. This is not a recommended rate for your model and is not applied automatically.",
  guideSeparation: "Electricity is calculated separately using power in watts, the price per kWh and print duration. Labor uses your working time and the hourly rate in Profile. This avoids counting the same expense twice.",
  listHelp: "Choose the actual printer when recording each print. Previous print runs stay unchanged.",
  noTechnicalDetails: "No technical details", noLocation: "No location", profileRate: "Profile rate", profilePower: "Profile power",
  averageWatts: "{watts} W average", hourlyAmount: "{amount} / h", active: "Active", inactive: "Inactive",
  firstPrinter: "Add your first printer", firstPrinterHelp: "This lets each print use its printer's power and machine cost."
};

export const messages: Readonly<Record<AppLanguage, Readonly<Record<MessageKey, string>>>> = {
  es: spanish, en: english
};

// Plain text only: values are interpolated once, never evaluated as HTML or translated as user data.
export function translate(language: AppLanguage, key: MessageKey, values: Readonly<Record<string, string | number>> = {}) {
  const template = messages[language]?.[key];
  if (!template) throw new Error(`Missing translation: ${language}.${key}`);
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    if (!Object.hasOwn(values, name)) throw new Error(`Missing translation parameter: ${key}.${name}`);
    return String(values[name]);
  });
}

export function formatNumber(value: number, language: AppLanguage, options: Intl.NumberFormatOptions = {}) {
  if (!Number.isFinite(value)) throw new RangeError("A finite number is required");
  return new Intl.NumberFormat(languageLocale(language), options).format(value);
}

function assertCurrency(currency: string) {
  if (!/^[A-Z]{3}$/.test(currency)) throw new RangeError("An uppercase ISO currency code is required");
}

// Presentation only. Language never selects a currency or an exchange rate.
export function formatMoney(value: number, currency: string, language: AppLanguage) {
  assertCurrency(currency);
  return formatNumber(value, language, { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: 2 });
}

export function currencyLabel(currency: string, language: AppLanguage) {
  assertCurrency(currency);
  const key = { CRC: "currencyCRC", USD: "currencyUSD", EUR: "currencyEUR" }[currency] as MessageKey | undefined;
  return key ? translate(language, key) : currency;
}

// The caller must also show its saved date, source and estimated/confirmed status.
export function formatExchangeRate(rate: number, from: string, to: string, language: AppLanguage) {
  assertCurrency(from); assertCurrency(to);
  if (!Number.isFinite(rate) || rate <= 0) throw new RangeError("A positive finite exchange rate is required");
  return `1 ${from} = ${formatNumber(rate, language, { maximumSignificantDigits: 12 })} ${to}`;
}
