"use client";

import { useEffect, useRef, useState } from "react";
import { ProductionCostBreakdown } from "@/components/production-cost-breakdown";
import { defaultLanguage, formatDate, languageLocale, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";
import type { ProductionRun, ProductionRunComponent, ProductionRunCost, ProductionRunFilament } from "@/lib/types";
import styles from "./production-history.module.css";

const batchSize = 8;

// The parent supplies the same chronological order used by the project cards.
export function ProductionHistory({ runs, filaments, components, costs, language = defaultLanguage }: {
  language?: AppLanguage;
  runs: ProductionRun[];
  filaments: ProductionRunFilament[];
  components: ProductionRunComponent[];
  costs: ProductionRunCost[];
}) {
  const t = (key: MessageKey, values?: Readonly<Record<string, string | number>>) => translate(language, key, values);
  const locale = languageLocale(language);
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

  return <section className="production-history" lang={language} aria-labelledby="production-history-title">
    <div className="section-head"><div><p className="eyebrow">{t("production.history.eyebrow")}</p><h3 id="production-history-title">{t("production.history.title")}</h3></div></div>
    <p className={styles.count} role="status">{t("production.history.showing", { shown: shownCount.toLocaleString(locale), total: runs.length.toLocaleString(locale) })}</p>
    {runs.slice(0, visibleLimit).map((run, index) => <div key={run.id} ref={index === visibleLimit - batchSize ? nextBatch : undefined}>
      <span className={`run-status ${run.status}`}>{t(`production.${run.status}`)}</span>
      <strong>{run.project_name}</strong>
      <span>
        {language === "es" ? run.produced_at : formatDate(run.produced_at, language, { dateStyle: "medium" }) ?? t("dateUnavailable")}
        {" · "}
        {t(Number(run.quantity) === 1 ? "production.unitOne" : "production.unitMany", { quantity: Number(run.quantity).toLocaleString(locale) })}
      </span>
      <ProductionCostBreakdown language={language} run={run} filaments={filaments.filter(line => line.run_id === run.id)} components={components.filter(line => line.run_id === run.id)} operatingCosts={costs.find(cost => cost.run_id === run.id)} />
    </div>)}
    {remaining > 0 && <footer className={styles.actions}>
      <button type="button" onClick={() => { pendingFocus.current = true; setVisibleLimit(limit => limit + batchSize); }}>{t("production.history.showMore", { count: Math.min(batchSize, remaining) })}</button>
      <span>{t("production.history.remaining", { count: remaining.toLocaleString(locale) })}</span>
    </footer>}
  </section>;
}
