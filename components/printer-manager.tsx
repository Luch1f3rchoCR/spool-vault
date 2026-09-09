"use client";

import { useState } from "react";
import { ChevronLeft, Edit3, Plus, Printer, Save } from "lucide-react";
import type { PrinterProfile, UserProfile } from "@/lib/types";

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

function money(currency: string, value: number) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

export function PrinterManager({ printers, profile, isSaving, onBack, onSave, backLabel = "Proyectos" }: Props) {
  const [values, setValues] = useState<PrinterValues | null>(null);
  const sortedPrinters = [...printers].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values) return;
    const saved = await onSave(values);
    if (saved) setValues(null);
  }

  if (values) {
    return (
      <form className="project-form printer-form" onSubmit={submit} aria-busy={isSaving}>
        <div className="project-form-head">
          <button type="button" onClick={() => setValues(null)} disabled={isSaving}><ChevronLeft size={17} />Volver</button>
          <div><p className="eyebrow">Equipo</p><h3>{values.printer_id ? "Editar impresora" : "Nueva impresora"}</h3></div>
        </div>
        <p className="form-help">La moneda corresponde a la tarifa propia; debe coincidir con la moneda de costos de Perfil para usarla en una impresión. No hacemos conversiones automáticas. La potencia y el costo por hora son opcionales. Si los dejás vacíos, Spool Vault usa los valores generales de Perfil.</p>
        <div className="form-grid printer-form-grid">
          <label>Nombre<input required maxLength={120} value={values.name} disabled={isSaving} placeholder="Ej. P1S principal" onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
          <label>Marca<input maxLength={120} value={values.manufacturer} disabled={isSaving} placeholder="Ej. Bambu Lab" onChange={(event) => setValues({ ...values, manufacturer: event.target.value })} /></label>
          <label>Modelo<input maxLength={120} value={values.model} disabled={isSaving} placeholder="Ej. P1S" onChange={(event) => setValues({ ...values, model: event.target.value })} /></label>
          <label>Boquilla (mm)<input type="number" min="0.05" max="10" step="0.01" value={values.nozzle_diameter_mm} disabled={isSaving} placeholder="0.4" onChange={(event) => setValues({ ...values, nozzle_diameter_mm: event.target.value })} /></label>
          <label>Ubicación<input maxLength={160} value={values.location} disabled={isSaving} placeholder="Taller, oficina…" onChange={(event) => setValues({ ...values, location: event.target.value })} /></label>
          <label>Potencia promedio (W)<input type="number" min="0.01" max="100000" step="0.01" value={values.average_power_w} disabled={isSaving} placeholder={profile.printer_average_power_w == null ? "Usar Perfil" : `Perfil: ${profile.printer_average_power_w} W`} onChange={(event) => setValues({ ...values, average_power_w: event.target.value })} /></label>
          <label>Costo de máquina por hora<input type="number" min="0" max="1000000000" step="0.0001" value={values.machine_cost_per_hour} disabled={isSaving} placeholder={`Perfil: ${money(profile.production_cost_currency, profile.machine_cost_per_hour)}`} onChange={(event) => setValues({ ...values, machine_cost_per_hour: event.target.value })} /></label>
          <label>Moneda de la tarifa<select value={values.machine_cost_currency} disabled={isSaving} onChange={(event) => setValues({ ...values, machine_cost_currency: event.target.value })}><option value="CRC">CRC — colones</option><option value="USD">USD — dólares</option><option value="EUR">EUR — euros</option></select></label>
          <label className="wide">Notas<textarea maxLength={1000} value={values.notes} disabled={isSaving} placeholder="Mantenimiento, perfil recomendado, observaciones…" onChange={(event) => setValues({ ...values, notes: event.target.value })} /></label>
          <label className="wide checkbox-field"><input type="checkbox" checked={values.is_active} disabled={isSaving} onChange={(event) => setValues({ ...values, is_active: event.target.checked })} /><span>Disponible para nuevas impresiones</span></label>
        </div>
        <button className="primary-action" type="submit" disabled={isSaving || !values.name.trim()}><Save size={18} />{isSaving ? "Guardando impresora…" : "Guardar impresora"}</button>
      </form>
    );
  }

  return (
    <section className="printer-manager">
      <div className="project-form-head">
        <button type="button" onClick={onBack} disabled={isSaving}><ChevronLeft size={17} />{backLabel}</button>
        <div><p className="eyebrow">Equipo</p><h3>Mis impresoras</h3></div>
      </div>
      <div className="printer-manager-actions"><p>Elegí la máquina real al registrar cada impresión. Las corridas anteriores no cambian.</p><button type="button" onClick={() => setValues(emptyValues(profile.production_cost_currency))}><Plus size={17} />Agregar impresora</button></div>
      <div className="printer-list">
        {sortedPrinters.length ? sortedPrinters.map((printer) => (
          <article className={printer.is_active ? "printer-card" : "printer-card inactive"} key={printer.id}>
            <span className="printer-card-icon"><Printer size={21} /></span>
            <div><strong>{printer.name}</strong><small>{[printer.manufacturer, printer.model, printer.nozzle_diameter_mm == null ? null : `${printer.nozzle_diameter_mm} mm`].filter(Boolean).join(" · ") || "Sin detalles técnicos"}</small><small>{printer.location || "Sin ubicación"}</small></div>
            <div className="printer-card-cost"><strong>{printer.machine_cost_per_hour == null ? "Tarifa de Perfil" : `${money(printer.machine_cost_currency ?? profile.production_cost_currency, printer.machine_cost_per_hour)} / h`}</strong><small>{printer.average_power_w == null ? "Potencia de Perfil" : `${printer.average_power_w} W promedio`}</small><span>{printer.is_active ? "Activa" : "Inactiva"}</span></div>
            <button type="button" onClick={() => setValues(editValues(printer))}><Edit3 size={16} />Editar</button>
          </article>
        )) : <div className="project-empty compact"><Printer size={32} /><h3>Registrá tu primera impresora</h3><p>Así cada impresión usa su potencia y costo de máquina reales.</p><button className="primary-action" type="button" onClick={() => setValues(emptyValues(profile.production_cost_currency))}><Plus size={17} />Agregar impresora</button></div>}
      </div>
    </section>
  );
}
