# Supabase setup

1. Create a Supabase project.
2. In the SQL editor, run `supabase/schema.sql` for a new installation.
3. Apply every file in `supabase/migrations/` in version order. Production migrations are also tracked in Supabase.
4. Create a user in Supabase Auth and sign in from the app once auth is added.
5. Copy `.env.example` to `.env.local` and replace the placeholders with your project values:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

## Tables ChatGPT can query later

- `public.filament_rolls`: current inventory by roll.
- `public.consumption_logs`: project consumption history.
- `public.low_filament_rolls`: rollos bajos or agotados.
- `public.filament_inventory_summary`: summary by user and material.
- `public.suppliers`: proveedores propios del usuario.
- `public.spools`: spools reutilizables, tara y estado.
- `public.spool_types`: catálogo global o propio de modelos de spool, componentes de tara, fuente y confianza.
- `public.weighing_events`: historial inmutable por rollo con peso bruto, tara aplicada y saldo calculado.
- `public.purchase_history`: historial inmutable de precios y costo por gramo.
- `public.purchase_corrections`: revisiones inmutables con motivo y valores corregidos; el original nunca se reemplaza.

The schema uses RLS, authenticated-only access, and explicit grants so the inventory is ready for Supabase Data API access without exposing it publicly.

## Safe writes

- `create_roll_with_purchase`: creates/reuses the supplier, roll and purchase in one transaction.
- `record_consumption`: creates the log and discounts inventory in one transaction.
- `create_spool` and `update_spool`: create or edit a physical spool with retry-safe request UUIDs.
- `record_roll_weight`: stores the weighing snapshot and updates the roll balance in one transaction.
- `update_filament_roll`: edits the operational roll card without rewriting financial or measurement history.
- `correct_purchase`: appends an audited correction and updates the roll's current cost in one retry-safe transaction.
- These critical functions accept a request UUID so browser retries return the original result instead of duplicating data.
- Price history can be selected and inserted by the app, but not updated or deleted directly.
- Purchase corrections can be selected and appended through the safe operation, but never updated or deleted.
- Weighing history can be selected and inserted by the safe function, but cannot be updated or deleted by the client.
