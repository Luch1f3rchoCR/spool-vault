# Supabase setup

Applied September 11: local migration `20260910135214_purchase_order_new_filaments.sql` is recorded in production as `20260911173048` (`purchase_order_new_filaments`). Do not reapply it because the timestamps differ. It introduces `create_purchase_order_v3` and its owner-scoped immutable request ledger, composing roll creation and order/payment functions in one transaction. It passed `tests/local-database.cjs` on a fresh isolated test container before application; PR #26 was deployed afterward. Post-DDL checks confirmed RLS, invoker execution, no anonymous function access and no authenticated UPDATE/DELETE on the ledger.

Advisors after this release: no new security warnings; the existing [disabled leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains. Performance reports only [informational unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), including the newly created ledger index. No indexes or authentication settings were changed to silence these notices.

## Local SQL checks (no production connection)

The disposable container must be named spool-vault-sql-test-20260909, labelled app=spool-vault-sql-test, have network mode none, and an empty database. Use PostgreSQL 17 with temporary data storage and no published ports. Run `node tests/local-database.cjs`; the harness refuses an unlabelled or nonempty database.

It installs the minimal Auth/Storage SQL contracts from tests/local-bootstrap.sql, then the base schema and every migration, and tests permissions, rollback, retry and cost preservation. The bootstrap is TEST ONLY and must never be run in Supabase. These tests do not simulate HTTP authentication, email delivery or file storage.

For the existing cloud project, printer_profiles was applied previously. On September 9, printer_cost_safety and tester_first_visit were applied as cloud versions 20260909203554 and 20260909203604. Their local filenames retain their original CLI-generated timestamps. Do not reapply these migrations, the initial printer migration, or the test bootstrap. Post-DDL verification confirmed RLS and restricted function permissions. Advisors reported only the existing disabled leaked-password protection warning and informational unused indexes.

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
- `public.purchase_orders`: encabezados inmutables con proveedor, moneda, envío, otros cargos, método de prorrateo y confianza.
- `public.purchase_order_items`: partidas inmutables que congelan el precio y los cargos asignados por rollo.
- `public.purchase_order_payments`: pago real inmutable con moneda, tipo de cambio, fecha, clase y fuente.
- `public.user_profiles`: moneda base, datos opcionales de facturación y estado de membresía por usuario.
- `public.filament_balance_report`: vista financiera consistente por usuario con saldo, compra, proveedor, spool y valor restante, sin mezclar monedas.

The schema uses RLS, authenticated-only access, and explicit grants so the inventory is ready for Supabase Data API access without exposing it publicly.

## Safe writes

- `create_roll_with_purchase`: creates/reuses the supplier, roll and purchase in one transaction.
- `record_consumption`: creates the log and discounts inventory in one transaction.
- `create_spool` and `update_spool`: create or edit a physical spool with retry-safe request UUIDs.
- `record_roll_weight`: stores the weighing snapshot and updates the roll balance in one transaction.
- `update_filament_roll`: edits the operational roll card without rewriting financial or measurement history.
- `correct_purchase`: appends an audited correction and updates the roll's current cost in one retry-safe transaction.
- `create_purchase_order`: groups existing purchase history into an immutable order and allocates shipping/other charges in one retry-safe transaction.
- `create_purchase_order_v2`: creates the order, items and optional multi-currency payment in one retry-safe transaction.
- `save_user_profile`: upserts the signed-in user's financial preferences without accepting another user's id.
- Deferred database checks keep `filament_rolls.spool_id` and `spools.status` synchronized at commit time; partial assignments are rejected.
- A physical spool can belong to only one roll record at a time, including archived records, and clients cannot directly delete roll or spool history.
- Roll status is derived in the database whenever its weights, low threshold or archive state changes; weight bounds are enforced independently of the client.
- These critical functions accept a request UUID so browser retries return the original result instead of duplicating data.
- Price history can be selected and inserted by the app, but not updated or deleted directly.
- Purchase corrections can be selected and appended through the safe operation, but never updated or deleted.
- Weighing history can be selected and inserted by the safe function, but cannot be updated or deleted by the client.
