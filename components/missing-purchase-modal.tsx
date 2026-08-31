"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ReceiptText, Save, X } from "lucide-react";
import type { FilamentRoll, PackageType } from "@/lib/types";

export type MissingPurchaseValues = {
  supplier_name: string;
  purchased_at: string;
  package_type: PackageType;
  total_price: number;
  spool_cost: number;
  currency: string;
};

type MissingPurchaseModalProps = {
  roll: FilamentRoll;
  supplierOptions: string[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: MissingPurchaseValues) => Promise<void>;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(currency: string, value: number) {
  return `${currency} ${Number(value).toLocaleString("es-CR")}`;
}

export function MissingPurchaseModal({
  roll,
  supplierOptions,
  isSaving,
  onClose,
  onSave
}: MissingPurchaseModalProps) {
  const [supplierName, setSupplierName] = useState(roll.supplier_name?.trim() || "");
  const [purchasedAt, setPurchasedAt] = useState(roll.purchase_date || todayIso());
  const [packageType, setPackageType] = useState<PackageType>(roll.package_type);
  const [totalPrice, setTotalPrice] = useState(roll.price_amount == null ? "" : String(roll.price_amount));
  const [spoolCost, setSpoolCost] = useState(
    String(roll.package_type === "refill" ? 0 : (Number(roll.spool_cost_amount) || 1000))
  );
  const [currency, setCurrency] = useState(roll.currency || "CRC");

  const parsedTotal = totalPrice === "" ? null : Number(totalPrice);
  const parsedSpool = spoolCost === "" ? null : Number(spoolCost);
  const filamentCost = parsedTotal == null || parsedSpool == null
    ? null
    : Math.max(0, parsedTotal - parsedSpool);
  const isValid = Boolean(
    supplierName.trim()
    && purchasedAt
    && parsedTotal != null
    && Number.isFinite(parsedTotal)
    && parsedTotal >= 0
    && parsedSpool != null
    && Number.isFinite(parsedSpool)
    && parsedSpool >= 0
    && parsedSpool <= parsedTotal
  );
  const knownSuppliers = useMemo(
    () => Array.from(new Set([...supplierOptions, roll.supplier_name || ""].filter(Boolean))),
    [roll.supplier_name, supplierOptions]
  );

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
        aria-labelledby="missing-purchase-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Costo incompleto</p>
            <h2 id="missing-purchase-title">Registrar compra faltante</h2>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cerrar compra faltante"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="correction-product">
          <span className="mini-swatch" style={{ backgroundColor: roll.color_hex }} />
          <div>
            <strong>{roll.brand} · {roll.product_line || "Sin línea"} · {roll.color_name}</strong>
            <span>{roll.material} · {Number(roll.initial_weight_g).toLocaleString("es-CR")} g iniciales</span>
          </div>
        </div>

        <div className="correction-audit missing-purchase-note">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Este rollo no tiene una compra en su historial</strong>
            <span>Guardaremos el registro original que faltó y actualizaremos el costo vigente juntos, sin crear duplicados.</span>
          </div>
        </div>

        <form
          className="form-grid"
          aria-busy={isSaving}
          onSubmit={(event) => {
            event.preventDefault();
            if (!isValid || parsedTotal == null || parsedSpool == null) return;
            void onSave({
              supplier_name: supplierName.trim(),
              purchased_at: purchasedAt,
              package_type: packageType,
              total_price: parsedTotal,
              spool_cost: parsedSpool,
              currency
            });
          }}
        >
          <label>
            Proveedor
            <input
              required
              list="missing-purchase-supplier-options"
              value={supplierName}
              disabled={isSaving}
              onChange={(event) => setSupplierName(event.target.value)}
            />
            <datalist id="missing-purchase-supplier-options">
              {knownSuppliers.map((supplier) => <option key={supplier} value={supplier} />)}
            </datalist>
          </label>

          <label>
            Fecha de compra
            <input
              required
              type="date"
              value={purchasedAt}
              disabled={isSaving}
              onChange={(event) => setPurchasedAt(event.target.value)}
            />
          </label>

          <label>
            Presentación
            <select
              value={packageType}
              disabled={isSaving}
              onChange={(event) => {
                const nextPackage = event.target.value as PackageType;
                setPackageType(nextPackage);
                setSpoolCost(nextPackage === "refill" ? "0" : (Number(spoolCost) > 0 ? spoolCost : "1000"));
              }}
            >
              <option value="spooled">Con spool</option>
              <option value="refill">Refill / sin spool</option>
            </select>
          </label>

          <label>
            Moneda
            <select value={currency} disabled={isSaving} onChange={(event) => setCurrency(event.target.value)}>
              <option value="CRC">CRC · colones</option>
              <option value="USD">USD · dólares</option>
            </select>
          </label>

          <label>
            Precio total pagado
            <input
              required
              autoFocus
              type="number"
              min="0"
              step="0.01"
              placeholder="Ej. 11500"
              value={totalPrice}
              disabled={isSaving}
              onChange={(event) => setTotalPrice(event.target.value)}
            />
          </label>

          <label>
            Costo del spool
            <input
              required
              type="number"
              min="0"
              max={parsedTotal ?? undefined}
              step="0.01"
              value={spoolCost}
              disabled={isSaving || packageType === "refill"}
              onChange={(event) => setSpoolCost(event.target.value)}
            />
          </label>

          <div className="correction-cost-summary wide">
            <span>Costo consumible del filamento</span>
            <strong>{filamentCost == null ? "—" : formatMoney(currency, filamentCost)}</strong>
          </div>

          <p className="form-help wide">
            Si el dato existente era incorrecto y ya hay una compra, usá “Corregir compra”. Esta acción es únicamente para una compra omitida.
          </p>

          <button className="primary-action wide" type="submit" disabled={isSaving || !isValid}>
            {isSaving ? <ReceiptText size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
            {isSaving ? "Guardando compra sin duplicar…" : "Guardar compra faltante"}
          </button>
        </form>
      </section>
    </div>
  );
}
