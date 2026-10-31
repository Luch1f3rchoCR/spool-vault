"use client";

import type { ReactNode } from "react";
import { defaultLanguage, formatDate, formatNumber, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";
import { ArrowUpRight, FolderKanban, Layers3, Printer, ReceiptText } from "lucide-react";
import type { FilamentRoll, PrintProject, ProductionRun, PurchaseOrder } from "@/lib/types";
import type { WorkspaceSection } from "@/components/app-navigation";

type Props = {
  displayName: string; rolls: FilamentRoll[]; projects: PrintProject[];
  runs: ProductionRun[]; orders: PurchaseOrder[];
  onNavigate: (section: WorkspaceSection) => void;
  inventoryValue?: ReactNode;
  language?: AppLanguage;
};

export function WorkspaceDashboard({ displayName, rolls, projects, runs, orders, onNavigate, inventoryValue, language = defaultLanguage }: Props) {
  const t = (key: MessageKey, values?: Record<string, string | number>) => translate(language, key, values);
  const firstName = displayName.trim().split(/\s+/)[0];
  const activity = [
    ...orders.map(order => ({ id: `purchase:${order.id}`, title: t("dashboard.purchase"), detail: order.supplier_name,
      date: order.created_at || order.purchased_at, section: "purchases" as const, icon: ReceiptText })),
    ...projects.map(project => ({ id: `project:${project.id}`, title: t("dashboard.project"), detail: project.name,
      date: project.created_at, section: "projects" as const, icon: FolderKanban })),
    ...runs.map(run => ({ id: `run:${run.id}`, title: t("dashboard.print"), detail: run.project_name,
      date: run.created_at || run.produced_at, section: "production" as const, icon: Printer })),
    ...rolls.filter(roll => roll.created_at).map(roll => ({ id: `roll:${roll.id}`, title: t("dashboard.filament"), detail: `${roll.brand} · ${roll.color_name}`,
      date: roll.created_at!, section: "inventory" as const, icon: Layers3 }))
  ].sort((a,b) => b.date.localeCompare(a.date)).slice(0,6);
  const activeRolls = rolls.filter(r => r.status !== "archived").length;
  const activeProjects = projects.filter(p => !p.is_archived).length;
  const cards = [
    { section: "inventory" as const, title: t("nav.inventory"), count: activeRolls, detail: t(activeRolls === 1 ? "dashboard.rollOne" : "dashboard.rollMany"), icon: Layers3 },
    { section: "projects" as const, title: t("projects"), count: activeProjects, detail: t(activeProjects === 1 ? "dashboard.recipeOne" : "dashboard.recipeMany"), icon: FolderKanban },
    { section: "production" as const, title: t("nav.production"), count: runs.length, detail: t(runs.length === 1 ? "dashboard.printOne" : "dashboard.printMany"), icon: Printer },
    { section: "purchases" as const, title: t("nav.purchases"), count: orders.length, detail: t(orders.length === 1 ? "dashboard.orderOne" : "dashboard.orderMany"), icon: ReceiptText }
  ];
  return <section className="workspace-dashboard" aria-labelledby="dashboard-title" lang={language}>
    <div className="dashboard-heading"><p className="eyebrow">{t("dashboard.eyebrow")}</p>
      <h1 id="dashboard-title" tabIndex={-1}>{t(firstName ? "dashboard.helloName" : "dashboard.hello", { name: firstName })} <span aria-hidden="true">👋</span></h1>
      <p>{t("dashboard.description")}</p>
    </div>
    {inventoryValue}
    <div className="dashboard-cards">{cards.map(card => <button type="button" key={card.section} className={`dashboard-card dashboard-${card.section}`} onClick={() => onNavigate(card.section)}>
      <span className="dashboard-card-icon"><card.icon size={23} aria-hidden="true" /></span>
      <span><span>{card.title}</span><strong>{formatNumber(card.count, language)}</strong><small>{card.detail}</small></span>
      <ArrowUpRight size={15} aria-hidden="true" />
    </button>)}</div>
    <section className="dashboard-activity" aria-labelledby="activity-title">
      <div className="section-head"><h2 id="activity-title">{t("dashboard.activity")}</h2><span>{t("dashboard.latest")}</span></div>
      {activity.length ? activity.map(item => <button type="button" key={item.id} onClick={() => onNavigate(item.section)}>
        <span className={`activity-icon activity-${item.section}`}><item.icon size={19} aria-hidden="true" /></span>
        <span className="activity-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
        <time dateTime={item.date}>{formatDate(item.date, language, { day: "numeric", month: "short" }) ?? t("dateUnavailable")}</time>
      </button>) : <p className="empty-state">{t("dashboard.empty")}</p>}
    </section>
  </section>;
}

export function ProductionOverview({ runs, onProjects, language = defaultLanguage }: { runs: ProductionRun[]; onProjects: () => void; language?: AppLanguage }) {
  const t = (key: MessageKey, values?: Record<string, string | number>) => translate(language, key, values);
  const labels = { completed: t("production.completed"), partial: t("production.partial"), failed: t("production.failed") };
  return <section className="workspace-dashboard" aria-labelledby="production-heading" lang={language}>
    <div className="hero"><div><p className="eyebrow">{t("nav.workshop")}</p><h1 id="production-heading" tabIndex={-1}>{t("nav.production")}</h1><p>{t("production.description")}</p></div>
      <button className="icon-action" type="button" onClick={onProjects}><Printer size={19} aria-hidden="true" />{t("production.record")}</button></div>
    <p className="form-help">{t("production.help")}</p>
    <div className="dashboard-activity">{runs.length ? [...runs].sort((a,b)=>b.produced_at.localeCompare(a.produced_at)).map(run => <article className="production-summary-row" key={run.id}>
      <Printer size={20} aria-hidden="true" /><div><h2>{run.project_name}</h2><p>{t(Number(run.quantity) === 1 ? "production.unitOne" : "production.unitMany", { quantity: formatNumber(Number(run.quantity), language) })} · {labels[run.status]}{run.actual_minutes != null ? ` · ${t("production.duration", { minutes: formatNumber(run.actual_minutes, language) })}` : ""}</p></div><time dateTime={run.produced_at}>{formatDate(run.produced_at, language, { day: "numeric", month: "short", year: "numeric" }) ?? t("dateUnavailable")}</time>
    </article>) : <p className="empty-state">{t("production.empty")}</p>}</div>
  </section>;
}
