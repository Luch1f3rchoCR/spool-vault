"use client";

import { ArrowUpRight, FolderKanban, Layers3, Printer, ReceiptText } from "lucide-react";
import type { FilamentRoll, PrintProject, ProductionRun, PurchaseOrder } from "@/lib/types";
import type { WorkspaceSection } from "@/components/app-navigation";

type Props = {
  displayName: string; rolls: FilamentRoll[]; projects: PrintProject[];
  runs: ProductionRun[]; orders: PurchaseOrder[];
  onNavigate: (section: WorkspaceSection) => void;
};

export function WorkspaceDashboard({ displayName, rolls, projects, runs, orders, onNavigate }: Props) {
  const activity = [
    ...orders.map(order => ({ id: `purchase:${order.id}`, title: "Compra registrada", detail: order.supplier_name,
      date: order.created_at || order.purchased_at, section: "purchases" as const, icon: ReceiptText })),
    ...projects.map(project => ({ id: `project:${project.id}`, title: "Proyecto guardado", detail: project.name,
      date: project.created_at, section: "projects" as const, icon: FolderKanban })),
    ...runs.map(run => ({ id: `run:${run.id}`, title: "Impresión registrada", detail: run.project_name,
      date: run.created_at || run.produced_at, section: "production" as const, icon: Printer })),
    ...rolls.filter(roll => roll.created_at).map(roll => ({ id: `roll:${roll.id}`, title: "Filamento agregado", detail: `${roll.brand} · ${roll.color_name}`,
      date: roll.created_at!, section: "inventory" as const, icon: Layers3 }))
  ].sort((a,b) => b.date.localeCompare(a.date)).slice(0,6);
  const cards = [
    { section: "inventory" as const, title: "Inventario", count: rolls.filter(r => r.status !== "archived").length, detail: "rollos activos", icon: Layers3 },
    { section: "projects" as const, title: "Proyectos", count: projects.filter(p => !p.is_archived).length, detail: "recetas guardadas", icon: FolderKanban },
    { section: "production" as const, title: "Producción", count: runs.length, detail: "impresiones registradas", icon: Printer },
    { section: "purchases" as const, title: "Compras", count: orders.length, detail: "órdenes registradas", icon: ReceiptText }
  ];
  return <section className="workspace-dashboard" aria-labelledby="dashboard-title">
    <div className="dashboard-heading"><p className="eyebrow">Tu taller, en orden</p>
      <h1 id="dashboard-title" tabIndex={-1}>Hola{displayName.trim() ? `, ${displayName.trim().split(/\s+/)[0]}` : ""} <span aria-hidden="true">👋</span></h1>
      <p>Todo lo importante de tu taller, en un solo lugar.</p>
    </div>
    <div className="dashboard-cards">{cards.map(card => <button type="button" key={card.section} className={`dashboard-card dashboard-${card.section}`} onClick={() => onNavigate(card.section)}>
      <span className="dashboard-card-icon"><card.icon size={23} aria-hidden="true" /></span>
      <span><span>{card.title}</span><strong>{card.count}</strong><small>{card.detail}</small></span>
      <ArrowUpRight size={15} aria-hidden="true" />
    </button>)}</div>
    <section className="dashboard-activity" aria-labelledby="activity-title">
      <div className="section-head"><h2 id="activity-title">Actividad reciente</h2><span>Últimos registros</span></div>
      {activity.length ? activity.map(item => <button type="button" key={item.id} onClick={() => onNavigate(item.section)}>
        <span className={`activity-icon activity-${item.section}`}><item.icon size={19} aria-hidden="true" /></span>
        <span className="activity-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
        <time dateTime={item.date}>{new Date(item.date).toLocaleDateString("es-CR",{day:"numeric",month:"short"})}</time>
      </button>) : <p className="empty-state">Tu actividad aparecerá acá cuando registres compras, filamentos, proyectos o impresiones.</p>}
    </section>
  </section>;
}

export function ProductionOverview({ runs, onProjects }: { runs: ProductionRun[]; onProjects: () => void }) {
  const labels = { completed: "Exitosa", partial: "Parcial", failed: "Fallida" };
  return <section className="workspace-dashboard" aria-labelledby="production-heading">
    <div className="hero"><div><p className="eyebrow">Tu taller</p><h1 id="production-heading" tabIndex={-1}>Producción</h1><p>Impresiones registradas y resultados reales.</p></div>
      <button className="icon-action" type="button" onClick={onProjects}><Printer size={19} />Registrar impresión</button></div>
    <p className="form-help">Elegí un proyecto para registrar una impresión realizada. Esto no envía trabajos a una impresora.</p>
    <div className="dashboard-activity">{runs.length ? [...runs].sort((a,b)=>b.produced_at.localeCompare(a.produced_at)).map(run => <article className="production-summary-row" key={run.id}>
      <Printer size={20} aria-hidden="true" /><div><h2>{run.project_name}</h2><p>{run.quantity} unidad{Number(run.quantity) === 1 ? "" : "es"} · {labels[run.status]}{run.actual_minutes != null ? ` · ${run.actual_minutes} min` : ""}</p></div><time>{run.produced_at}</time>
    </article>) : <p className="empty-state">Todavía no hay impresiones registradas. Tus recetas se conservan en Proyectos.</p>}</div>
  </section>;
}
