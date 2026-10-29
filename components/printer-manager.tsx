"use client";

import { useId, useState } from "react";
import { ChevronLeft, Edit3, Plus, Printer, Save } from "lucide-react";
import type { PrinterProfile, UserProfile } from "@/lib/types";
import styles from "./printer-manager.module.css";

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
  const helpId = useId();
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
        <p className="form-help">Registrá tu equipo. La potencia y el costo por hora son opcionales: podés completarlos después.</p>
        <div className="form-grid printer-form-grid">
          <label>Nombre<input required maxLength={120} value={values.name} disabled={isSaving} placeholder="Ej. P1S principal" onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
          <label>Marca<input maxLength={120} value={values.manufacturer} disabled={isSaving} placeholder="Ej. Bambu Lab" onChange={(event) => setValues({ ...values, manufacturer: event.target.value })} /></label>
          <label>Modelo<input maxLength={120} value={values.model} disabled={isSaving} placeholder="Ej. P1S" onChange={(event) => setValues({ ...values, model: event.target.value })} /></label>
          <label>Boquilla (mm)<input type="number" min="0.05" max="10" step="0.01" value={values.nozzle_diameter_mm} disabled={isSaving} placeholder="0.4" onChange={(event) => setValues({ ...values, nozzle_diameter_mm: event.target.value })} /></label>
          <label>Ubicación<input maxLength={160} value={values.location} disabled={isSaving} placeholder="Taller, oficina…" onChange={(event) => setValues({ ...values, location: event.target.value })} /></label>
          <div><label>Potencia promedio (W)<input type="number" min="0.01" max="100000" step="0.01" value={values.average_power_w} disabled={isSaving} aria-describedby={`${helpId}-power`} placeholder="Opcional" onChange={(event) => setValues({ ...values, average_power_w: event.target.value })} /></label>
            <p className={styles.help} id={`${helpId}-power`}>Consumo eléctrico medio mientras imprime, en watts; no la potencia máxima de la etiqueta. Podés medirlo con un medidor de consumo. {profile.printer_average_power_w == null ? "Vacío: usa la potencia de Perfil; actualmente no está configurada." : `Vacío: usa ${profile.printer_average_power_w} W de Perfil.`} El precio por kWh se configura en Perfil.</p>
          </div>
          <div><label>Costo de máquina por hora<input type="number" min="0" max="1000000000" step="0.0001" value={values.machine_cost_per_hour} disabled={isSaving} aria-describedby={`${helpId}-rate`} placeholder="Usar tarifa de Perfil" onChange={(event) => setValues({ ...values, machine_cost_per_hour: event.target.value })} /></label>
            <p className={styles.help} id={`${helpId}-rate`}>Desgaste y mantenimiento por hora de uso. No incluyás filamento, electricidad ni mano de obra. Vacío: usa {money(profile.production_cost_currency, profile.machine_cost_per_hour)} / h de Perfil ({profile.production_cost_currency}). Escribí 0 solo si querés excluir este costo.</p>
          </div>
          <div><label>Moneda de la tarifa<select value={values.machine_cost_currency} disabled={isSaving} aria-describedby={`${helpId}-currency`} onChange={(event) => setValues({ ...values, machine_cost_currency: event.target.value })}><option value="CRC">CRC — colones</option><option value="USD">USD — dólares</option><option value="EUR">EUR — euros</option></select></label>
            <p className={styles.help} id={`${helpId}-currency`}>Moneda del costo por hora que escribís para esta impresora. Para usar una tarifa propia al registrar una impresión, debe coincidir con la moneda de costos de Perfil: {profile.production_cost_currency}. No hacemos conversiones automáticas.</p>
          </div>
          <label className="wide">Notas<textarea maxLength={1000} value={values.notes} disabled={isSaving} placeholder="Mantenimiento, perfil recomendado, observaciones…" onChange={(event) => setValues({ ...values, notes: event.target.value })} /></label>
          <label className="wide checkbox-field"><input type="checkbox" checked={values.is_active} disabled={isSaving} onChange={(event) => setValues({ ...values, is_active: event.target.checked })} /><span>Disponible para nuevas impresiones</span></label>
        </div>
        <details className={styles.guide}>
          <summary tabIndex={0}>¿Cómo defino el costo de máquina?</summary>
          <div>
            <p>Una forma de estimarlo es dividir el costo del equipo que querés recuperar entre las horas de uso previstas y sumar una reserva de mantenimiento por hora.</p>
            <p>Ejemplo ilustrativo: ₡300.000 ÷ 3.000 horas = ₡100 por hora, antes de mantenimiento. No es una tarifa recomendada para tu modelo ni se aplica automáticamente.</p>
            <p>La electricidad se calcula aparte con los watts, el precio por kWh y la duración de la impresión. La mano de obra usa el tiempo de trabajo y la tarifa de Perfil. Así evitás contar un mismo gasto dos veces.</p>
          </div>
        </details>
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
