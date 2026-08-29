"use client";

import { useState } from "react";
import { History, Save, X } from "lucide-react";
import type { PackageType, PurchaseRecord } from "@/lib/types";

export type PurchaseCorrectionValues = {
  supplier_name: string;
  purchased_at: string;
  package_type: PackageType;
  total_price: number;
  spool_cost: number;
  currency: string;
  reason: string;
};

type PurchaseCorrectionModalProps = {
  originalPurchase: PurchaseRecord;
  effectivePurchase: PurchaseRecord;
  correctionCount: number;
  supplierOptions: string[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: PurchaseCorrectionValues) => Promise<void>;
};

function formatMoney(currency: string, value: number) {
  return `${currency} ${Number(value).toLocaleString("es-CR")}`;
}

export function PurchaseCorrectionModal({
  originalPurchase,
  effectivePurchase,
  correctionCount,
  supplierOptions,
  isSaving,
  onClose,
  onSave
}: PurchaseCorrectionModalProps) {
  const [draft, setDraft] = useState<PurchaseCorrectionValues>(() => ({
    supplier_name: effectivePurchase.supplier_name,
    purchased_at: effectivePurchase.purchased_at,
    package_type: effectivePurchase.package_type,
    total_price: Number(effectivePurchase.total_price),
    spool_cost: Number(effectivePurchase.spool_cost),
    currency: effectivePurchase.currency,
    reason: ""
  }));

  const filamentCost = Math.max(0, Number(draft.total_price || 0) - Number(draft.spool_cost || 0));
  const knownSuppliers = Array.from(new Set([
    ...supplierOptions,
    originalPurchase.supplier_name,
    effectivePurchase.supplier_name
  ].filter(Boolean)));

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section
        className="panel modal-panel purchase-correction-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="correct-purchase-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Histórico protegido</p>
            <h2 id="correct-purchase-title">Corregir compra</h2>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cerrar corrección"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="correction-product">
          <span className="mini-swatch" style={{ backgroundColor: originalPurchase.color_hex }} />
          <div>
            <strong>{originalPurchase.brand} · {originalPurchase.product_line} · {originalPurchase.color_name}</strong>
            <span>{originalPurchase.material} · {Number(originalPurchase.quantity_g).toLocaleString("es-CR")} g</span>
          </div>
        </div>

        <div className="correction-audit">
          <History size={18} aria-hidden="true" />
          <div>
            <strong>El registro original no se reemplaza</strong>
            <span>
              Original: {originalPurchase.supplier_name} · {originalPurchase.purchased_at} · {formatMoney(originalPurchase.currency, originalPurchase.total_price)}
            </span>
            {correctionCount > 0 && <small>{correctionCount} corrección{correctionCount === 1 ? "" : "es"} previa{correctionCount === 1 ? "" : "s"}.</small>}
          </div>
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
            Proveedor
            <input
              required
              list="purchase-supplier-options"
              value={draft.supplier_name}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, supplier_name: event.target.value })}
            />
            <datalist id="purchase-supplier-options">
              {knownSuppliers.map((supplier) => <option key={supplier} value={supplier} />)}
            </datalist>
          </label>

          <label>
            Fecha de compra
            <input
              required
              type="date"
              value={draft.purchased_at}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, purchased_at: event.target.value })}
            />
          </label>

          <label>
            Presentación
            <select
              value={draft.package_type}
              disabled={isSaving}
              onChange={(event) => {
                const packageType = event.target.value as PackageType;
                setDraft({
                  ...draft,
                  package_type: packageType,
                  spool_cost: packageType === "refill" ? 0 : (draft.spool_cost || 1000)
                });
              }}
            >
              <option value="spooled">Con spool</option>
              <option value="refill">Refill / sin spool</option>
            </select>
          </label>

          <label>
            Moneda
            <select
              value={draft.currency}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
            >
              <option value="CRC">CRC · colones</option>
              <option value="USD">USD · dólares</option>
            </select>
          </label>

          <label>
            Precio total
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={draft.total_price}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, total_price: Number(event.target.value) })}
            />
          </label>

          <label>
            Costo del spool
            <input
              required
              type="number"
              min="0"
              max={draft.total_price}
              step="0.01"
              value={draft.spool_cost}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, spool_cost: Number(event.target.value) })}
            />
          </label>

          <div className="correction-cost-summary wide">
            <span>Costo de filamento que quedará vigente</span>
            <strong>{formatMoney(draft.currency, filamentCost)}</strong>
          </div>

          <label className="wide">
            Motivo de la corrección
            <textarea
              required
              minLength={3}
              maxLength={500}
              value={draft.reason}
              disabled={isSaving}
              placeholder="Ej.: El precio digitado incluía ₡1.000 del spool."
              onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
            />
            <small className="field-hint">Quedará guardado en la auditoría de esta compra.</small>
          </label>

          <button className="primary-action wide" type="submit" disabled={isSaving || draft.spool_cost > draft.total_price}>
            <Save size={18} aria-hidden="true" />
            {isSaving ? "Guardando sin duplicar…" : "Guardar corrección"}
          </button>
        </form>
      </section>
    </div>
  );
}
