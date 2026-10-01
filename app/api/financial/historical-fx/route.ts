import { createClient } from "@supabase/supabase-js";
import {
  isHistoricalFxCurrency,
  isIsoAcquisitionDate,
  resolveBccrObservations
} from "@/lib/historical-fx";

export const dynamic = "force-dynamic";

function respond(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function serverConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
    secret: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    bccrToken: process.env.BCCR_TOKEN
  };
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > 1024) return respond({ error: "Solicitud demasiado grande." }, 413);
    const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
    if (!token) return respond({ error: "Iniciá sesión para continuar." }, 401);
    const config = serverConfig();
    if (!config.url || !config.key) return respond({ error: "La conexión de cuentas no está configurada." }, 503);

    const rawBody = await request.text();
    if (rawBody.length > 1024) return respond({ error: "Solicitud demasiado grande." }, 413);
    let body: { acquisition_date?: unknown; source_currency?: unknown };
    try { body = JSON.parse(rawBody); }
    catch { return respond({ error: "Solicitud inválida." }, 400); }
    if (!isIsoAcquisitionDate(body.acquisition_date) || !isHistoricalFxCurrency(body.source_currency)) {
      return respond({ error: "Fecha o moneda de adquisición inválida." }, 400);
    }

    const userClient = createClient(config.url, config.key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const auth = await userClient.auth.getUser(token);
    if (auth.error || !auth.data.user || !auth.data.user.email_confirmed_at || auth.data.user.is_anonymous) {
      return respond({ error: "La sesión venció. Volvé a iniciar sesión." }, 401);
    }

    const existing = await userClient.from("historical_fx_snapshots").select("*")
      .eq("acquisition_date", body.acquisition_date).eq("source_currency", body.source_currency).maybeSingle();
    if (existing.error) return respond({ error: "No pudimos consultar el tipo de cambio histórico." }, 503);
    if (existing.data) return respond({ snapshot: existing.data, reused: true });

    const required = await userClient.from("filament_inventory_valuation").select("roll_id")
      .eq("acquisition_date", body.acquisition_date).eq("original_currency", body.source_currency)
      .eq("incompleteness_reason", "missing_fx_snapshot").limit(1);
    if (required.error) return respond({ error: "No pudimos comprobar el inventario pendiente." }, 503);
    if (!required.data?.length) return respond({ error: "No hay filamento pendiente que requiera este tipo de cambio." }, 409);
    if (!config.secret || !config.bccrToken) return respond({ error: "El servicio histórico BCCR no está configurado." }, 503);

    let observations;
    try { observations = await resolveBccrObservations(config.bccrToken, body.source_currency, body.acquisition_date); }
    catch { return respond({ error: "BCCR no confirmó el tipo de cambio histórico. No se guardó ninguna estimación." }, 502); }

    const service = createClient(config.url, config.secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const saved = await service.rpc("record_bccr_fx_snapshot", {
      p_user_id: auth.data.user.id,
      p_request_id: crypto.randomUUID(),
      p_acquisition_date: body.acquisition_date,
      p_source_currency: body.source_currency,
      p_indicator_318_effective_date: observations.usdCrc.effectiveDate,
      p_indicator_318_raw_value: observations.usdCrc.rawValue,
      p_indicator_333_effective_date: observations.eurUsd?.effectiveDate ?? null,
      p_indicator_333_raw_value: observations.eurUsd?.rawValue ?? null
    });
    if (saved.error || !saved.data) return respond({ error: "No pudimos guardar el tipo de cambio histórico." }, 503);
    return respond({ snapshot: saved.data, reused: false });
  } catch {
    return respond({ error: "No pudimos resolver el tipo de cambio histórico." }, 503);
  }
}
