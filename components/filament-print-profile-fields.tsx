"use client";

import { useId, useState, type ChangeEvent } from "react";
import type { FilamentRoll, PrinterProfile } from "../lib/types";
import { printProfileNumericFields, validatePrintProfileName, validatePrintProfileNumber } from "../lib/filament-print-profile-fields";

// Form controls only. The parent form/save/edit lifecycle must be integrated
// once the shared persisted-profile contract is available. No local persistence.
export function FilamentPrintProfileFields({ roll, printers, disabled = false }: {
  roll: FilamentRoll;
  printers: readonly PrinterProfile[];
  disabled?: boolean;
}) {
  const id = useId();
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const activePrinters = printers.filter(printer => printer.is_active);
  const helpId = `${id}-help`;

  function validate(event: ChangeEvent<HTMLInputElement>, positive?: boolean) {
    const input = event.currentTarget;
    const error = positive === undefined
      ? validatePrintProfileName(input.value)
      : validatePrintProfileNumber(input.value, positive).error;
    input.setCustomValidity(error ?? "");
    setErrors(current => ({ ...current, [input.name]: error }));
  }

  return <fieldset disabled={disabled} aria-describedby={helpId}>
    <legend>Configuración de impresión</legend>
    <p>{roll.brand} · {roll.material}{roll.product_line ? ` · ${roll.product_line}` : ""} · {roll.color_name}</p>
    <p id={helpId}>Anotá los valores que verificaste para este filamento y esta impresora. Vacío significa «sin registrar», no cero. Estos campos no envían ajustes a la impresora ni sustituyen los límites del fabricante.</p>
    <div className="form-grid">
      <label htmlFor={`${id}-name`}>Nombre del perfil
        <input id={`${id}-name`} name="profile_name" required maxLength={120}
          onChange={event => validate(event)} onBlur={event => validate(event)}
          aria-invalid={!!errors.profile_name} aria-describedby={errors.profile_name ? `${id}-name-error` : undefined} />
        {errors.profile_name && <small id={`${id}-name-error`} role="status">{errors.profile_name}</small>}
      </label>
      <label htmlFor={`${id}-printer`}>Impresora
        <select id={`${id}-printer`} name="printer_id" required defaultValue="">
          <option value="">Elegí una impresora</option>
          {activePrinters.map(printer => <option key={printer.id} value={printer.id}>
            {printer.name}{printer.model ? ` · ${printer.model}` : ""}
          </option>)}
        </select>
        {!activePrinters.length && <small>No hay impresoras activas. Administralas desde Perfil → Mis impresoras.</small>}
      </label>
      <label htmlFor={`${id}-slicer`}>Laminador y versión
        <input id={`${id}-slicer`} name="slicer" maxLength={120} />
      </label>
      {printProfileNumericFields.map(field => <label key={field.name} htmlFor={`${id}-${field.name}`}>
        {field.label}
        <input id={`${id}-${field.name}`} name={field.name} type="text" inputMode="decimal" autoComplete="off"
          aria-invalid={!!errors[field.name]} aria-describedby={errors[field.name] ? `${id}-${field.name}-error` : undefined}
          onChange={event => validate(event, field.positive)} onBlur={event => validate(event, field.positive)} />
        {errors[field.name] && <small id={`${id}-${field.name}-error`} role="status">{errors[field.name]}</small>}
      </label>)}
      <label className="wide" htmlFor={`${id}-notes`}>Notas y resultado de las pruebas
        <textarea id={`${id}-notes`} name="profile_notes" maxLength={2000} />
      </label>
    </div>
  </fieldset>;
}
