export type Supply = {
  id: string; name: string; category: string; unit: string; currency: string;
  quantity: number; unit_cost: number; created_at: string;
};
export type SupplyMovement = {
  id: string; supply_id: string; kind: "receipt" | "adjustment" | "production";
  quantity: number; unit_cost: number; cost_amount: number; reason: string;
  created_at: string; run_id: string | null;
};
export type SupplyValues = {
  supply_id: string | null; name: string; category: string; unit: string; currency: string;
  kind: "receipt" | "adjustment"; quantity: number; unit_cost: number; reason: string;
};
export function normalizeSupply(s: Supply): Supply {
  return { ...s, quantity: Number(s.quantity), unit_cost: Number(s.unit_cost) };
}
export function supplyShortages(components: Array<{id: string; supply_id?: string | null; name: string}>, usage: Record<string,string>, supplies: Supply[]) {
  const totals = new Map<string,number>();
  for (const c of components) if (c.supply_id) totals.set(c.supply_id,(totals.get(c.supply_id) ?? 0)+Number(usage[c.id] || 0));
  return Array.from(totals,([id,quantity]) => {
    const s=supplies.find(item=>item.id===id);
    return !s ? "Un insumo del proyecto no está disponible." : quantity>Number(s.quantity)+0.0000001 ? `${s.name}: necesitás ${quantity} ${s.unit}; disponibles ${s.quantity}.` : "";
  }).filter(Boolean);
}
