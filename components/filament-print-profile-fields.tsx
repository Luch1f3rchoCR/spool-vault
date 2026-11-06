"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { defaultLanguage, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";
import type { FilamentPrintProfileValues, FilamentRoll, PrinterProfile } from "../lib/types";
import { printProfileNumericFields, printProfileValidationMessages, type PrintProfileValidationCode, validatePrintProfileName, validatePrintProfileNumber } from "../lib/filament-print-profile-fields";
import styles from "./supplies-modal.module.css";

export function FilamentPrintProfileFields({ roll, printers, initial, disabled = false, language = defaultLanguage }: {
  language?: AppLanguage;
  roll: FilamentRoll;
  printers: readonly PrinterProfile[];
  initial?: FilamentPrintProfileValues;
  disabled?: boolean;
}) {
  const t = (key: MessageKey) => translate(language, key);
  const fields = useRef<HTMLFieldSetElement>(null);
  const id = useId();
  const [errors, setErrors] = useState<Record<string, PrintProfileValidationCode | null>>({});
  const activePrinters = printers.filter(printer => printer.is_active || printer.id === initial?.printer_id);
  const helpId = `${id}-help`;

  useEffect(() => {
    for (const [name, code] of Object.entries(errors)) {
      const input = fields.current?.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      input?.setCustomValidity(code ? translate(language, `printProfile.validation.${code}`) : "");
    }
  }, [errors, language]);

  function validate(event: ChangeEvent<HTMLInputElement>, positive?: boolean) {
    const input = event.currentTarget;
    const error = positive === undefined
      ? validatePrintProfileName(input.value)
      : validatePrintProfileNumber(input.value, positive).error;
    const code = (Object.keys(printProfileValidationMessages) as PrintProfileValidationCode[])
      .find(key => printProfileValidationMessages[key] === error) ?? null;
    input.setCustomValidity(code ? t(`printProfile.validation.${code}`) : "");
    setErrors(current => ({ ...current, [input.name]: code }));
  }

  return <fieldset ref={fields} lang={language} className={styles.fieldset} disabled={disabled} aria-describedby={helpId}>
    <legend>{t("printProfile.configuration")}</legend>
    <p>{roll.brand} · {roll.material}{roll.product_line ? ` · ${roll.product_line}` : ""} · {roll.color_name}</p>
    <p className={styles.help} id={helpId}>{t("printProfile.fieldsHelp")}</p>
    <div className={styles.fields}>
      <label htmlFor={`${id}-name`}>{t("printProfile.name")}
        <input id={`${id}-name`} name="profile_name" required maxLength={120} defaultValue={initial?.name ?? ""}
          onChange={event => validate(event)} onBlur={event => validate(event)}
          aria-invalid={!!errors.profile_name} aria-describedby={errors.profile_name ? `${id}-name-error` : undefined} />
        {errors.profile_name && <small id={`${id}-name-error`} role="status">{t(`printProfile.validation.${errors.profile_name}`)}</small>}
      </label>
      <label htmlFor={`${id}-printer`}>{t("printProfile.printer")}
        <select id={`${id}-printer`} name="printer_id" required defaultValue={initial?.printer_id ?? ""}>
          <option value="">{t("printProfile.choosePrinter")}</option>
          {activePrinters.map(printer => <option key={printer.id} value={printer.id}>
            {printer.name}{printer.model ? ` · ${printer.model}` : ""}{!printer.is_active ? t("printProfile.inactive") : ""}
          </option>)}
        </select>
        {!activePrinters.length && <small>{t("printProfile.noPrinters")}</small>}
      </label>
      <label htmlFor={`${id}-slicer`}>{t("printProfile.slicer")}
        <input id={`${id}-slicer`} name="slicer" maxLength={120} defaultValue={initial?.slicer ?? ""} />
      </label>
      {printProfileNumericFields.map(field => {
        const errorCode = errors[field.name];
        return <label key={field.name} htmlFor={`${id}-${field.name}`}>
          {t(`printProfile.field.${field.name}`)}
          <input id={`${id}-${field.name}`} name={field.name} type="text" inputMode="decimal" autoComplete="off" defaultValue={initial?.[field.name] ?? ""}
            aria-invalid={!!errorCode} aria-describedby={errorCode ? `${id}-${field.name}-error` : undefined}
            onChange={event => validate(event, field.positive)} onBlur={event => validate(event, field.positive)} />
          {errorCode && <small id={`${id}-${field.name}-error`} role="status">{t(`printProfile.validation.${errorCode}`)}</small>}
        </label>;
      })}
      <label className={styles.wide} htmlFor={`${id}-notes`}>{t("printProfile.notes")}
        <textarea id={`${id}-notes`} name="profile_notes" maxLength={2000} defaultValue={initial?.notes ?? ""} />
      </label>
    </div>
  </fieldset>;
}
