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
- `public.purchase_history`: historial inmutable de precios y costo por gramo.

The schema uses RLS, authenticated-only access, and explicit grants so the inventory is ready for Supabase Data API access without exposing it publicly.

## Safe writes

- `create_roll_with_purchase`: creates/reuses the supplier, roll and purchase in one transaction.
- `record_consumption`: creates the log and discounts inventory in one transaction.
- Both functions accept a request UUID so browser retries return the original result instead of duplicating data.
- Price history can be selected and inserted by the app, but not updated or deleted directly.
