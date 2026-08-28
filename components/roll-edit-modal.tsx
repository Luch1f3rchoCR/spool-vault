"use client";

import { useState } from "react";
import { Save, X } from "lucide-react";
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
  roll,
  brandOptions,
  materialOptions,
  lineOptionsByMaterial,
  colorPresets,
  isSaving,
  onClose,
  onSave
}: RollEditModalProps) {
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
        aria-modal="true"
        aria-labelledby="edit-roll-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Inventario</p>
            <h2 id="edit-roll-title">Editar filamento</h2>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cerrar edición"
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
            Marca
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
            Material
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
            Línea
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
            Color
            <input
              required
              value={draft.color_name}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, color_name: event.target.value })}
            />
          </label>

          <fieldset className="color-helper wide">
            <legend>Color visual y HEX</legend>
            <div className="color-inputs">
              <input
                className="color-picker"
                type="color"
                value={draft.color_hex}
                disabled={isSaving}
                onChange={(event) => setDraft({ ...draft, color_hex: event.target.value })}
                aria-label="Elegir color visualmente"
              />
              <input
                required
                value={draft.color_hex}
                disabled={isSaving}
                pattern="#[0-9A-Fa-f]{6}"
                onChange={(event) => setDraft({ ...draft, color_hex: event.target.value })}
                aria-label="Código hexadecimal del color"
              />
            </div>
            <p>La corrección cambia la ficha y conserva intactos los registros históricos.</p>
            <div className="color-presets" aria-label="Colores rápidos">
              {colorPresets.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={draft.color_hex.toLowerCase() === color.toLowerCase() ? "selected" : ""}
                  style={{ backgroundColor: color }}
                  disabled={isSaving}
                  onClick={() => setDraft({ ...draft, color_hex: color })}
                  aria-label={`Usar color ${color}`}
                  title={color}
                />
              ))}
            </div>
          </fieldset>

          <label>
            Peso inicial
            <input
              required
              type="number"
              min={roll.available_weight_g}
              step="0.01"
              value={draft.initial_weight_g}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, initial_weight_g: Number(event.target.value) })}
            />
            <small className="field-hint">Mínimo actual: {Number(roll.available_weight_g).toLocaleString("es-CR")} g.</small>
          </label>

          <label>
            Bajo desde
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
            Ubicación
            <input
              value={draft.location}
              disabled={isSaving}
              placeholder="AMS Slot 2, SUNLU, Gaveta..."
              onChange={(event) => setDraft({ ...draft, location: event.target.value })}
            />
          </label>

          <label className="wide">
            Secado / observaciones
            <textarea
              value={draft.drying_notes}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, drying_notes: event.target.value })}
            />
          </label>

          <label className="wide">
            Foto URL
            <input
              type="url"
              value={draft.photo_url}
              disabled={isSaving}
              placeholder="https://..."
              onChange={(event) => setDraft({ ...draft, photo_url: event.target.value })}
            />
          </label>

          <label className="wide">
            Link de compra
            <input
              type="url"
              value={draft.purchase_url}
              disabled={isSaving}
              placeholder="Tienda o producto"
              onChange={(event) => setDraft({ ...draft, purchase_url: event.target.value })}
            />
          </label>

          <div className="history-protection wide">
            <strong>Compra protegida</strong>
            <span>
              {roll.supplier_name || "Proveedor no indicado"} · {roll.currency} {Number(roll.price_amount ?? 0).toLocaleString("es-CR")}
            </span>
            <small>Precio, proveedor y presentación permanecen en el histórico. Su corrección se hará como un movimiento trazable.</small>
          </div>

          <button className="primary-action wide" type="submit" disabled={isSaving}>
            <Save size={18} aria-hidden="true" />
            {isSaving ? "Guardando sin duplicar…" : "Guardar cambios"}
          </button>
        </form>
      </section>
    </div>
  );
}
