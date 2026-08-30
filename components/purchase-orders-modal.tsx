"use client";

import { useMemo, useState } from "react";
import { Calculator, CreditCard, PackageCheck, Plus, ReceiptText, Save, Truck, X } from "lucide-react";
import type {
  CostConfidence,
  ExchangeRateKind,
  PurchaseAllocationMethod,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderPayment,
  PurchaseRecord
} from "@/lib/types";

export type PurchaseOrderValues = {
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

type Props = {
  purchases: PurchaseRecord[];
  orders: PurchaseOrder[];
  items: PurchaseOrderItem[];
  payments: PurchaseOrderPayment[];
  baseCurrency: string;
  mode: "authenticated" | "demo" | "local" | "error";
  isSaving: boolean;
  onClose: () => void;
  onCreate: (values: PurchaseOrderValues) => Promise<boolean>;
};

type ManualDraft = Record<string, { shipping: string; other: string }>;

const allocationLabels: Record<PurchaseAllocationMethod, string> = {
  per_unit: "Por unidad",
  by_value: "Por valor",
  manual: "Manual"
};

const confidenceLabels: Record<CostConfidence, string> = {
  actual: "Real",
  estimated: "Estimado",
  incomplete: "Incompleto"
};

const exchangeRateLabels: Record<ExchangeRateKind, string> = {
  paid: "Real pagado",
  historical: "Histórico",
  current: "Actual del día",
  manual: "Manual",
  estimated: "Estimado"
};

function money(currency: string, value: number) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "CRC" ? 0 : 2
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

export function PurchaseOrdersModal({ purchases, orders, items, payments, baseCurrency, mode, isSaving, onClose, onCreate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
  const selectedPurchases = useMemo(
    () => selectedIds.map((id) => availablePurchases.find((purchase) => purchase.id === id)).filter(Boolean) as PurchaseRecord[],
    [availablePurchases, selectedIds]
  );
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
    if (!selectedIds.length) setPurchasedAt(purchase.purchased_at);
    setSelectedIds((current) => [...current, purchase.id]);
  }

  function resetForm() {
    setShowForm(false);
    setSelectedIds([]);
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
    if (!selectedPurchases.length || !manualMatches || !paymentValid) return;
    const manualAllocations = Object.fromEntries(selectedPurchases.map((purchase) => [purchase.id, {
      shipping: shippingAllocation.get(purchase.id) ?? 0,
      other: otherAllocation.get(purchase.id) ?? 0
    }]));
    const saved = await onCreate({
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
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isSaving && onClose()}>
      <section className="panel modal-panel purchase-orders-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-orders-title">
        <div className="modal-head">
          <div><p className="eyebrow">Compras y costos</p><h2 id="purchase-orders-title">Órdenes de compra</h2></div>
          <button className="modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Cerrar órdenes"><X size={20} aria-hidden="true" /></button>
        </div>

        {mode !== "authenticated" && <p className="purchase-order-mode">Vista {mode === "demo" ? "de demostración" : "local"} · estas órdenes no están sincronizadas.</p>}

        <div className="purchase-order-summary">
          <div><ReceiptText size={19} aria-hidden="true" /><span><strong>{orders.length}</strong> órdenes</span></div>
          <div><PackageCheck size={19} aria-hidden="true" /><span><strong>{availablePurchases.length}</strong> compras por agrupar</span></div>
          <button type="button" onClick={() => setShowForm((value) => !value)} disabled={isSaving || !availablePurchases.length}><Plus size={17} aria-hidden="true" /> Nueva orden</button>
        </div>

        {showForm && (
          <form className="purchase-order-form" onSubmit={submitOrder} aria-busy={isSaving}>
            <div className="purchase-order-step">
              <div className="section-head"><div><p className="eyebrow">Paso 1</p><h3>Elegí las partidas</h3></div><span>{selectedPurchases.length} seleccionadas</span></div>
              <p className="form-help">Podés agrupar compras del mismo proveedor y moneda. La historia original no se modifica.</p>
              <div className="purchase-candidate-list">
                {availablePurchases.map((purchase) => {
                  const compatible = !anchor || (
                    anchor.currency === purchase.currency
                    && anchor.supplier_name.trim().toLowerCase() === purchase.supplier_name.trim().toLowerCase()
                  );
                  const selected = selectedIds.includes(purchase.id);
                  return (
                    <label key={purchase.id} className={selected ? "selected" : ""}>
                      <input type="checkbox" checked={selected} disabled={isSaving || (!compatible && !selected)} onChange={() => togglePurchase(purchase)} />
                      <span className="mini-swatch" style={{ backgroundColor: purchase.color_hex }} />
                      <span><strong>{purchase.brand} · {purchase.product_line || purchase.material} · {purchase.color_name}</strong><small>{purchase.supplier_name.trim()} · {purchase.purchased_at}</small></span>
                      <strong>{money(purchase.currency, purchase.total_price)}</strong>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="purchase-order-step">
              <div className="section-head"><div><p className="eyebrow">Paso 2</p><h3>Cargos y prorrateo</h3></div>{anchor && <span>{anchor.currency}</span>}</div>
              <div className="form-grid">
                <label>Fecha de la orden<input required type="date" value={purchasedAt} disabled={isSaving} onChange={(event) => setPurchasedAt(event.target.value)} /></label>
                <label>Confianza del costo<select value={confidence} disabled={isSaving} onChange={(event) => setConfidence(event.target.value as CostConfidence)}><option value="actual">Real · tengo el monto</option><option value="estimated">Estimado · supuesto visible</option><option value="incomplete">Incompleto · faltan cargos</option></select></label>
                <label>Envío / express<input type="number" min="0" step="0.01" value={shipping} disabled={isSaving} onChange={(event) => setShipping(Number(event.target.value))} /></label>
                <label>Otros cargos<input type="number" min="0" step="0.01" value={otherCharges} disabled={isSaving} onChange={(event) => setOtherCharges(Number(event.target.value))} /></label>
                <label className="wide">Método de prorrateo<select value={allocationMethod} disabled={isSaving} onChange={(event) => setAllocationMethod(event.target.value as PurchaseAllocationMethod)}><option value="per_unit">Por unidad · recomendado</option><option value="by_value">Por valor de cada rollo</option><option value="manual">Manual por partida</option></select></label>
                <button className="historical-assumption wide" type="button" disabled={isSaving || Boolean(anchor && anchor.currency !== "CRC")} onClick={() => { setShipping(3000); setAllocationMethod("per_unit"); setConfidence("estimated"); }}><Truck size={17} aria-hidden="true" /><span><strong>Aplicar supuesto histórico: ₡3.000 por orden</strong><small>Se divide por unidad; serían ₡1.000 por rollo cuando la orden tiene 3.</small></span></button>
              </div>

              {selectedPurchases.length > 0 && (
                <div className="allocation-preview">
                  <div className="allocation-head"><Calculator size={17} aria-hidden="true" /><strong>Vista previa · {allocationLabels[allocationMethod]}</strong></div>
                  {selectedPurchases.map((purchase) => (
                    <div key={purchase.id}>
                      <span>{purchase.color_name}</span>
                      {allocationMethod === "manual" ? (
                        <span className="manual-allocation"><input aria-label={`Envío para ${purchase.color_name}`} type="number" min="0" step="0.01" placeholder="Envío" value={manual[purchase.id]?.shipping ?? ""} onChange={(event) => setManual((current) => ({ ...current, [purchase.id]: { shipping: event.target.value, other: current[purchase.id]?.other ?? "" } }))} /><input aria-label={`Otros cargos para ${purchase.color_name}`} type="number" min="0" step="0.01" placeholder="Otros" value={manual[purchase.id]?.other ?? ""} onChange={(event) => setManual((current) => ({ ...current, [purchase.id]: { shipping: current[purchase.id]?.shipping ?? "", other: event.target.value } }))} /></span>
                      ) : <span>+ {money(purchase.currency, (shippingAllocation.get(purchase.id) ?? 0) + (otherAllocation.get(purchase.id) ?? 0))}</span>}
                      <strong>{money(purchase.currency, Number(purchase.total_price) + (shippingAllocation.get(purchase.id) ?? 0) + (otherAllocation.get(purchase.id) ?? 0))}</strong>
                    </div>
                  ))}
                  {!manualMatches && <p role="alert">El reparto manual debe sumar exactamente los cargos de la orden.</p>}
                </div>
              )}

              <div className="payment-capture">
                <label className="payment-toggle">
                  <input type="checkbox" checked={includePayment} disabled={isSaving || !anchor} onChange={(event) => togglePayment(event.target.checked)} />
                  <span><CreditCard size={18} aria-hidden="true" /><span><strong>Registrar lo realmente pagado</strong><small>Opcional · conserva monto, moneda y tipo de cambio usados.</small></span></span>
                </label>
                {includePayment && (
                  <div className="form-grid payment-grid">
                    <label>Monto pagado<input required type="number" min="0" step="0.01" value={paidAmount} disabled={isSaving} onChange={(event) => setPaidAmount(event.target.value)} /></label>
                    <label>Moneda pagada<select value={paidCurrency} disabled={isSaving} onChange={(event) => changePaidCurrency(event.target.value)}>{paymentCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
                    <label>Tipo de cambio<input required type="number" min="0.00000001" step="0.00000001" value={exchangeRate} disabled={isSaving || paidCurrency === anchor?.currency} onChange={(event) => setExchangeRate(event.target.value)} /><small>1 {anchor?.currency} = {exchangeRate || "—"} {paidCurrency}</small></label>
                    <label>Fecha del tipo de cambio<input required type="date" value={exchangeRateDate} disabled={isSaving} onChange={(event) => setExchangeRateDate(event.target.value)} /></label>
                    <label>Clase<select value={exchangeRateKind} disabled={isSaving} onChange={(event) => setExchangeRateKind(event.target.value as ExchangeRateKind)}>{Object.entries(exchangeRateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <label>Fuente<input maxLength={200} value={exchangeRateSource} disabled={isSaving} placeholder="Estado de cuenta, BCCR, banco…" onChange={(event) => setExchangeRateSource(event.target.value)} /></label>
                    {expectedPaid !== null && (
                      <p className="payment-preview wide">Conversión de referencia: <strong>{money(paidCurrency, expectedPaid)}</strong>{parsedPaidAmount !== null && Math.abs(parsedPaidAmount - expectedPaid) >= 0.01 ? ` · diferencia real ${money(paidCurrency, parsedPaidAmount - expectedPaid)}` : ""}</p>
                    )}
                    {!paymentValid && <p className="payment-error wide" role="alert">Completá el pago y usá tipo de cambio 1 cuando la moneda original y la pagada sean iguales.</p>}
                  </div>
                )}
              </div>

              <label className="order-notes">Notas<textarea maxLength={1000} value={notes} disabled={isSaving} placeholder="Factura, número de pedido o aclaración del supuesto usado…" onChange={(event) => setNotes(event.target.value)} /></label>
              <div className="purchase-order-total"><span>Subtotal {money(anchor?.currency ?? "CRC", subtotal)} + cargos {money(anchor?.currency ?? "CRC", shipping + otherCharges)}</span><strong>{money(anchor?.currency ?? "CRC", subtotal + shipping + otherCharges)}</strong></div>
              <button className="primary-action" type="submit" disabled={isSaving || !selectedPurchases.length || !manualMatches || !paymentValid}><Save size={18} aria-hidden="true" />{isSaving ? "Guardando orden completa…" : "Guardar orden"}</button>
            </div>
          </form>
        )}

        <div className="purchase-order-list">
          {sortedOrders.length ? sortedOrders.map((order) => {
            const orderItems = items.filter((item) => item.order_id === order.id);
            const payment = payments.find((candidate) => candidate.order_id === order.id);
            return (
              <article key={order.id}>
                <div><span className={`cost-confidence ${order.cost_confidence}`}>{confidenceLabels[order.cost_confidence]}</span><strong>{order.supplier_name}</strong><small>{order.purchased_at} · {orderItems.length} partida{orderItems.length === 1 ? "" : "s"} · {allocationLabels[order.allocation_method]}</small></div>
                <div className="order-cost"><strong>{money(order.currency, order.total_amount)}</strong><small>{money(order.currency, order.shipping_amount + order.other_charges_amount)} en cargos</small>{payment && <small>Pagado: {money(payment.paid_currency, payment.paid_amount)} · {exchangeRateLabels[payment.exchange_rate_kind]}</small>}</div>
              </article>
            );
          }) : <p className="empty-state">Todavía no hay órdenes agrupadas. Tus compras históricas siguen intactas.</p>}
        </div>
      </section>
    </div>
  );
}
