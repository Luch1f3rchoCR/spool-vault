-- Indices para RLS y llaves foraneas del modulo de proyectos.

create index if not exists project_filament_requirements_user_idx
  on public.project_filament_requirements (user_id);
create index if not exists project_components_user_idx
  on public.project_components (user_id);
create index if not exists production_run_filaments_user_idx
  on public.production_run_filaments (user_id);
create index if not exists production_run_filaments_requirement_idx
  on public.production_run_filaments (project_requirement_id);
create index if not exists production_run_components_user_idx
  on public.production_run_components (user_id);
create index if not exists production_run_components_component_idx
  on public.production_run_components (project_component_id);
