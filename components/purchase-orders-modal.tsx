"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, CreditCard, PackageCheck, Pencil, Plus, ReceiptText, Save, Truck, Trash2 } from "lucide-react";
import { ModalFrame } from "@/components/modal-frame";
import { defaultLanguage, formatDate, languageLocale, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";
import type {
  CostConfidence,
  ExchangeRateKind,
  PurchaseAllocationMethod,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderPayment,
  PackageType,
  PurchaseRecord
} from "@/lib/types";

export type PurchaseOrderValues = {
  new_rolls: NewOrderRoll[];
  supplier_name: string;
  currency: string;
  purchase_ids: string[];
  purchased_at: string;
  shipping_amount: number;
  other_charges_amount: number;
  allocation_method: PurchaseAllocationMethod;
  cost_confidence: CostConfidence;
  notes: string;
  manual_allocations: Record<string, { shipping: number; other: number }>;
  paid_amount: number | null;
  paid_currency: string | null;
  exchange_rate: number | null;
  exchange_rate_date: string | null;
  exchange_rate_kind: ExchangeRateKind | null;
  exchange_rate_source: string;
};

export type NewOrderRoll = {
  line_id: string; brand: string; material: string; product_line: string;
  color_name: string; color_hex: string; quantity_g: number;
  total_price: number | ""; package_type: PackageType; spool_cost: number; location: string;
};

export function newOrderPurchase(line: NewOrderRoll, supplier: string, currency: string, date: string): PurchaseRecord {
  return { id: line.line_id, roll_id: null, supplier_id: null, supplier_name: supplier,
    brand: line.brand, material: line.material, product_line: line.product_line,
    color_name: line.color_name, color_hex: line.color_hex, purchased_at: date,
    package_type: line.package_type, total_price: Number(line.total_price), spool_cost: line.spool_cost,
    filament_cost: Number(line.total_price) - line.spool_cost, currency, quantity_g: line.quantity_g };
}

type Props = {
  language?: AppLanguage;
  purchases: PurchaseRecord[];
  orders: PurchaseOrder[];
  items: PurchaseOrderItem[];
  payments: PurchaseOrderPayment[];
  baseCurrency: string;
  brandOptions: string[];
  materialOptions: string[];
  lineOptionsByMaterial: Record<string, string[]>;
  supplierNames: string[];
  operationNote: string;
  mode: "authenticated" | "demo" | "local" | "error";
  isSaving: boolean;
  onClose: () => void;
  onCreate: (values: PurchaseOrderValues) => Promise<boolean>;
};

type ManualDraft = Record<string, { shipping: string; other: string }>;

const exchangeRateLabels: Record<ExchangeRateKind, MessageKey> = {
  paid: "purchaseOrders.exchange.paid",
  historical: "purchaseOrders.exchange.historical",
  current: "purchaseOrders.exchange.current",
  manual: "purchaseOrders.exchange.manual",
  estimated: "purchaseOrders.exchange.estimated"
};

function money(currency: string, value: number, language = defaultLanguage) {
  return new Intl.NumberFormat(languageLocale(language), {
    style: "currency",
    currency,
    currencyDisplay: language === "en" ? "code" : "symbol",
    maximumFractionDigits: 2
  }).format(Number(value));
}

function allocate(
  total: number,
  purchases: PurchaseRecord[],
  method: PurchaseAllocationMethod,
  manual: ManualDraft,
  field: "shipping" | "other"
) {
  const result = new Map<string, number>();
  let running = 0;
  const subtotal = purchases.reduce((sum, purchase) => sum + Number(purchase.total_price), 0);

  purchases.forEach((purchase, index) => {
    let value = 0;
    if (method === "manual") {
      value = Number(manual[purchase.id]?.[field] || 0);
    } else if (index === purchases.length - 1) {
      value = Math.round((total - running) * 100) / 100;
    } else if (method === "by_value" && subtotal > 0) {
      value = Math.round(total * Number(purchase.total_price) / subtotal * 100) / 100;
    } else {
      value = Math.round(total / purchases.length * 100) / 100;
    }
    running += value;
    result.set(purchase.id, value);
  });

  return result;
}

export function PurchaseOrdersModal({ purchases, orders, items, payments, baseCurrency, brandOptions, materialOptions, lineOptionsByMaterial, supplierNames, operationNote, mode, isSaving, onClose, onCreate, language = defaultLanguage }: Props) {
  const t = (key: MessageKey, values?: Readonly<Record<string, string | number>>) => translate(language, key, values);
  const locale = languageLocale(language);
  const dateLabel = (value: string) => language === "es" ? value :
    formatDate(value, language, { dateStyle: "medium" }) ?? t("dateUnavailable");
  const displayMoney = (currency: string, value: number) => money(currency, value, language);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const detailOpener = useRef<HTMLElement | null>(null);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  useEffect(() => {
    if (!selectedOrderId && detailOpener.current?.isConnected) detailOpener.current.focus();
  }, [selectedOrderId]);
  const [showForm, setShowForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newRolls, setNewRolls] = useState<NewOrderRoll[]>([]);
  const [lineDraft, setLineDraft] = useState<NewOrderRoll | null>(null);
  const [lineError, setLineError] = useState<MessageKey | null>(null);
  const linesHeading = useRef<HTMLHeadingElement>(null);
  const returnToLines = useRef(false);
  useEffect(() => {
    if (!lineDraft && returnToLines.current) {
      linesHeading.current?.focus();
      returnToLines.current = false;
    }
  }, [lineDraft]);
  const [supplierName, setSupplierName] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [feedback, setFeedback] = useState<MessageKey | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const submitting = useRef(false);
  const [purchasedAt, setPurchasedAt] = useState(new Date().toISOString().slice(0, 10));
  const [shipping, setShipping] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [allocationMethod, setAllocationMethod] = useState<PurchaseAllocationMethod>("per_unit");
  const [confidence, setConfidence] = useState<CostConfidence>("actual");
  const [notes, setNotes] = useState("");
  const [manual, setManual] = useState<ManualDraft>({});
  const [includePayment, setIncludePayment] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [paidCurrency, setPaidCurrency] = useState(baseCurrency);
  const [exchangeRate, setExchangeRate] = useState("");
  const [exchangeRateDate, setExchangeRateDate] = useState(new Date().toISOString().slice(0, 10));
  const [exchangeRateKind, setExchangeRateKind] = useState<ExchangeRateKind>("paid");
  const [exchangeRateSource, setExchangeRateSource] = useState("");
  const assignedPurchaseIds = useMemo(
    () => new Set(items.map((item) => item.purchase_history_id)),
    [items]
  );
  const availablePurchases = useMemo(
    () => purchases.filter((purchase) => !assignedPurchaseIds.has(purchase.id)),
    [assignedPurchaseIds, purchases]
  );
  const existingPurchases = useMemo(
    () => selectedIds.map((id) => availablePurchases.find((purchase) => purchase.id === id)).filter(Boolean) as PurchaseRecord[],
    [availablePurchases, selectedIds]
  );
  const orderSupplier = existingPurchases[0]?.supplier_name ?? supplierName;
  const orderCurrency = existingPurchases[0]?.currency ?? currency;
  const selectedPurchases = useMemo(() => [...existingPurchases,
    ...newRolls.map((line) => newOrderPurchase(line, orderSupplier, orderCurrency, purchasedAt))],
    [existingPurchases, newRolls, orderSupplier, orderCurrency, purchasedAt]);
  const anchor = selectedPurchases[0];
  const subtotal = selectedPurchases.reduce((sum, purchase) => sum + Number(purchase.total_price), 0);
  const shippingAllocation = useMemo(
    () => allocate(shipping, selectedPurchases, allocationMethod, manual, "shipping"),
    [allocationMethod, manual, selectedPurchases, shipping]
  );
  const otherAllocation = useMemo(
    () => allocate(otherCharges, selectedPurchases, allocationMethod, manual, "other"),
    [allocationMethod, manual, otherCharges, selectedPurchases]
  );
  const manualShippingTotal = Array.from(shippingAllocation.values()).reduce((sum, value) => sum + value, 0);
  const manualOtherTotal = Array.from(otherAllocation.values()).reduce((sum, value) => sum + value, 0);
  const manualMatches = allocationMethod !== "manual"
    || (Math.abs(manualShippingTotal - shipping) < 0.005 && Math.abs(manualOtherTotal - otherCharges) < 0.005);
  const sortedOrders = [...orders].sort((a, b) => b.purchased_at.localeCompare(a.purchased_at));
  const orderTotal = subtotal + shipping + otherCharges;
  const parsedPaidAmount = paidAmount === "" ? null : Number(paidAmount);
  const parsedExchangeRate = exchangeRate === "" ? null : Number(exchangeRate);
  const paymentValid = !includePayment || (
    parsedPaidAmount !== null && parsedPaidAmount >= 0
    && parsedExchangeRate !== null && parsedExchangeRate > 0
    && Boolean(exchangeRateDate)
    && (paidCurrency !== anchor?.currency || parsedExchangeRate === 1)
  );
  const expectedPaid = parsedExchangeRate === null ? null : orderTotal * parsedExchangeRate;
  const paymentCurrencies = Array.from(new Set([baseCurrency, anchor?.currency, "CRC", "USD", "EUR"].filter(Boolean) as string[]));

  function togglePayment(enabled: boolean) {
    setIncludePayment(enabled);
    if (!enabled) return;
    const originalCurrency = anchor?.currency ?? baseCurrency;
    setPaidCurrency(baseCurrency);
    setExchangeRateDate(purchasedAt);
    if (baseCurrency === originalCurrency) {
      setExchangeRate("1");
      setPaidAmount(String(orderTotal));
    } else {
      setExchangeRate("");
      setPaidAmount("");
    }
  }

  function changePaidCurrency(currency: string) {
    setPaidCurrency(currency);
    if (currency === anchor?.currency) setExchangeRate("1");
    else if (exchangeRate === "1") setExchangeRate("");
  }

  function togglePurchase(purchase: PurchaseRecord) {
    if (selectedIds.includes(purchase.id)) {
      setSelectedIds((current) => current.filter((id) => id !== purchase.id));
      return;
    }
    if (!selectedIds.length && !newRolls.length) setPurchasedAt(purchase.purchased_at);
    if (!selectedIds.length) { setSupplierName(purchase.supplier_name); setCurrency(purchase.currency); }
    setSelectedIds((current) => [...current, purchase.id]);
  }

  function resetForm() {
    setShowForm(false);
    setSelectedIds([]);
    setNewRolls([]); setSupplierName(""); setCurrency(baseCurrency);
    setShipping(0);
    setOtherCharges(0);
    setAllocationMethod("per_unit");
    setConfidence("actual");
    setNotes("");
    setManual({});
    setIncludePayment(false);
    setPaidAmount("");
    setPaidCurrency(baseCurrency);
    setExchangeRate("");
    setExchangeRateDate(new Date().toISOString().slice(0, 10));
    setExchangeRateKind("paid");
    setExchangeRateSource("");
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || isSaving || lineDraft || !selectedPurchases.length || !manualMatches || !paymentValid) return;
    submitting.current = true;
    setFeedback(null);
    const manualAllocations = Object.fromEntries(selectedPurchases.map((purchase) => [purchase.id, {
      shipping: shippingAllocation.get(purchase.id) ?? 0,
      other: otherAllocation.get(purchase.id) ?? 0
    }]));
    try {
    const saved = await onCreate({
      new_rolls: newRolls, supplier_name: orderSupplier.trim(), currency: orderCurrency,
      purchase_ids: selectedIds,
      purchased_at: purchasedAt,
      shipping_amount: shipping,
      other_charges_amount: otherCharges,
      allocation_method: allocationMethod,
      cost_confidence: confidence,
      notes,
      manual_allocations: manualAllocations,
      paid_amount: includePayment ? parsedPaidAmount : null,
      paid_currency: includePayment ? paidCurrency : null,
      exchange_rate: includePayment ? parsedExchangeRate : null,
      exchange_rate_date: includePayment ? exchangeRateDate : null,
      exchange_rate_kind: includePayment ? exchangeRateKind : null,
      exchange_rate_source: includePayment ? exchangeRateSource : ""
    });
    if (saved) resetForm();
    setSaveFailed(!saved);
    setFeedback(saved ? "orderForm.saved" : "orderForm.unconfirmed");
    } catch { setSaveFailed(true); setFeedback("orderForm.failed"); }
    finally { submitting.current = false; }
  }

  useEffect(() => { if (feedback && !isSaving) { feedbackRef.current?.focus(); feedbackRef.current?.scrollIntoView({ block: "nearest" }); } }, [feedback, isSaving]);

  function updateLine(patch: Partial<NewOrderRoll>) {
    setLineDraft((line) => line ? { ...line, ...patch } : line);
    setLineError(null);
  }

  function closeLine() {
    if (isSaving) return;
    returnToLines.current = true;
    setLineDraft(null);
    setLineError(null);
  }

  function includeLine(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lineDraft || isSaving) return;
    if (!lineDraft.color_name.trim()) { setLineError("orderForm.colorRequired"); return; }
    const line = { ...lineDraft, color_name: lineDraft.color_name.trim() };
    setNewRolls((rows) => rows.some((row) => row.line_id === line.line_id)
      ? rows.map((row) => row.line_id === line.line_id ? line : row) : [...rows, line]);
    closeLine();
  }

  if (lineDraft) {
    const line = lineDraft;
    const editing = newRolls.some((row) => row.line_id === line.line_id);
    return <ModalFrame lang={language} className="purchase-orders-modal" titleId="purchase-line-title" eyebrow={t("orderForm.lineDraft")}
      title={t(editing ? "orderForm.editLineTitle" : "orderForm.addLineTitle")} busy={isSaving}
      onClose={closeLine} onBack={closeLine} viewKey={`line-${line.line_id}`} closeLabel={t("orderForm.back")} backLabel={t("orderForm.back")}>
      <p className="form-help">{t("orderForm.physicalRollHelp")}</p>
      <form className="purchase-line-editor" onSubmit={includeLine}>
        <fieldset disabled={isSaving} className="purchase-line-editor-fields form-grid">
          <label>{t("brand")}<select value={line.brand} onChange={(event) => updateLine({ brand: event.target.value })}>{brandOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label>{t("rollEdit.material")}<select value={line.material} onChange={(event) => updateLine({ material: event.target.value, product_line: lineOptionsByMaterial[event.target.value]?.[0] || "Genérico" })}>{materialOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label>{t("rollEdit.line")}<select value={line.product_line} onChange={(event) => updateLine({ product_line: event.target.value })}>{(lineOptionsByMaterial[line.material] || ["Genérico"]).map((name) => <option key={name}>{name}</option>)}</select></label>
          <label>{t("orderForm.colorName")}<input required maxLength={120} value={line.color_name} onChange={(event) => updateLine({ color_name: event.target.value })} /></label>
          <label>{t("orderForm.colorPreview")}<input type="color" value={/^#[0-9a-f]{6}$/i.test(line.color_hex) ? line.color_hex : "#999999"} onChange={(event) => updateLine({ color_hex: event.target.value })} /></label>
          <label>HEX<input required pattern="#[0-9A-Fa-f]{6}" maxLength={7} value={line.color_hex} onChange={(event) => updateLine({ color_hex: event.target.value })} /></label>
          <label>{t("orderForm.weight")}<input required type="number" min="0.01" max="999999" step="0.01" value={line.quantity_g} onChange={(event) => updateLine({ quantity_g: Number(event.target.value) })} /></label>
          <label>{t("orderForm.productPrice", { currency: orderCurrency })}<input required type="number" min="0" step="0.01" value={line.total_price} onChange={(event) => updateLine({ total_price: event.target.value === "" ? "" : Number(event.target.value) })} /><small>{t("orderForm.productPriceHelp")}</small></label>
          <label>{t("purchaseRecord.packaging")}<select value={line.package_type} onChange={(event) => updateLine({ package_type: event.target.value as PackageType, spool_cost: 0 })}><option value="refill">{t("orderForm.noSpool")}</option><option value="spooled">{t("purchaseRecord.spooled")}</option></select></label>
          {line.package_type === "spooled" && <label>{t("orderForm.includedSpool", { currency: orderCurrency })}<input required type="number" min="0" max={Number(line.total_price)} step="0.01" value={line.spool_cost} onChange={(event) => updateLine({ spool_cost: Number(event.target.value) })} /></label>}
          <label>{t("firstVisit.location")}<input maxLength={160} value={line.location} onChange={(event) => updateLine({ location: event.target.value })} /></label>
        </fieldset>
        {lineError && <p className="account-error" role="alert">{t(lineError)}</p>}
        <div className="purchase-line-editor-actions">
          <button className="secondary-action" type="button" onClick={closeLine} disabled={isSaving}>{t("orderForm.cancel")}</button>
          <button className="primary-action" type="submit" disabled={isSaving}><Plus size={18} aria-hidden="true" />{editing ? t("orderForm.updateLine") : t("orderForm.includeLine")}</button>
        </div>
      </form>
    </ModalFrame>;
  }

  return (
    <ModalFrame lang={language} className="purchase-orders-modal" titleId="purchase-orders-title" eyebrow={t("purchaseOrders.eyebrow")}
      closeLabel={t("purchaseOrders.close")} backLabel={t("purchaseOrders.back")}
      title={t(selectedOrder ? "purchaseOrders.detailTitle" : "purchaseOrders.title")} busy={isSaving} onClose={onClose}
      onBack={selectedOrder ? () => setSelectedOrderId(null) : undefined} viewKey={selectedOrderId ?? "list"}>

        {mode !== "authenticated" && <p className="purchase-order-mode">{t(mode === "demo" ? "purchaseOrders.demo" : "purchaseOrders.local")}</p>}

        {selectedOrder ? <PurchaseOrderDetail language={language} order={selectedOrder} items={items.filter((item) => item.order_id === selectedOrder.id)}
          payment={payments.find((payment) => payment.order_id === selectedOrder.id)} /> : null}

        <div hidden={Boolean(selectedOrder)}>
        {feedback && <p ref={feedbackRef} tabIndex={-1} role={saveFailed ? "alert" : "status"} className={saveFailed ? "account-error" : "account-notice"}>{t(feedback)}{saveFailed && operationNote && <><br />{language === "en" && <>{t("account.originalMessage")} </>}<span lang="">{operationNote}</span></>}</p>}
        <div className="purchase-order-summary">
          <div><ReceiptText size={19} aria-hidden="true" /><span><strong>{orders.length}</strong> {t("purchaseOrders.orders")}</span></div>
          <div><PackageCheck size={19} aria-hidden="true" /><span><strong>{availablePurchases.length}</strong> {t("purchaseOrders.ungrouped")}</span></div>
          <button type="button" onClick={() => { setShowForm((value) => !value); setFeedback(null); }} disabled={isSaving}><Plus size={17} aria-hidden="true" /> {t("purchaseOrders.newOrder")}</button>
        </div>

        {showForm && (
          <form lang={language} className="purchase-order-form" onSubmit={submitOrder} aria-busy={isSaving}>
            <fieldset disabled={isSaving} className="purchase-order-fields">
            <div className="purchase-order-header form-grid">
              <label>{t("orderForm.supplier")}<input required maxLength={200} list="order-suppliers" value={orderSupplier} disabled={isSaving || existingPurchases.length > 0} onChange={(event) => setSupplierName(event.target.value)} /></label>
              <datalist id="order-suppliers">{supplierNames.map((name) => <option key={name} value={name} />)}</datalist>
              <label>{t("orderForm.currency")}<select value={orderCurrency} disabled={isSaving || existingPurchases.length > 0} onChange={(event) => setCurrency(event.target.value)}>{Array.from(new Set([orderCurrency, baseCurrency, "CRC", "USD", "EUR"])).map((code) => <option key={code}>{code}</option>)}</select></label>
            </div>
            <div className="purchase-order-step">
              <div className="section-head"><div><p className="eyebrow">{t("orderForm.stepOne")}</p><h3 ref={linesHeading} tabIndex={-1}>{t("orderForm.lines")}</h3></div><span>{t(selectedPurchases.length === 1 ? "purchaseOrders.lineOne" : "purchaseOrders.lineMany", { count: selectedPurchases.length.toLocaleString(locale) })}</span></div>
              <p className="form-help">{t("orderForm.linesHelp")}</p>
              <button type="button" disabled={isSaving || selectedPurchases.length >= 100} onClick={() => setLineDraft({
                line_id: crypto.randomUUID(), brand: brandOptions[0] || "Genérico", material: "PLA", product_line: lineOptionsByMaterial.PLA?.[0] || "Genérico",
                color_name: "", color_hex: "#999999", quantity_g: 1000, total_price: "", package_type: "refill", spool_cost: 0, location: ""
              })}><Plus size={17} aria-hidden="true" />{t("orderForm.addFilament")}</button>
              <ol className="purchase-draft-lines" aria-label={t("orderForm.lines")}>
                {selectedPurchases.map((purchase, index) => {
                  const line = newRolls.find((row) => row.line_id === purchase.id);
                  return <li key={purchase.id}>
                    <span className="mini-swatch" style={{ backgroundColor: purchase.color_hex }} />
                    <div className="purchase-draft-description"><strong>{index + 1}. {purchase.color_name}</strong><small>{purchase.brand} · {purchase.product_line || purchase.material}</small><small>{purchase.quantity_g.toLocaleString(locale)} g · {purchase.package_type === "spooled" ? t("purchaseRecord.spooled") : t("orderForm.noSpool")} · {line ? t("orderForm.unrecorded") : t("orderForm.recorded")}</small></div>
                    <strong className="purchase-draft-price">{displayMoney(orderCurrency, purchase.total_price)}</strong>
                    <div className="purchase-draft-actions">
                      {line && <button type="button" disabled={isSaving} aria-label={t("orderForm.editLabel", { number: index + 1, color: purchase.color_name })} onClick={() => setLineDraft({ ...line })}><Pencil size={16} aria-hidden="true" />{t("orderForm.edit")}</button>}
                      <button type="button" disabled={isSaving} aria-label={t("orderForm.removeLabel", { number: index + 1, color: purchase.color_name })} onClick={() => line
                        ? setNewRolls((rows) => rows.filter((row) => row.line_id !== line.line_id))
                        : setSelectedIds((ids) => ids.filter((id) => id !== purchase.id))}><Trash2 size={16} aria-hidden="true" /><span>{t("orderForm.remove")}</span></button>
                    </div>
                  </li>;
                })}
              </ol>
              {!selectedPurchases.length && <p className="purchase-draft-empty">{t("orderForm.noLines")}</p>}
              <p className="form-help">{t("orderForm.draftHelp")}</p>
              <details className="purchase-existing">
                <summary tabIndex={0}>{t("orderForm.groupExisting", { count: availablePurchases.length.toLocaleString(locale) })}</summary>
                <p className="form-help">{t("orderForm.groupHelp")}</p>
              <div className="purchase-candidate-list">
                {availablePurchases.map((purchase) => {
                  const compatible = !anchor || (
                    orderCurrency === purchase.currency
                    && (!orderSupplier.trim() || orderSupplier.trim().toLowerCase() === purchase.supplier_name.trim().toLowerCase())
                  );
                  const selected = selectedIds.includes(purchase.id);
                  return (
                    <label key={purchase.id} className={selected ? "selected" : ""}>
                      <input type="checkbox" checked={selected} disabled={isSaving || (!selected && selectedPurchases.length >= 100) || (!compatible && !selected)} onChange={() => togglePurchase(purchase)} />
                      <span className="mini-swatch" style={{ backgroundColor: purchase.color_hex }} />
                      <span><strong>{purchase.brand} · {purchase.product_line || purchase.material} · {purchase.color_name}</strong><small>{purchase.supplier_name.trim()} · {dateLabel(purchase.purchased_at)}</small></span>
                      <strong>{displayMoney(purchase.currency, purchase.total_price)}</strong>
                    </label>
                  );
                })}
              </div>
              </details>
            </div>

            <div className="purchase-order-step">
              <div className="section-head"><div><p className="eyebrow">{t("orderForm.stepTwo")}</p><h3>{t("orderForm.charges")}</h3></div>{anchor && <span>{anchor.currency}</span>}</div>
              <div className="form-grid">
                <label>{t("orderForm.date")}<input required type="date" value={purchasedAt} disabled={isSaving} onChange={(event) => setPurchasedAt(event.target.value)} /></label>
                <label>{t("orderForm.confidence")}<select value={confidence} disabled={isSaving} onChange={(event) => setConfidence(event.target.value as CostConfidence)}><option value="actual">{t("orderForm.actual")}</option><option value="estimated">{t("orderForm.estimated")}</option><option value="incomplete">{t("orderForm.incomplete")}</option></select></label>
                <label>{t("purchaseOrders.express")}<input type="number" min="0" step="0.01" value={shipping} disabled={isSaving} onChange={(event) => setShipping(Number(event.target.value))} /></label>
                <label>{t("purchaseOrders.otherCharges")}<input type="number" min="0" step="0.01" value={otherCharges} disabled={isSaving} onChange={(event) => setOtherCharges(Number(event.target.value))} /></label>
                <label className="wide">{t("orderForm.allocation")}<select value={allocationMethod} disabled={isSaving} onChange={(event) => setAllocationMethod(event.target.value as PurchaseAllocationMethod)}><option value="per_unit">{t("orderForm.perUnit")}</option><option value="by_value">{t("orderForm.byValue")}</option><option value="manual">{t("orderForm.manual")}</option></select></label>
                <button className="historical-assumption wide" type="button" disabled={isSaving || Boolean(anchor && anchor.currency !== "CRC")} onClick={() => { setShipping(3000); setAllocationMethod("per_unit"); setConfidence("estimated"); }}><Truck size={17} aria-hidden="true" /><span><strong>{t("orderForm.assumption")}</strong><small>{t("orderForm.assumptionHelp")}</small></span></button>
              </div>

              {selectedPurchases.length > 0 && (
                <div className="allocation-preview">
                  <div className="allocation-head"><Calculator size={17} aria-hidden="true" /><strong>{t("orderForm.preview", { method: t(`purchaseOrders.allocation.${allocationMethod}`) })}</strong></div>
                  {selectedPurchases.map((purchase) => (
                    <div key={purchase.id}>
                      <span>{purchase.color_name}</span>
                      {allocationMethod === "manual" ? (
                        <span className="manual-allocation"><input aria-label={t("orderForm.shippingLabel", { color: purchase.color_name })} type="number" min="0" step="0.01" placeholder={t("orderForm.shippingPlaceholder")} value={manual[purchase.id]?.shipping ?? ""} onChange={(event) => setManual((current) => ({ ...current, [purchase.id]: { shipping: event.target.value, other: current[purchase.id]?.other ?? "" } }))} /><input aria-label={t("orderForm.otherLabel", { color: purchase.color_name })} type="number" min="0" step="0.01" placeholder={t("orderForm.otherPlaceholder")} value={manual[purchase.id]?.other ?? ""} onChange={(event) => setManual((current) => ({ ...current, [purchase.id]: { shipping: current[purchase.id]?.shipping ?? "", other: event.target.value } }))} /></span>
                      ) : <span>+ {displayMoney(purchase.currency, (shippingAllocation.get(purchase.id) ?? 0) + (otherAllocation.get(purchase.id) ?? 0))}</span>}
                      <strong>{displayMoney(purchase.currency, Number(purchase.total_price) + (shippingAllocation.get(purchase.id) ?? 0) + (otherAllocation.get(purchase.id) ?? 0))}</strong>
                    </div>
                  ))}
                  {!manualMatches && <p role="alert">{t("orderForm.manualError")}</p>}
                </div>
              )}

              <div className="payment-capture">
                <label className="payment-toggle">
                  <input type="checkbox" checked={includePayment} disabled={isSaving || !anchor} onChange={(event) => togglePayment(event.target.checked)} />
                  <span><CreditCard size={18} aria-hidden="true" /><span><strong>{t("orderForm.recordPayment")}</strong><small>{t("orderForm.paymentHelp")}</small></span></span>
                </label>
                {includePayment && (
                  <div className="form-grid payment-grid">
                    <label>{t("orderForm.paidAmount")}<input required type="number" min="0" step="0.01" value={paidAmount} disabled={isSaving} onChange={(event) => setPaidAmount(event.target.value)} /></label>
                    <label>{t("orderForm.paidCurrency")}<select value={paidCurrency} disabled={isSaving} onChange={(event) => changePaidCurrency(event.target.value)}>{paymentCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
                    <label>{t("orderForm.exchangeRate")}<input required type="number" min="0.00000001" step="0.00000001" value={exchangeRate} disabled={isSaving || paidCurrency === anchor?.currency} onChange={(event) => setExchangeRate(event.target.value)} /><small>1 {anchor?.currency} = {exchangeRate || "—"} {paidCurrency}</small></label>
                    <label>{t("orderForm.exchangeDate")}<input required type="date" value={exchangeRateDate} disabled={isSaving} onChange={(event) => setExchangeRateDate(event.target.value)} /></label>
                    <label>{t("orderForm.exchangeKind")}<select value={exchangeRateKind} disabled={isSaving} onChange={(event) => setExchangeRateKind(event.target.value as ExchangeRateKind)}>{Object.entries(exchangeRateLabels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
                    <label>{t("orderForm.source")}<input maxLength={200} value={exchangeRateSource} disabled={isSaving} placeholder={t("orderForm.sourceExample")} onChange={(event) => setExchangeRateSource(event.target.value)} /></label>
                    {expectedPaid !== null && (
                      <p className="payment-preview wide">{t("orderForm.reference")} <strong>{displayMoney(paidCurrency, expectedPaid)}</strong>{parsedPaidAmount !== null && Math.abs(parsedPaidAmount - expectedPaid) >= 0.01 ? t("orderForm.difference", { amount: displayMoney(paidCurrency, parsedPaidAmount - expectedPaid) }) : ""}</p>
                    )}
                    {!paymentValid && <p className="payment-error wide" role="alert">{t("orderForm.paymentError")}</p>}
                  </div>
                )}
              </div>

              <label className="order-notes">{t("orderForm.notes")}<textarea maxLength={1000} value={notes} disabled={isSaving} placeholder={t("orderForm.notesPlaceholder")} onChange={(event) => setNotes(event.target.value)} /></label>
              <div className="purchase-order-total"><span>{t("orderForm.total", { subtotal: displayMoney(anchor?.currency ?? "CRC", subtotal), charges: displayMoney(anchor?.currency ?? "CRC", shipping + otherCharges) })}</span><strong>{displayMoney(anchor?.currency ?? "CRC", subtotal + shipping + otherCharges)}</strong></div>
              <button className="primary-action" type="submit" disabled={isSaving || !selectedPurchases.length || !manualMatches || !paymentValid}><Save size={18} aria-hidden="true" />{isSaving ? t("orderForm.saving") : t("orderForm.save")}</button>
            </div>
            </fieldset>
          </form>
        )}

        <div className="purchase-invoice-grid">
          {sortedOrders.length ? sortedOrders.map((order) => {
            const orderItems = items.filter((item) => item.order_id === order.id);
            const payment = payments.find((candidate) => candidate.order_id === order.id);
            return (
              <article className="purchase-invoice-card" key={order.id}>
                <header><span>{t("filamentReport.supplier")}</span><h3>{order.supplier_name || t("filamentReport.noSupplier")}</h3></header>
                <div className="invoice-status"><span className={`cost-confidence ${order.cost_confidence}`}>{t(`purchaseOrders.cost.${order.cost_confidence}`)}</span><span>{t(orderItems.length === 1 ? "purchaseOrders.lineOne" : "purchaseOrders.lineMany", { count: orderItems.length.toLocaleString(locale) })}</span></div>
                <dl className="invoice-meta">
                  <div><dt>{t("purchaseRecord.date")}</dt><dd>{dateLabel(order.purchased_at)}</dd></div>
                  <div><dt>{t("purchaseRecord.currency")}</dt><dd>{order.currency}</dd></div>
                  <div><dt>{t("purchaseOrders.allocation")}</dt><dd>{t(`purchaseOrders.allocation.${order.allocation_method}`)}</dd></div>
                  <div><dt>{t("purchaseOrders.subtotal")}</dt><dd>{displayMoney(order.currency, order.subtotal_amount)}</dd></div>
                </dl>
                <footer><div><small>{t("purchaseOrders.total")}</small><strong>{displayMoney(order.currency, order.total_amount)}</strong></div><div className="invoice-charge-summary"><small>{t("purchaseOrders.shipping", { amount: displayMoney(order.currency, order.shipping_amount) })}</small><small>{t("purchaseOrders.other", { amount: displayMoney(order.currency, order.other_charges_amount) })}</small></div></footer>
                {payment && <p className="invoice-payment">{t("purchaseOrders.payment", { amount: displayMoney(payment.paid_currency, payment.paid_amount) })}</p>}
                <button className="invoice-detail-button" type="button" disabled={isSaving} aria-label={t("purchaseOrders.viewLabel", { supplier: order.supplier_name, date: dateLabel(order.purchased_at) })} onClick={(event) => {
                  detailOpener.current = event.currentTarget;
                  setSelectedOrderId(order.id);
                }}><ReceiptText size={17} aria-hidden="true" /> {t("purchaseOrders.view")}</button>
              </article>
            );
          }) : <p className="empty-state">{t("purchaseOrders.empty")}</p>}
        </div>
        </div>
    </ModalFrame>
  );
}

function PurchaseOrderDetail({ order, items, payment, language = defaultLanguage }: { language?: AppLanguage; order: PurchaseOrder; items: PurchaseOrderItem[]; payment?: PurchaseOrderPayment }) {
  const t = (key: MessageKey, values?: Readonly<Record<string, string | number>>) => translate(language, key, values);
  const locale = languageLocale(language);
  const dateLabel = (value: string) => language === "es" ? value :
    formatDate(value, language, { dateStyle: "medium" }) ?? t("dateUnavailable");
  const displayMoney = (currency: string, value: number) => money(currency, value, language);
  return <div className="invoice-detail" lang={language}>
    <header className="invoice-detail-heading"><h3>{order.supplier_name || t("filamentReport.noSupplier")}</h3><span>{dateLabel(order.purchased_at)} · {order.currency}</span>
      <span className={`cost-confidence ${order.cost_confidence}`}>{t(`purchaseOrders.cost.${order.cost_confidence}`)}</span>
    </header>
    <p className="form-help">{t("purchaseOrders.help")}</p>
    <div className="invoice-lines">{items.length ? items.map((item, index) => <article key={item.id}>
      <div className="invoice-line-title"><span className="mini-swatch" style={{ backgroundColor: item.color_hex }} /><div><h4>{index + 1}. {item.brand} · {item.color_name}</h4><p>{item.product_line || item.material} · {Number(item.quantity_g).toLocaleString(locale)} g · {t(item.package_type === "refill" ? "purchaseOrders.noSpool" : "purchaseRecord.spooled")}</p></div></div>
      <dl className="invoice-line-costs">
        <div><dt>{t("purchaseOrders.product")}</dt><dd>{displayMoney(item.currency, item.base_amount)}</dd></div>
        <div><dt>{t("purchaseOrders.includedSpool")}</dt><dd>{displayMoney(item.currency, item.spool_cost)}</dd></div>
        <div><dt>{t("purchaseOrders.allocatedShipping")}</dt><dd>{displayMoney(item.currency, item.allocated_shipping)}</dd></div>
        <div><dt>{t("purchaseOrders.allocatedOther")}</dt><dd>{displayMoney(item.currency, item.allocated_other_charges)}</dd></div>
        <div className="invoice-line-total"><dt>{t("purchaseOrders.lineTotal")}</dt><dd>{displayMoney(item.currency, item.landed_total)}</dd></div>
      </dl>
    </article>) : <p className="empty-state">{t("purchaseOrders.noLines")}</p>}</div>
    <dl className="invoice-totals">
      <div><dt>{t("purchaseOrders.subtotal")}</dt><dd>{displayMoney(order.currency, order.subtotal_amount)}</dd></div>
      <div><dt>{t("purchaseOrders.express")}</dt><dd>{displayMoney(order.currency, order.shipping_amount)}</dd></div>
      <div><dt>{t("purchaseOrders.otherCharges")}</dt><dd>{displayMoney(order.currency, order.other_charges_amount)}</dd></div>
      <div><dt>{t("purchaseOrders.total")}</dt><dd>{displayMoney(order.currency, order.total_amount)}</dd></div>
    </dl>
    {payment && <section className="invoice-payment-detail"><h3>{t("purchaseOrders.recordedPayment")}</h3><p>{displayMoney(payment.paid_currency, payment.paid_amount)} · {t(`purchaseOrders.exchange.${payment.exchange_rate_kind}`)}</p><p>1 {order.currency} = {Number(payment.exchange_rate).toLocaleString(locale, { maximumFractionDigits: 8 })} {payment.paid_currency} · {dateLabel(payment.exchange_rate_date)}</p>{payment.exchange_rate_source && <p>{t("purchaseOrders.source", { source: payment.exchange_rate_source })}</p>}</section>}
    {order.notes && <section className="invoice-notes"><h3>{t("purchaseOrders.notes")}</h3><p>{order.notes}</p></section>}
  </div>;
}
