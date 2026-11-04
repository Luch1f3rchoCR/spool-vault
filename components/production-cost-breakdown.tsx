import { ChevronDown } from "lucide-react";
import { defaultLanguage, formatDate, languageLocale, translate, type AppLanguage } from "@/lib/i18n";
import type { ProductionRun, ProductionRunComponent, ProductionRunCost, ProductionRunFilament } from "@/lib/types";
import styles from "./production-cost-breakdown.module.css";

function amount(currency: string | null, value: number | null, language: AppLanguage) {
  if (!currency || value == null) return translate(language, "production.costs.missing");
  return `${currency} · ${new Intl.NumberFormat(languageLocale(language), { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(Number(value))}`;
}

export function ProductionCostBreakdown({ run, filaments, components, operatingCosts, language = defaultLanguage }: {
  language?: AppLanguage;
  run: ProductionRun;
  filaments: ProductionRunFilament[];
  components: ProductionRunComponent[];
  operatingCosts?: ProductionRunCost;
}) {
  const locale = languageLocale(language);
  const date = language === "es" ? run.produced_at :
    formatDate(run.produced_at, language, { dateStyle: "medium" }) ?? translate(language, "dateUnavailable");
  return <details className={styles.root} lang={language}>
    <summary tabIndex={0} aria-label={translate(language, "production.costs.label", { project: run.project_name, date })}>
      {translate(language, "production.costs.title")} <ChevronDown size={16} aria-hidden="true" />
    </summary>
    <div className={styles.content}>
      <p className={styles.note}>{translate(language, "production.costs.snapshot")}</p>
      <h4>{translate(language, "production.costs.filaments")}</h4>
      {filaments.length ? <dl className={styles.lines}>{filaments.map(line => <div key={line.id}>
        <dt><span>{line.color_name}</span><small>{line.brand} · {line.product_line || line.material} · {Number(line.grams_used).toLocaleString(locale)} g</small></dt>
        <dd>{amount(line.currency, line.cost_amount, language)}</dd>
      </div>)}</dl> : <p className={styles.note}>{translate(language, "production.costs.noFilaments")}</p>}
      <h4>{translate(language, "production.costs.supplies")}</h4>
      {components.length ? <dl className={styles.lines}>{components.map(line => <div key={line.id}>
        <dt><span>{line.name}</span><small>{Number(line.quantity).toLocaleString(locale)} {line.unit}</small></dt>
        <dd>{amount(line.currency, line.cost_amount, language)}</dd>
      </div>)}</dl> : <p className={styles.note}>{translate(language, "production.costs.noSupplies")}</p>}
      <h4>{translate(language, "production.costs.operation")}{operatingCosts?.printer_name ? ` · ${operatingCosts.printer_name}` : ""}</h4>
      {operatingCosts ? <dl className={styles.lines}>
        {([
          [translate(language, "production.costs.electricity"), operatingCosts.electricity_cost_amount],
          [translate(language, "production.costs.machine"), operatingCosts.machine_cost_amount],
          [translate(language, "production.costs.labor"), operatingCosts.labor_cost_amount],
          [translate(language, "production.costs.failure"), operatingCosts.failure_cost_amount]
        ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{amount(operatingCosts.currency, value, language)}</dd></div>)}
      </dl> : <p className={styles.note}>{translate(language, "production.costs.noOperation")}</p>}
      <p className={styles.note}>{translate(language, "production.costs.currencyHelp")}</p>
    </div>
  </details>;
}
