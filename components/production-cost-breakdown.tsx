import { ChevronDown } from "lucide-react";
import type { ProductionRun, ProductionRunComponent, ProductionRunCost, ProductionRunFilament } from "@/lib/types";
import styles from "./production-cost-breakdown.module.css";

function amount(currency: string | null, value: number | null) {
  if (!currency || value == null) return "Sin costo registrado";
  return `${currency} · ${new Intl.NumberFormat("es-CR", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(Number(value))}`;
}

export function ProductionCostBreakdown({ run, filaments, components, operatingCosts }: {
  run: ProductionRun;
  filaments: ProductionRunFilament[];
  components: ProductionRunComponent[];
  operatingCosts?: ProductionRunCost;
}) {
  return <details className={styles.root}>
    <summary tabIndex={0} aria-label={`Ver desglose de costos: ${run.project_name}, ${run.produced_at}`}>
      Ver desglose de costos <ChevronDown size={16} aria-hidden="true" />
    </summary>
    <div className={styles.content}>
      <p className={styles.note}>Costos guardados al registrar esta impresión. No se recalculan con los precios o tarifas actuales.</p>
      <h4>Filamentos</h4>
      {filaments.length ? <dl className={styles.lines}>{filaments.map(line => <div key={line.id}>
        <dt><span>{line.color_name}</span><small>{line.brand} · {line.product_line || line.material} · {Number(line.grams_used).toLocaleString("es-CR")} g</small></dt>
        <dd>{amount(line.currency, line.cost_amount)}</dd>
      </div>)}</dl> : <p className={styles.note}>Sin consumos de filamento registrados.</p>}
      <h4>Insumos y extras</h4>
      {components.length ? <dl className={styles.lines}>{components.map(line => <div key={line.id}>
        <dt><span>{line.name}</span><small>{Number(line.quantity).toLocaleString("es-CR")} {line.unit}</small></dt>
        <dd>{amount(line.currency, line.cost_amount)}</dd>
      </div>)}</dl> : <p className={styles.note}>Sin insumos ni extras registrados.</p>}
      <h4>Operación{operatingCosts?.printer_name ? ` · ${operatingCosts.printer_name}` : ""}</h4>
      {operatingCosts ? <dl className={styles.lines}>
        {([
          ["Electricidad", operatingCosts.electricity_cost_amount],
          ["Uso de máquina", operatingCosts.machine_cost_amount],
          ["Mano de obra", operatingCosts.labor_cost_amount],
          ["Fallos y desperdicio", operatingCosts.failure_cost_amount]
        ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{amount(operatingCosts.currency, value)}</dd></div>)}
      </dl> : <p className={styles.note}>Esta impresión no tiene costos operativos registrados.</p>}
      <p className={styles.note}>Cada importe conserva su moneda original. Un costo sin registrar no equivale a cero.</p>
    </div>
  </details>;
}
