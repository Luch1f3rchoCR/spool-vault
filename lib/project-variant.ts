import type { FilamentRoll, PrintProject, ProjectComponent, ProjectFilamentRequirement } from "@/lib/types";

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

// A variant is a new recipe, never an edit to production or the source project.
// File ownership stays with the source; the user can attach a new file explicitly.
export function createVariantDraft(
  project: PrintProject,
  requirements: ProjectFilamentRequirement[],
  components: ProjectComponent[],
  rolls: FilamentRoll[]
): ProjectCreateValues {
  const availableIds = new Set(rolls.filter((roll) => roll.status !== "archived").map((roll) => roll.id));
  return {
    name: `${project.name.slice(0, 109)} · variante`,
    description: project.description ?? "",
    version: project.version ?? "",
    license_name: project.license_name ?? "",
    commercial_use_allowed: project.commercial_use_allowed,
    estimated_minutes: project.estimated_minutes,
    requirements: requirements.filter((item) => item.project_id === project.id)
      .sort((a, b) => a.position - b.position).map((item) => ({
        roll_id: item.preferred_roll_id && availableIds.has(item.preferred_roll_id) ? item.preferred_roll_id : "",
        planned_grams: Number(item.planned_grams),
        label: item.label ?? ""
      })),
    components: components.filter((item) => item.project_id === project.id)
      .sort((a, b) => a.position - b.position).map((item) => ({
        name: item.name, unit: item.unit, quantity: Number(item.quantity),
        unit_cost: Number(item.unit_cost), currency: item.currency,
        supplier_name: item.supplier_name ?? "", notes: item.notes ?? ""
      }))
  };
}
