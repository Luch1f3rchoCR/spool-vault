"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ReceiptText, Save, X } from "lucide-react";
import { defaultLanguage, languageLocale, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";
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
  language?: AppLanguage;
  roll: FilamentRoll;
  supplierOptions: string[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: MissingPurchaseValues) => Promise<void>;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function MissingPurchaseModal({
  language = defaultLanguage,
  roll,
  supplierOptions,
  isSaving,
  onClose,
  onSave
}: MissingPurchaseModalProps) {
  const t = (key: MessageKey, values?: Readonly<Record<string, string | number>>) => translate(language, key, values);
  const locale = languageLocale(language);
  const formatMoney = (currency: string, value: number) => `${currency} ${Number(value).toLocaleString(locale)}`;
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
        lang={language}
        aria-modal="true"
        aria-labelledby="missing-purchase-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">{t("filamentReport.missingCost")}</p>
            <h2 id="missing-purchase-title">{t("purchaseRecord.missingTitle")}</h2>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label={t("purchaseRecord.missingClose")}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="correction-product">
          <span className="mini-swatch" style={{ backgroundColor: roll.color_hex }} />
          <div>
            <strong>{roll.brand} · {roll.product_line || t("purchaseRecord.noLine")} · {roll.color_name}</strong>
            <span>{roll.material} · {t("purchaseRecord.initialWeight", { weight: Number(roll.initial_weight_g).toLocaleString(locale) })}</span>
          </div>
        </div>

        <div className="correction-audit missing-purchase-note">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>{t("purchaseRecord.missingHeadline")}</strong>
            <span>{t("purchaseRecord.missingHelp")}</span>
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
            {t("filamentReport.supplier")}
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
            {t("purchaseRecord.date")}
            <input
              required
              type="date"
              value={purchasedAt}
              disabled={isSaving}
              onChange={(event) => setPurchasedAt(event.target.value)}
            />
          </label>

          <label>
            {t("purchaseRecord.packaging")}
            <select
              value={packageType}
              disabled={isSaving}
              onChange={(event) => {
                const nextPackage = event.target.value as PackageType;
                setPackageType(nextPackage);
                setSpoolCost(nextPackage === "refill" ? "0" : (Number(spoolCost) > 0 ? spoolCost : "1000"));
              }}
            >
              <option value="spooled">{t("purchaseRecord.spooled")}</option>
              <option value="refill">{t("purchaseRecord.refill")}</option>
            </select>
          </label>

          <label>
            {t("purchaseRecord.currency")}
            <select value={currency} disabled={isSaving} onChange={(event) => setCurrency(event.target.value)}>
              <option value="CRC">{t("purchaseRecord.crc")}</option>
              <option value="USD">{t("purchaseRecord.usd")}</option>
            </select>
          </label>

          <label>
            {t("purchaseRecord.paidTotal")}
            <input
              required
              autoFocus
              type="number"
              min="0"
              step="0.01"
              placeholder={t("purchaseRecord.priceExample")}
              value={totalPrice}
              disabled={isSaving}
              onChange={(event) => setTotalPrice(event.target.value)}
            />
          </label>

          <label>
            {t("purchaseRecord.spoolCost")}
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
            <span>{t("purchaseRecord.filamentCost")}</span>
            <strong>{filamentCost == null ? "—" : formatMoney(currency, filamentCost)}</strong>
          </div>

          <p className="form-help wide">
            {t("purchaseRecord.missingOnly")}
          </p>

          <button className="primary-action wide" type="submit" disabled={isSaving || !isValid}>
            {isSaving ? <ReceiptText size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
            {isSaving ? t("purchaseRecord.savingMissing") : t("purchaseRecord.saveMissing")}
          </button>
        </form>
      </section>
    </div>
  );
}
