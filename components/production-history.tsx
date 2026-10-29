"use client";

import { useEffect, useRef, useState } from "react";
import { ProductionCostBreakdown } from "@/components/production-cost-breakdown";
import type { ProductionRun, ProductionRunComponent, ProductionRunCost, ProductionRunFilament } from "@/lib/types";
import styles from "./production-history.module.css";

const batchSize = 8;
const statusLabels = { completed: "Exitosa", partial: "Parcial", failed: "Fallida" };

// The parent supplies the same chronological order used by the project cards.
export function ProductionHistory({ runs, filaments, components, costs }: {
  runs: ProductionRun[];
  filaments: ProductionRunFilament[];
  components: ProductionRunComponent[];
  costs: ProductionRunCost[];
}) {
  const [visibleLimit, setVisibleLimit] = useState(batchSize);
  const nextBatch = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  const shownCount = Math.min(visibleLimit, runs.length);
  const remaining = runs.length - shownCount;

  useEffect(() => {
    if (pendingFocus.current) {
      nextBatch.current?.querySelector<HTMLElement>("summary")?.focus();
      pendingFocus.current = false;
    }
  }, [visibleLimit]);

  if (!runs.length) return null;

  return <section className="production-history" aria-labelledby="production-history-title">
    <div className="section-head"><div><p className="eyebrow">Histórico</p><h3 id="production-history-title">Historial de producción</h3></div></div>
    <p className={styles.count} role="status">Mostrando {shownCount} de {runs.length} impresiones cargadas.</p>
    {runs.slice(0, visibleLimit).map((run, index) => <div key={run.id} ref={index === visibleLimit - batchSize ? nextBatch : undefined}>
      <span className={`run-status ${run.status}`}>{statusLabels[run.status]}</span>
      <strong>{run.project_name}</strong>
      <span>{run.produced_at} · {run.quantity} unidad{run.quantity === 1 ? "" : "es"}</span>
      <ProductionCostBreakdown run={run} filaments={filaments.filter(line => line.run_id === run.id)} components={components.filter(line => line.run_id === run.id)} operatingCosts={costs.find(cost => cost.run_id === run.id)} />
    </div>)}
    {remaining > 0 && <footer className={styles.actions}>
      <button type="button" onClick={() => { pendingFocus.current = true; setVisibleLimit(limit => limit + batchSize); }}>Ver más impresiones ({Math.min(batchSize, remaining)})</button>
      <span>{remaining} por mostrar</span>
    </footer>}
  </section>;
}
