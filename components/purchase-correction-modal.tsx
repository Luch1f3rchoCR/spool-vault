"use client";

import { useState } from "react";
import { History, Save, X } from "lucide-react";
import { defaultLanguage, formatDate, languageLocale, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";
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
  language?: AppLanguage;
  originalPurchase: PurchaseRecord;
  effectivePurchase: PurchaseRecord;
  correctionCount: number;
  supplierOptions: string[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: PurchaseCorrectionValues) => Promise<void>;
};

export function PurchaseCorrectionModal({
  language = defaultLanguage,
  originalPurchase,
  effectivePurchase,
  correctionCount,
  supplierOptions,
  isSaving,
  onClose,
  onSave
}: PurchaseCorrectionModalProps) {
  const t = (key: MessageKey, values?: Readonly<Record<string, string | number>>) => translate(language, key, values);
  const locale = languageLocale(language);
  const formatMoney = (currency: string, value: number) => `${currency} ${Number(value).toLocaleString(locale)}`;
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
        lang={language}
        aria-modal="true"
        aria-labelledby="correct-purchase-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">{t("purchaseRecord.protected")}</p>
            <h2 id="correct-purchase-title">{t("purchaseRecord.correctionTitle")}</h2>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label={t("purchaseRecord.correctionClose")}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="correction-product">
          <span className="mini-swatch" style={{ backgroundColor: originalPurchase.color_hex }} />
          <div>
            <strong>{originalPurchase.brand} · {originalPurchase.product_line} · {originalPurchase.color_name}</strong>
            <span>{originalPurchase.material} · {Number(originalPurchase.quantity_g).toLocaleString(locale)} g</span>
          </div>
        </div>

        <div className="correction-audit">
          <History size={18} aria-hidden="true" />
          <div>
            <strong>{t("purchaseRecord.correctionHeadline")}</strong>
            <span>
              {t("purchaseRecord.original", {
                supplier: originalPurchase.supplier_name,
                date: language === "es" ? originalPurchase.purchased_at :
                  formatDate(originalPurchase.purchased_at, language, { dateStyle: "medium" }) ?? t("dateUnavailable"),
                amount: formatMoney(originalPurchase.currency, originalPurchase.total_price)
              })}
            </span>
            {correctionCount > 0 && <small>{t(correctionCount === 1 ? "purchaseRecord.previousOne" : "purchaseRecord.previousMany", { count: correctionCount.toLocaleString(locale) })}</small>}
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
            {t("filamentReport.supplier")}
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
            {t("purchaseRecord.date")}
            <input
              required
              type="date"
              value={draft.purchased_at}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, purchased_at: event.target.value })}
            />
          </label>

          <label>
            {t("purchaseRecord.packaging")}
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
              <option value="spooled">{t("purchaseRecord.spooled")}</option>
              <option value="refill">{t("purchaseRecord.refill")}</option>
            </select>
          </label>

          <label>
            {t("purchaseRecord.currency")}
            <select
              value={draft.currency}
              disabled={isSaving}
              onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
            >
              <option value="CRC">{t("purchaseRecord.crc")}</option>
              <option value="USD">{t("purchaseRecord.usd")}</option>
            </select>
          </label>

          <label>
            {t("purchaseRecord.total")}
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
            {t("purchaseRecord.spoolCost")}
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
            <span>{t("purchaseRecord.effectiveCost")}</span>
            <strong>{formatMoney(draft.currency, filamentCost)}</strong>
          </div>

          <label className="wide">
            {t("purchaseRecord.reason")}
            <textarea
              required
              minLength={3}
              maxLength={500}
              value={draft.reason}
              disabled={isSaving}
              placeholder={t("purchaseRecord.reasonExample")}
              onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
            />
            <small className="field-hint">{t("purchaseRecord.auditHelp")}</small>
          </label>

          <button className="primary-action wide" type="submit" disabled={isSaving || draft.spool_cost > draft.total_price}>
            <Save size={18} aria-hidden="true" />
            {isSaving ? t("purchaseRecord.savingCorrection") : t("purchaseRecord.saveCorrection")}
          </button>
        </form>
      </section>
    </div>
  );
}
