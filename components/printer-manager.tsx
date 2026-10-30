"use client";

import { useId, useState } from "react";
import { ChevronLeft, Edit3, Plus, Printer, Save } from "lucide-react";
import type { PrinterProfile, UserProfile } from "@/lib/types";
import styles from "./printer-manager.module.css";
import { currencyLabel, defaultLanguage, formatMoney, formatNumber, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";

export type PrinterValues = {
  printer_id: string | null;
  name: string;
  manufacturer: string;
  model: string;
  nozzle_diameter_mm: string;
  location: string;
  average_power_w: string;
  machine_cost_per_hour: string;
  machine_cost_currency: string;
  notes: string;
  is_active: boolean;
};

type Props = {
  printers: PrinterProfile[];
  profile: UserProfile;
  isSaving: boolean;
  onBack: () => void;
  backLabel?: string;
  language?: AppLanguage;
  onSave: (values: PrinterValues) => Promise<boolean>;
};

function emptyValues(currency: string): PrinterValues {
  return {
    printer_id: null,
    name: "",
    manufacturer: "",
    model: "",
    nozzle_diameter_mm: "",
    location: "",
    average_power_w: "",
    machine_cost_per_hour: "",
    machine_cost_currency: currency,
    notes: "",
    is_active: true
  };
}

function editValues(printer: PrinterProfile): PrinterValues {
  return {
    printer_id: printer.id,
    name: printer.name,
    manufacturer: printer.manufacturer ?? "",
    model: printer.model ?? "",
    nozzle_diameter_mm: printer.nozzle_diameter_mm == null ? "" : String(printer.nozzle_diameter_mm),
    location: printer.location ?? "",
    average_power_w: printer.average_power_w == null ? "" : String(printer.average_power_w),
    machine_cost_per_hour: printer.machine_cost_per_hour == null ? "" : String(printer.machine_cost_per_hour),
    machine_cost_currency: printer.machine_cost_currency ?? "CRC",
    notes: printer.notes ?? "",
    is_active: printer.is_active
  };
}

export function PrinterManager({ printers, profile, isSaving, onBack, onSave, backLabel, language = defaultLanguage }: Props) {
  const t = (key: MessageKey, values?: Record<string, string | number>) => translate(language, key, values);
  const money = (currency: string, value: number) => formatMoney(value, currency, language);
  const helpId = useId();
  const [values, setValues] = useState<PrinterValues | null>(null);
  const sortedPrinters = [...printers].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name, language));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values) return;
    const saved = await onSave(values);
    if (saved) setValues(null);
  }

  if (values) {
    return (
      <form lang={language} className="project-form printer-form" onSubmit={submit} aria-busy={isSaving}>
        <div className="project-form-head">
          <button type="button" onClick={() => setValues(null)} disabled={isSaving}><ChevronLeft size={17} />{t("back")}</button>
          <div><p className="eyebrow">{t("equipment")}</p><h3>{t(values.printer_id ? "editPrinter" : "newPrinter")}</h3></div>
        </div>
        <p className="form-help">{t("formHelp")}</p>
        <div className="form-grid printer-form-grid">
          <label>{t("name")}<input required maxLength={120} value={values.name} disabled={isSaving} placeholder={t("namePlaceholder")} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
          <label>{t("brand")}<input maxLength={120} value={values.manufacturer} disabled={isSaving} placeholder={t("brandPlaceholder")} onChange={(event) => setValues({ ...values, manufacturer: event.target.value })} /></label>
          <label>{t("model")}<input maxLength={120} value={values.model} disabled={isSaving} placeholder={t("modelPlaceholder")} onChange={(event) => setValues({ ...values, model: event.target.value })} /></label>
          <label>{t("nozzle")}<input type="number" min="0.05" max="10" step="0.01" value={values.nozzle_diameter_mm} disabled={isSaving} placeholder="0.4" onChange={(event) => setValues({ ...values, nozzle_diameter_mm: event.target.value })} /></label>
          <label>{t("location")}<input maxLength={160} value={values.location} disabled={isSaving} placeholder={t("locationPlaceholder")} onChange={(event) => setValues({ ...values, location: event.target.value })} /></label>
          <div><label>{t("power")}<input type="number" min="0.01" max="100000" step="0.01" value={values.average_power_w} disabled={isSaving} aria-describedby={`${helpId}-power`} placeholder={t("optional")} onChange={(event) => setValues({ ...values, average_power_w: event.target.value })} /></label>
            <p className={styles.help} id={`${helpId}-power`}>{t("powerHelp")} {profile.printer_average_power_w == null ? t("powerMissing") : t("powerInherited", { watts: formatNumber(profile.printer_average_power_w, language) })} {t("kwhHelp")}</p>
          </div>
          <div><label>{t("machineRate")}<input type="number" min="0" max="1000000000" step="0.0001" value={values.machine_cost_per_hour} disabled={isSaving} aria-describedby={`${helpId}-rate`} placeholder={t("useProfileRate")} onChange={(event) => setValues({ ...values, machine_cost_per_hour: event.target.value })} /></label>
            <p className={styles.help} id={`${helpId}-rate`}>{t("rateHelp", { amount: money(profile.production_cost_currency, profile.machine_cost_per_hour) })}</p>
          </div>
          <div><label>{t("rateCurrency")}<select value={values.machine_cost_currency} disabled={isSaving} aria-describedby={`${helpId}-currency`} onChange={(event) => setValues({ ...values, machine_cost_currency: event.target.value })}>{["CRC", "USD", "EUR"].map(currency => <option key={currency} value={currency}>{currencyLabel(currency, language)}</option>)}</select></label>
            <p className={styles.help} id={`${helpId}-currency`}>{t("currencyHelp", { currency: currencyLabel(profile.production_cost_currency, language) })}</p>
          </div>
          <label className="wide">{t("notes")}<textarea maxLength={1000} value={values.notes} disabled={isSaving} placeholder={t("notesPlaceholder")} onChange={(event) => setValues({ ...values, notes: event.target.value })} /></label>
          <label className="wide checkbox-field"><input type="checkbox" checked={values.is_active} disabled={isSaving} onChange={(event) => setValues({ ...values, is_active: event.target.checked })} /><span>{t("available")}</span></label>
        </div>
        <details className={styles.guide}>
          <summary tabIndex={0}>{t("guideTitle")}</summary>
          <div>
            <p>{t("guideMethod")}</p>
            <p>{t("guideExample", { equipment: money("CRC", 300000), hours: formatNumber(3000, language), hourly: money("CRC", 100) })}</p>
            <p>{t("guideSeparation")}</p>
          </div>
        </details>
        <button className="primary-action" type="submit" disabled={isSaving || !values.name.trim()}><Save size={18} />{t(isSaving ? "savingPrinter" : "savePrinter")}</button>
      </form>
    );
  }

  return (
    <section lang={language} className="printer-manager">
      <div className="project-form-head">
        <button type="button" onClick={onBack} disabled={isSaving}><ChevronLeft size={17} />{backLabel ?? t("projects")}</button>
        <div><p className="eyebrow">{t("equipment")}</p><h3>{t("printers")}</h3></div>
      </div>
      <div className="printer-manager-actions"><p>{t("listHelp")}</p><button type="button" onClick={() => setValues(emptyValues(profile.production_cost_currency))}><Plus size={17} />{t("addPrinter")}</button></div>
      <div className="printer-list">
        {sortedPrinters.length ? sortedPrinters.map((printer) => (
          <article className={printer.is_active ? "printer-card" : "printer-card inactive"} key={printer.id}>
            <span className="printer-card-icon"><Printer size={21} /></span>
            <div><strong>{printer.name}</strong><small>{[printer.manufacturer, printer.model, printer.nozzle_diameter_mm == null ? null : `${formatNumber(printer.nozzle_diameter_mm, language)} mm`].filter(Boolean).join(" · ") || t("noTechnicalDetails")}</small><small>{printer.location || t("noLocation")}</small></div>
            <div className="printer-card-cost"><strong>{printer.machine_cost_per_hour == null ? t("profileRate") : t("hourlyAmount", { amount: money(printer.machine_cost_currency ?? profile.production_cost_currency, printer.machine_cost_per_hour) })}</strong><small>{printer.average_power_w == null ? t("profilePower") : t("averageWatts", { watts: formatNumber(printer.average_power_w, language) })}</small><span>{t(printer.is_active ? "active" : "inactive")}</span></div>
            <button type="button" onClick={() => setValues(editValues(printer))}><Edit3 size={16} />{t("edit")}</button>
          </article>
        )) : <div className="project-empty compact"><Printer size={32} /><h3>{t("firstPrinter")}</h3><p>{t("firstPrinterHelp")}</p><button className="primary-action" type="button" onClick={() => setValues(emptyValues(profile.production_cost_currency))}><Plus size={17} />{t("addPrinter")}</button></div>}
      </div>
    </section>
  );
}
