"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  Clock3,
  FileBox,
  FolderKanban,
  PackageCheck,
  Plus,
  Printer,
  Save,
  Trash2,
  TrendingUp,
  X
} from "lucide-react";
import type {
  FilamentRoll,
  PrintProject,
  ProductionRun,
  ProductionRunComponent,
  ProductionRunFilament,
  ProductionRunStatus,
  ProjectComponent,
  ProjectFilamentRequirement
} from "@/lib/types";

export type ProjectCreateValues = {
  name: string;
  description: string;
  version: string;
  license_name: string;
  commercial_use_allowed: boolean;
  estimated_minutes: number | null;
  requirements: Array<{ roll_id: string; planned_grams: number; label: string }>;
  components: Array<{
    name: string;
    unit: string;
    quantity: number;
    unit_cost: number;
    currency: string;
    supplier_name: string;
    notes: string;
  }>;
};

export type ProductionRunValues = {
  project_id: string;
  produced_at: string;
  quantity: number;
  status: ProductionRunStatus;
  actual_minutes: number | null;
  sale_amount: number | null;
  sale_currency: string | null;
  notes: string;
  filaments: Array<{ requirement_id: string; roll_id: string; grams_used: number }>;
  components: Array<{ component_id: string; quantity: number }>;
};

type Props = {
  projects: PrintProject[];
  requirements: ProjectFilamentRequirement[];
  components: ProjectComponent[];
  runs: ProductionRun[];
  runFilaments: ProductionRunFilament[];
  runComponents: ProductionRunComponent[];
  rolls: FilamentRoll[];
  baseCurrency: string;
  mode: "authenticated" | "demo" | "local" | "error";
  isSavingProject: boolean;
  isSavingRun: boolean;
  onClose: () => void;
  onCreateProject: (values: ProjectCreateValues, file: File | null) => Promise<boolean>;
  onCompleteRun: (values: ProductionRunValues) => Promise<boolean>;
  onOpenFile: (project: PrintProject) => Promise<void>;
};

type RequirementDraft = { key: string; roll_id: string; planned_grams: string; label: string };
type ComponentDraft = {
  key: string;
  name: string;
  unit: string;
  quantity: string;
  unit_cost: string;
  currency: string;
  supplier_name: string;
  notes: string;
};

const runStatusLabels: Record<ProductionRunStatus, string> = {
  completed: "Exitosa",
  partial: "Parcial",
  failed: "Fallida"
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function money(currency: string, value: number) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "CRC" ? 0 : 2
  }).format(Number(value));
}

function duration(minutes: number | null) {
  if (minutes == null) return "Sin duración";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!hours) return `${remaining} min`;
  return `${hours} h${remaining ? ` ${remaining} min` : ""}`;
}

function totalsByCurrency(
  filaments: ProductionRunFilament[],
  components: ProductionRunComponent[]
) {
  const totals = new Map<string, number>();
  filaments.forEach((line) => {
    if (line.currency && line.cost_amount != null) {
      totals.set(line.currency, (totals.get(line.currency) ?? 0) + Number(line.cost_amount));
    }
  });
  components.forEach((line) => {
    totals.set(line.currency, (totals.get(line.currency) ?? 0) + Number(line.cost_amount));
  });
  return totals;
}

function ProjectForm({
  rolls,
  baseCurrency,
  isSaving,
  onCancel,
  onCreate
}: {
  rolls: FilamentRoll[];
  baseCurrency: string;
  isSaving: boolean;
  onCancel: () => void;
  onCreate: Props["onCreateProject"];
}) {
  const availableRolls = rolls.filter((roll) => roll.status !== "archived");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("1.0");
  const [licenseName, setLicenseName] = useState("");
  const [commercialUse, setCommercialUse] = useState(false);
  const [estimatedHours, setEstimatedHours] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [requirements, setRequirements] = useState<RequirementDraft[]>([
    { key: "requirement-1", roll_id: availableRolls[0]?.id ?? "", planned_grams: "", label: "" }
  ]);
  const [components, setComponents] = useState<ComponentDraft[]>([]);

  const parsedDuration = Number(estimatedHours || 0) * 60 + Number(estimatedMinutes || 0);
  const validRequirements = requirements.every((item) => item.roll_id && Number(item.planned_grams) > 0);
  const validComponents = components.every((item) => item.name.trim() && Number(item.quantity) > 0 && Number(item.unit_cost || 0) >= 0);
  const validFile = !file || ["stl", "3mf"].includes(file.name.split(".").pop()?.toLowerCase() ?? "");

  function addRequirement() {
    setRequirements((current) => [
      ...current,
      { key: crypto.randomUUID(), roll_id: availableRolls[0]?.id ?? "", planned_grams: "", label: "" }
    ]);
  }

  function addComponent() {
    setComponents((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        name: "",
        unit: "unidad",
        quantity: "1",
        unit_cost: "0",
        currency: baseCurrency,
        supplier_name: "",
        notes: ""
      }
    ]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !validRequirements || !validComponents || !validFile) return;
    const saved = await onCreate({
      name: name.trim(),
      description: description.trim(),
      version: version.trim(),
      license_name: licenseName.trim(),
      commercial_use_allowed: commercialUse,
      estimated_minutes: parsedDuration > 0 ? parsedDuration : null,
      requirements: requirements.map((item) => ({
        roll_id: item.roll_id,
        planned_grams: Number(item.planned_grams),
        label: item.label.trim()
      })),
      components: components.map((item) => ({
        name: item.name.trim(),
        unit: item.unit.trim() || "unidad",
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost || 0),
        currency: item.currency,
        supplier_name: item.supplier_name.trim(),
        notes: item.notes.trim()
      }))
    }, file);
    if (saved) onCancel();
  }

  return (
    <form className="project-form" onSubmit={submit} aria-busy={isSaving}>
      <div className="project-form-head">
        <button type="button" onClick={onCancel} disabled={isSaving}><ChevronLeft size={17} />Volver</button>
        <div><p className="eyebrow">Nueva receta</p><h3>Crear proyecto</h3></div>
      </div>

      <div className="form-grid project-main-fields">
        <label className="wide">Nombre del proyecto<input required maxLength={120} value={name} disabled={isSaving} placeholder="Ej. Dragón articulado grande" onChange={(event) => setName(event.target.value)} /></label>
        <label>Versión<input maxLength={40} value={version} disabled={isSaving} placeholder="1.0" onChange={(event) => setVersion(event.target.value)} /></label>
        <label>Licencia<input maxLength={120} value={licenseName} disabled={isSaving} placeholder="Personal, comercial, CC…" onChange={(event) => setLicenseName(event.target.value)} /></label>
        <label>Horas estimadas<input type="number" min="0" max="1666" value={estimatedHours} disabled={isSaving} placeholder="5" onChange={(event) => setEstimatedHours(event.target.value)} /></label>
        <label>Minutos adicionales<input type="number" min="0" max="59" value={estimatedMinutes} disabled={isSaving} placeholder="30" onChange={(event) => setEstimatedMinutes(event.target.value)} /></label>
        <label className="wide">Descripción<textarea maxLength={1000} value={description} disabled={isSaving} placeholder="Notas de armado, perfil, soportes…" onChange={(event) => setDescription(event.target.value)} /></label>
        <label className="wide project-file-field">Archivo STL o 3MF<input type="file" accept=".stl,.3mf" disabled={isSaving} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><small>Privado · máximo 50 MB. El 3MF conserva más información del laminado.</small>{!validFile && <span>Solo se admiten archivos STL o 3MF.</span>}</label>
        <label className="wide checkbox-field"><input type="checkbox" checked={commercialUse} disabled={isSaving} onChange={(event) => setCommercialUse(event.target.checked)} /><span>La licencia permite uso comercial</span></label>
      </div>

      <section className="project-recipe-section">
        <div className="section-head"><div><p className="eyebrow">Materiales</p><h3>Filamentos de la receta</h3></div><button type="button" onClick={addRequirement} disabled={isSaving || requirements.length >= 32}><Plus size={16} />Filamento</button></div>
        {requirements.map((item, index) => {
          const selected = rolls.find((roll) => roll.id === item.roll_id);
          return (
            <div className="recipe-row filament-recipe-row" key={item.key}>
              <span className="recipe-position">{index + 1}</span>
              <label>Rollo preferido<select required value={item.roll_id} disabled={isSaving} onChange={(event) => setRequirements((current) => current.map((entry) => entry.key === item.key ? { ...entry, roll_id: event.target.value } : entry))}><option value="">Elegí un rollo</option>{availableRolls.map((roll) => <option key={roll.id} value={roll.id}>{roll.color_name} · {roll.material} · {Math.round(Number(roll.available_weight_g))} g</option>)}</select></label>
              <label>Gramos<input required type="number" min="0.01" step="0.01" value={item.planned_grams} disabled={isSaving} placeholder="500" onChange={(event) => setRequirements((current) => current.map((entry) => entry.key === item.key ? { ...entry, planned_grams: event.target.value } : entry))} /></label>
              <label>Uso / pieza<input value={item.label} disabled={isSaving} placeholder="Cuerpo, ojos…" onChange={(event) => setRequirements((current) => current.map((entry) => entry.key === item.key ? { ...entry, label: event.target.value } : entry))} /></label>
              <button className="remove-recipe" type="button" aria-label="Quitar filamento" disabled={isSaving || requirements.length === 1} onClick={() => setRequirements((current) => current.filter((entry) => entry.key !== item.key))}><Trash2 size={16} /></button>
              {selected && Number(item.planned_grams || 0) > Number(selected.available_weight_g) && <small className="recipe-warning">La receta supera el saldo actual de este rollo.</small>}
            </div>
          );
        })}
      </section>

      <section className="project-recipe-section">
        <div className="section-head"><div><p className="eyebrow">Extras</p><h3>Imanes, pines y otros</h3></div><button type="button" onClick={addComponent} disabled={isSaving || components.length >= 64}><Plus size={16} />Insumo</button></div>
        {components.length ? components.map((item, index) => (
          <div className="recipe-row component-recipe-row" key={item.key}>
            <span className="recipe-position">{index + 1}</span>
            <label>Insumo<input required value={item.name} disabled={isSaving} placeholder="Imán 6×2 mm" onChange={(event) => setComponents((current) => current.map((entry) => entry.key === item.key ? { ...entry, name: event.target.value } : entry))} /></label>
            <label>Cantidad<input required type="number" min="0.001" step="0.001" value={item.quantity} disabled={isSaving} onChange={(event) => setComponents((current) => current.map((entry) => entry.key === item.key ? { ...entry, quantity: event.target.value } : entry))} /></label>
            <label>Unidad<input required value={item.unit} disabled={isSaving} placeholder="unidad" onChange={(event) => setComponents((current) => current.map((entry) => entry.key === item.key ? { ...entry, unit: event.target.value } : entry))} /></label>
            <label>Costo por unidad<input required type="number" min="0" step="0.01" value={item.unit_cost} disabled={isSaving} onChange={(event) => setComponents((current) => current.map((entry) => entry.key === item.key ? { ...entry, unit_cost: event.target.value } : entry))} /></label>
            <label>Moneda<select value={item.currency} disabled={isSaving} onChange={(event) => setComponents((current) => current.map((entry) => entry.key === item.key ? { ...entry, currency: event.target.value } : entry))}><option value="CRC">CRC</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
            <label>Proveedor<input value={item.supplier_name} disabled={isSaving} placeholder="Opcional" onChange={(event) => setComponents((current) => current.map((entry) => entry.key === item.key ? { ...entry, supplier_name: event.target.value } : entry))} /></label>
            <button className="remove-recipe" type="button" aria-label="Quitar insumo" disabled={isSaving} onClick={() => setComponents((current) => current.filter((entry) => entry.key !== item.key))}><Trash2 size={16} /></button>
          </div>
        )) : <p className="empty-state">Podés agregar imanes, pines, pintura, luces, empaque o cualquier otro costo.</p>}
      </section>

      <button className="primary-action" type="submit" disabled={isSaving || !availableRolls.length || !name.trim() || !validRequirements || !validComponents || !validFile}>
        <Save size={18} />{isSaving ? "Guardando receta y archivo…" : "Guardar proyecto"}
      </button>
    </form>
  );
}

function ProductionRunForm({
  project,
  requirements,
  components,
  rolls,
  baseCurrency,
  isSaving,
  onCancel,
  onSave
}: {
  project: PrintProject;
  requirements: ProjectFilamentRequirement[];
  components: ProjectComponent[];
  rolls: FilamentRoll[];
  baseCurrency: string;
  isSaving: boolean;
  onCancel: () => void;
  onSave: Props["onCompleteRun"];
}) {
  const [producedAt, setProducedAt] = useState(todayIso());
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<ProductionRunStatus>("completed");
  const [actualMinutes, setActualMinutes] = useState(project.estimated_minutes == null ? "" : String(project.estimated_minutes));
  const [saleAmount, setSaleAmount] = useState("");
  const [saleCurrency, setSaleCurrency] = useState(baseCurrency);
  const [notes, setNotes] = useState("");
  const [usages, setUsages] = useState(() => Object.fromEntries(requirements.map((item) => [item.id, {
    roll_id: item.preferred_roll_id ?? "",
    grams_used: String(Number(item.planned_grams))
  }])));
  const [componentUsage, setComponentUsage] = useState(() => Object.fromEntries(components.map((item) => [item.id, String(Number(item.quantity))])));

  function applyQuantity(nextQuantity: number) {
    const safeQuantity = Math.max(1, nextQuantity || 1);
    setQuantity(safeQuantity);
    setUsages(Object.fromEntries(requirements.map((item) => [item.id, {
      roll_id: usages[item.id]?.roll_id || item.preferred_roll_id || "",
      grams_used: String(Number(item.planned_grams) * safeQuantity)
    }])));
    setComponentUsage(Object.fromEntries(components.map((item) => [item.id, String(Number(item.quantity) * safeQuantity)])));
  }

  const shortageMessages: string[] = [];
  const previewTotals = new Map<string, number>();
  let incompleteCosts = 0;

  requirements.forEach((requirement) => {
    const usage = usages[requirement.id];
    const roll = rolls.find((item) => item.id === usage?.roll_id);
    const grams = Number(usage?.grams_used || 0);
    if (!roll || grams <= 0) {
      shortageMessages.push(`${requirement.color_name}: elegí un rollo y los gramos reales.`);
      return;
    }
    if (grams > Number(roll.available_weight_g)) shortageMessages.push(`${roll.color_name}: faltan ${(grams - Number(roll.available_weight_g)).toLocaleString("es-CR")} g.`);
    if (roll.filament_cost_amount == null || Number(roll.initial_weight_g) <= 0) incompleteCosts += 1;
    else previewTotals.set(roll.currency, (previewTotals.get(roll.currency) ?? 0) + Number(roll.filament_cost_amount) / Number(roll.initial_weight_g) * grams);
  });

  components.forEach((component) => {
    const used = Number(componentUsage[component.id] || 0);
    if (used <= 0) shortageMessages.push(`${component.name}: indicá la cantidad consumida.`);
    else previewTotals.set(component.currency, (previewTotals.get(component.currency) ?? 0) + used * Number(component.unit_cost));
  });

  const parsedSale = saleAmount === "" ? null : Number(saleAmount);
  const comparableCost = previewTotals.size === 1 && previewTotals.has(saleCurrency) && incompleteCosts === 0
    ? previewTotals.get(saleCurrency) ?? null
    : null;
  const profit = parsedSale == null || comparableCost == null ? null : parsedSale - comparableCost;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (shortageMessages.length) return;
    const saved = await onSave({
      project_id: project.id,
      produced_at: producedAt,
      quantity,
      status,
      actual_minutes: actualMinutes === "" ? null : Number(actualMinutes),
      sale_amount: parsedSale,
      sale_currency: parsedSale == null ? null : saleCurrency,
      notes: notes.trim(),
      filaments: requirements.map((item) => ({
        requirement_id: item.id,
        roll_id: usages[item.id].roll_id,
        grams_used: Number(usages[item.id].grams_used)
      })),
      components: components.map((item) => ({
        component_id: item.id,
        quantity: Number(componentUsage[item.id])
      }))
    });
    if (saved) onCancel();
  }

  return (
    <form className="project-form production-run-form" onSubmit={submit} aria-busy={isSaving}>
      <div className="project-form-head"><button type="button" onClick={onCancel} disabled={isSaving}><ChevronLeft size={17} />Volver</button><div><p className="eyebrow">Producción real</p><h3>{project.name}</h3></div></div>
      <div className="form-grid project-main-fields">
        <label>Fecha<input required type="date" value={producedAt} disabled={isSaving} onChange={(event) => setProducedAt(event.target.value)} /></label>
        <label>Cantidad producida<input required type="number" min="1" value={quantity} disabled={isSaving} onChange={(event) => applyQuantity(Number(event.target.value))} /></label>
        <label>Resultado<select value={status} disabled={isSaving} onChange={(event) => setStatus(event.target.value as ProductionRunStatus)}><option value="completed">Exitosa</option><option value="partial">Parcial</option><option value="failed">Fallida / reimpresión</option></select></label>
        <label>Minutos reales<input type="number" min="0" value={actualMinutes} disabled={isSaving} placeholder="300" onChange={(event) => setActualMinutes(event.target.value)} /></label>
      </div>

      <section className="project-recipe-section"><div className="section-head"><div><p className="eyebrow">Consumo real</p><h3>Rollos utilizados</h3></div></div>{requirements.map((requirement) => {
        const usage = usages[requirement.id];
        const candidates = rolls.filter((roll) => roll.status !== "archived" && roll.material === requirement.material);
        return <div className="run-usage-row" key={requirement.id}><span className="mini-swatch" style={{ backgroundColor: requirement.color_hex }} /><div><strong>{requirement.label || requirement.color_name}</strong><small>Receta: {Number(requirement.planned_grams).toLocaleString("es-CR")} g por unidad</small></div><label>Rollo<select value={usage?.roll_id ?? ""} disabled={isSaving} onChange={(event) => setUsages((current) => ({ ...current, [requirement.id]: { ...current[requirement.id], roll_id: event.target.value } }))}><option value="">Elegí un rollo</option>{candidates.map((roll) => <option key={roll.id} value={roll.id}>{roll.color_name} · {Math.round(Number(roll.available_weight_g))} g</option>)}</select></label><label>Gramos reales<input required type="number" min="0.01" step="0.01" value={usage?.grams_used ?? ""} disabled={isSaving} onChange={(event) => setUsages((current) => ({ ...current, [requirement.id]: { ...current[requirement.id], grams_used: event.target.value } }))} /></label></div>;
      })}</section>

      {components.length > 0 && <section className="project-recipe-section"><div className="section-head"><div><p className="eyebrow">Extras reales</p><h3>Insumos consumidos</h3></div></div>{components.map((component) => <div className="run-component-row" key={component.id}><div><strong>{component.name}</strong><small>{money(component.currency, component.unit_cost)} / {component.unit}</small></div><label>Cantidad<input required type="number" min="0.001" step="0.001" value={componentUsage[component.id] ?? ""} disabled={isSaving} onChange={(event) => setComponentUsage((current) => ({ ...current, [component.id]: event.target.value }))} /></label></div>)}</section>}

      <section className="run-cost-preview"><div className="section-head"><div><p className="eyebrow">Vista previa</p><h3>Costo y utilidad</h3></div></div><div className="run-cost-currencies">{Array.from(previewTotals.entries()).map(([currency, total]) => <span key={currency}><small>Costo {currency}</small><strong>{money(currency, total)}</strong></span>)}{!previewTotals.size && <span><small>Costo</small><strong>Incompleto</strong></span>}</div>{incompleteCosts > 0 && <p><AlertTriangle size={15} />{incompleteCosts} filamento{incompleteCosts === 1 ? "" : "s"} sin costo registrado.</p>}<div className="form-grid"><label>Venta total<input type="number" min="0" step="0.01" value={saleAmount} disabled={isSaving} placeholder="Opcional" onChange={(event) => setSaleAmount(event.target.value)} /></label><label>Moneda<select value={saleCurrency} disabled={isSaving || saleAmount === ""} onChange={(event) => setSaleCurrency(event.target.value)}><option value="CRC">CRC</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label></div>{profit != null ? <div className={profit >= 0 ? "profit-preview positive" : "profit-preview negative"}><TrendingUp size={18} /><span>Utilidad estimada</span><strong>{money(saleCurrency, profit)}</strong></div> : parsedSale != null && <p><AlertTriangle size={15} />No mezclamos monedas ni costos incompletos. La utilidad aparecerá cuando todos los costos sean comparables.</p>}</section>

      {shortageMessages.length > 0 && <div className="run-blockers"><strong>No se puede cerrar todavía</strong>{shortageMessages.map((message) => <span key={message}>{message}</span>)}</div>}
      <label className="project-run-notes">Notas<textarea maxLength={1000} value={notes} disabled={isSaving} placeholder="Fallo, desperdicio, observaciones de calidad…" onChange={(event) => setNotes(event.target.value)} /></label>
      <button className="primary-action" type="submit" disabled={isSaving || shortageMessages.length > 0}><PackageCheck size={18} />{isSaving ? "Cerrando corrida sin duplicar…" : "Cerrar corrida y descontar inventario"}</button>
    </form>
  );
}

export function ProjectsModal({
  projects,
  requirements,
  components,
  runs,
  runFilaments,
  runComponents,
  rolls,
  baseCurrency,
  mode,
  isSavingProject,
  isSavingRun,
  onClose,
  onCreateProject,
  onCompleteRun,
  onOpenFile
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [runProjectId, setRunProjectId] = useState("");
  const runProject = projects.find((project) => project.id === runProjectId);
  const sortedProjects = [...projects].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const sortedRuns = [...runs].sort((a, b) => b.produced_at.localeCompare(a.produced_at) || b.created_at.localeCompare(a.created_at));

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSavingProject && !isSavingRun) onClose(); }}>
      <section className="panel modal-panel projects-modal" role="dialog" aria-modal="true" aria-labelledby="projects-title">
        <div className="modal-head"><div><p className="eyebrow">Producción</p><h2 id="projects-title">Proyectos</h2></div><button className="modal-close" type="button" onClick={onClose} disabled={isSavingProject || isSavingRun} aria-label="Cerrar proyectos"><X size={20} /></button></div>
        {mode !== "authenticated" && <p className="project-mode-note">Los proyectos guardados en este modo quedan solamente en este navegador. Iniciá sesión para sincronizar archivos y producción.</p>}

        {showCreate ? (
          <ProjectForm rolls={rolls} baseCurrency={baseCurrency} isSaving={isSavingProject} onCancel={() => setShowCreate(false)} onCreate={onCreateProject} />
        ) : runProject ? (
          <ProductionRunForm project={runProject} requirements={requirements.filter((item) => item.project_id === runProject.id).sort((a, b) => a.position - b.position)} components={components.filter((item) => item.project_id === runProject.id).sort((a, b) => a.position - b.position)} rolls={rolls} baseCurrency={baseCurrency} isSaving={isSavingRun} onCancel={() => setRunProjectId("")} onSave={onCompleteRun} />
        ) : (
          <>
            <div className="project-summary"><article><FolderKanban size={18} /><strong>{projects.length}</strong><span>proyectos</span></article><article><Printer size={18} /><strong>{runs.length}</strong><span>corridas</span></article><article><Boxes size={18} /><strong>{requirements.reduce((sum, item) => sum + Number(item.planned_grams), 0).toLocaleString("es-CR")} g</strong><span>por recetas</span></article><button type="button" onClick={() => setShowCreate(true)} disabled={!rolls.length}><Plus size={18} />Nuevo proyecto</button></div>

            <div className="project-list">
              {sortedProjects.length ? sortedProjects.map((project) => {
                const projectRequirements = requirements.filter((item) => item.project_id === project.id).sort((a, b) => a.position - b.position);
                const projectComponents = components.filter((item) => item.project_id === project.id).sort((a, b) => a.position - b.position);
                const projectRuns = sortedRuns.filter((run) => run.project_id === project.id);
                return <article className="project-card" key={project.id}><div className="project-card-head"><div><span className="project-icon"><FolderKanban size={20} /></span><div><h3>{project.name}</h3><p>{project.version ? `v${project.version} · ` : ""}{duration(project.estimated_minutes)} · {projectRuns.length} corrida{projectRuns.length === 1 ? "" : "s"}</p></div></div><div className="project-card-actions">{project.file_path && <button type="button" onClick={() => void onOpenFile(project)}><FileBox size={16} />{project.file_name || "Archivo"}</button>}<button className="primary" type="button" onClick={() => setRunProjectId(project.id)}><Printer size={16} />Registrar impresión</button></div></div>{project.description && <p className="project-description">{project.description}</p>}<div className="project-recipe-preview">{projectRequirements.map((item) => <span key={item.id}><i style={{ backgroundColor: item.color_hex }} /><strong>{item.label || item.color_name}</strong><small>{Number(item.planned_grams).toLocaleString("es-CR")} g</small></span>)}</div>{projectComponents.length > 0 && <p className="project-components-preview">+ {projectComponents.map((item) => `${Number(item.quantity).toLocaleString("es-CR")} ${item.unit} ${item.name}`).join(" · ")}</p>}{projectRuns.slice(0, 2).map((run) => {
                  const filamentLines = runFilaments.filter((line) => line.run_id === run.id);
                  const componentLines = runComponents.filter((line) => line.run_id === run.id);
                  const totals = totalsByCurrency(filamentLines, componentLines);
                  const incomplete = filamentLines.some((line) => line.cost_amount == null);
                  const comparable = run.sale_amount != null && run.sale_currency && totals.size === 1 && totals.has(run.sale_currency) && !incomplete ? totals.get(run.sale_currency) ?? null : null;
                  return <div className="project-run-row" key={run.id}><span className={`run-status ${run.status}`}>{runStatusLabels[run.status]}</span><div><strong>{run.produced_at} · {run.quantity} unidad{run.quantity === 1 ? "" : "es"}</strong><small>{duration(run.actual_minutes)} · {filamentLines.reduce((sum, line) => sum + Number(line.grams_used), 0).toLocaleString("es-CR")} g</small></div><div className="run-money">{Array.from(totals.entries()).map(([currency, total]) => <span key={currency}>{money(currency, total)}</span>)}{run.sale_amount != null && <strong>Venta {money(run.sale_currency || baseCurrency, run.sale_amount)}</strong>}{comparable != null && <small>Utilidad {money(run.sale_currency || baseCurrency, Number(run.sale_amount) - comparable)}</small>}</div></div>;
                })}</article>;
              }) : <div className="project-empty"><FolderKanban size={34} /><h3>Tu primera receta está lista para nacer</h3><p>Guardá el STL/3MF, los filamentos, gramos, tiempo e insumos que necesita.</p><button className="primary-action" type="button" onClick={() => setShowCreate(true)} disabled={!rolls.length}><Plus size={18} />Crear primer proyecto</button></div>}
            </div>

            {runs.length > 0 && <section className="production-history"><div className="section-head"><div><p className="eyebrow">Histórico</p><h3>Producción reciente</h3></div><span>{runs.length} registros</span></div>{sortedRuns.slice(0, 8).map((run) => <div key={run.id}><span className={`run-status ${run.status}`}>{runStatusLabels[run.status]}</span><strong>{run.project_name}</strong><span>{run.produced_at} · {run.quantity} unidad{run.quantity === 1 ? "" : "es"}</span></div>)}</section>}
          </>
        )}
      </section>
    </div>
  );
}
