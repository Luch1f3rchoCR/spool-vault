"use client";

import { useState } from "react";
import { Save, X } from "lucide-react";
import { defaultLanguage, languageLocale, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";
import type { FilamentRoll } from "@/lib/types";

export type EditableRollValues = {
  brand: string;
  product_line: string;
  material: string;
  color_name: string;
  color_hex: string;
  initial_weight_g: number;
  low_threshold_g: number;
  location: string;
  drying_notes: string;
  photo_url: string;
  purchase_url: string;
};

type RollEditModalProps = {
  language?: AppLanguage;
  roll: FilamentRoll;
  brandOptions: string[];
  materialOptions: string[];
  lineOptionsByMaterial: Record<string, string[]>;
  colorPresets: string[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: EditableRollValues) => Promise<void>;
};

function editableValuesFromRoll(roll: FilamentRoll): EditableRollValues {
  return {
    brand: roll.brand,
    product_line: roll.product_line ?? "",
    material: roll.material,
    color_name: roll.color_name,
    color_hex: roll.color_hex,
    initial_weight_g: Number(roll.initial_weight_g),
    low_threshold_g: Number(roll.low_threshold_g),
    location: roll.location ?? "",
    drying_notes: roll.drying_notes ?? "",
    photo_url: roll.photo_url ?? "",
    purchase_url: roll.purchase_url ?? ""
  };
}

export function RollEditModal({
  language = defaultLanguage,
  roll,
  brandOptions,
  materialOptions,
  lineOptionsByMaterial,
  colorPresets,
  isSaving,
  onClose,
  onSave
}: RollEditModalProps) {
  const t = (key: MessageKey, values?: Readonly<Record<string, string | number>>) => translate(language, key, values);
  const locale = languageLocale(language);
  const [draft, setDraft] = useState<EditableRollValues>(() => editableValuesFromRoll(roll));
  const lineOptions = lineOptionsByMaterial[draft.material] ?? [draft.product_line || "Genérico"];

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section
        className="panel modal-panel roll-edit-modal"
        role="dialog"
        lang={language}
        aria-modal="true"
        aria-labelledby="edit-roll-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">{t("nav.inventory")}</p>
            <h2 id="edit-roll-title">{t("rollEdit.title")}</h2>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label={t("rollEdit.close")}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form
          className="form-grid"
          aria-busy={isSaving}
          onSubmit={(event) => {
            event.preventDefault();
            void onSave(draft);
          }}
        >
          <label>
            {t("brand")}
            <select
              value={draft.brand}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, brand: event.target.value })}
            >
              {!brandOptions.includes(draft.brand) && <option>{draft.brand}</option>}
              {brandOptions.map((brand) => <option key={brand}>{brand}</option>)}
            </select>
          </label>

          <label>
            {t("rollEdit.material")}
            <select
              value={draft.material}
              disabled={isSaving}
              onChange={(event) => {
                const material = event.target.value;
                setDraft({
                  ...draft,
                  material,
                  product_line: lineOptionsByMaterial[material]?.[0] ?? "Genérico"
                });
              }}
            >
              {!materialOptions.includes(draft.material) && <option>{draft.material}</option>}
              {materialOptions.map((material) => <option key={material}>{material}</option>)}
            </select>
          </label>

          <label>
            {t("rollEdit.line")}
            <select
              value={draft.product_line}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, product_line: event.target.value })}
            >
              {draft.product_line && !lineOptions.includes(draft.product_line) && (
                <option>{draft.product_line}</option>
              )}
              {lineOptions.map((line) => <option key={line}>{line}</option>)}
            </select>
          </label>

          <label>
            {t("rollEdit.color")}
            <input
              required
              value={draft.color_name}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, color_name: event.target.value })}
            />
          </label>

          <fieldset className="color-helper wide">
            <legend>{t("rollEdit.visualColor")}</legend>
            <div className="color-inputs">
              <input
                className="color-picker"
                type="color"
                value={draft.color_hex}
                disabled={isSaving}
                onChange={(event) => setDraft({ ...draft, color_hex: event.target.value })}
                aria-label={t("rollEdit.pickColor")}
              />
              <input
                required
                value={draft.color_hex}
                disabled={isSaving}
                pattern="#[0-9A-Fa-f]{6}"
                onChange={(event) => setDraft({ ...draft, color_hex: event.target.value })}
                aria-label={t("rollEdit.hexCode")}
              />
            </div>
            <p>{t("rollEdit.historyHelp")}</p>
            <div className="color-presets" aria-label={t("rollEdit.presets")}>
              {colorPresets.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={draft.color_hex.toLowerCase() === color.toLowerCase() ? "selected" : ""}
                  style={{ backgroundColor: color }}
                  disabled={isSaving}
                  onClick={() => setDraft({ ...draft, color_hex: color })}
                  aria-label={t("rollEdit.useColor", { color })}
                  title={color}
                />
              ))}
            </div>
          </fieldset>

          <label>
            {t("rollEdit.initialWeight")}
            <input
              required
              type="number"
              min={roll.available_weight_g}
              step="0.01"
              value={draft.initial_weight_g}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, initial_weight_g: Number(event.target.value) })}
            />
            <small className="field-hint">{t("rollEdit.minimumWeight", { weight: Number(roll.available_weight_g).toLocaleString(locale) })}</small>
          </label>

          <label>
            {t("rollEdit.lowThreshold")}
            <input
              required
              type="number"
              min="0"
              max={draft.initial_weight_g}
              step="0.01"
              value={draft.low_threshold_g}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, low_threshold_g: Number(event.target.value) })}
            />
          </label>

          <label className="wide">
            {t("location")}
            <input
              value={draft.location}
              disabled={isSaving}
              placeholder={t("rollEdit.locationExample")}
              onChange={(event) => setDraft({ ...draft, location: event.target.value })}
            />
          </label>

          <label className="wide">
            {t("rollEdit.notes")}
            <textarea
              value={draft.drying_notes}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, drying_notes: event.target.value })}
            />
          </label>

          <label className="wide">
            {t("rollEdit.photo")}
            <input
              type="url"
              value={draft.photo_url}
              disabled={isSaving}
              placeholder="https://..."
              onChange={(event) => setDraft({ ...draft, photo_url: event.target.value })}
            />
          </label>

          <label className="wide">
            {t("rollEdit.purchaseUrl")}
            <input
              type="url"
              value={draft.purchase_url}
              disabled={isSaving}
              placeholder={t("rollEdit.purchaseExample")}
              onChange={(event) => setDraft({ ...draft, purchase_url: event.target.value })}
            />
          </label>

          <div className="history-protection wide">
            <strong>{t("rollEdit.protectedPurchase")}</strong>
            <span>
              {roll.supplier_name || t("rollEdit.noSupplier")} · {roll.currency} {Number(roll.price_amount ?? 0).toLocaleString(locale)}
            </span>
            <small>{t("rollEdit.purchaseHistoryHelp")}</small>
          </div>

          <button className="primary-action wide" type="submit" disabled={isSaving}>
            <Save size={18} aria-hidden="true" />
            {isSaving ? t("rollEdit.saving") : t("rollEdit.save")}
          </button>
        </form>
      </section>
    </div>
  );
}
