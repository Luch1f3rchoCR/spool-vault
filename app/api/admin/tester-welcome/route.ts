import { createClient } from "@supabase/supabase-js";
import { canRetryWelcome, sendWelcomeEmail, welcomePayload } from "@/lib/tester-welcome";

export const dynamic = "force-dynamic";

function respond(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function mailConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.WELCOME_EMAIL_FROM,
    secret: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}

async function administrator(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token) return { response: respond({ error: "Iniciá sesión para continuar." }, 401) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { response: respond({ error: "La conexión de cuentas no está configurada." }, 503) };
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || !data.user.email_confirmed_at || data.user.is_anonymous) return { response: respond({ error: "La sesión venció. Volvé a iniciar sesión." }, 401) };
  const admin = await client.from("app_admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (admin.error) return { response: respond({ error: "No pudimos comprobar los permisos." }, 503) };
  if (!admin.data) return { response: respond({ error: "Solo los administradores pueden enviar invitaciones." }, 403) };
  return { url };
}

export async function GET(request: Request) {
  try {
    const auth = await administrator(request);
    if (auth.response) return auth.response;
    const config = mailConfig();
    return respond({ configured: Boolean(config.apiKey && config.from && config.secret) });
  } catch { return respond({ error: "No pudimos comprobar el servicio de correo." }, 503); }
}

export async function POST(request: Request) {
  try {
    const auth = await administrator(request);
    if (auth.response) return auth.response;
    const config = mailConfig();
    if (!config.apiKey || !config.from || !config.secret) return respond({ error: "El correo de bienvenida aún no está configurado. La licencia permanece guardada." }, 503);
    if (Number(request.headers.get("content-length")) > 1024) return respond({ error: "Solicitud demasiado grande." }, 413);
    const rawBody = await request.text();
    if (rawBody.length > 1024) return respond({ error: "Solicitud demasiado grande." }, 413);
    let body: { membership_id?: unknown };
    try { body = JSON.parse(rawBody); } catch { return respond({ error: "Solicitud inválida." }, 400); }
    if (!body || typeof body.membership_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.membership_id)) return respond({ error: "Invitación inválida." }, 400);
    const service = createClient(auth.url!, config.secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const member = await service.from("tester_memberships").select("id,email,display_name,cancelled_at").eq("id", body.membership_id).maybeSingle();
    if (member.error) return respond({ error: "No pudimos consultar la invitación." }, 503);
    if (!member.data || member.data.cancelled_at) return respond({ error: "La invitación no existe o fue cancelada." }, 409);
    const prepared = await service.rpc("prepare_tester_welcome", { p_id: member.data.id, p_payload: welcomePayload(member.data.display_name, member.data.email, config.from) });
    if (prepared.error || !prepared.data) return respond({ error: "No pudimos preparar el correo. La licencia permanece guardada." }, 503);
    const delivery = prepared.data;
    if (delivery.status === "accepted") return respond({ status: "accepted", already_sent: true });
    if (!canRetryWelcome(delivery.first_attempt_at)) {
      await service.from("tester_welcome_deliveries").update({ status: "review_required" }).eq("membership_id", member.data.id).neq("status", "accepted");
      return respond({ error: "Este envío necesita revisión en el servicio de correo antes de reintentarlo." }, 409);
    }
    let providerId: string;
    try { providerId = await sendWelcomeEmail(member.data.id, delivery.payload, config.apiKey); }
    catch {
      await service.from("tester_welcome_deliveries").update({ status: "uncertain" }).eq("membership_id", member.data.id).neq("status", "accepted");
      return respond({ error: "La licencia está guardada, pero el correo no se pudo confirmar. Podés reintentar el envío." }, 502);
    }
    const saved = await service.from("tester_welcome_deliveries").update({ status: "accepted", provider_message_id: providerId, accepted_at: new Date().toISOString() }).eq("membership_id", member.data.id).select("membership_id").single();
    if (saved.error) return respond({ error: "El servicio aceptó el correo, pero falta confirmar el registro. Reintentá para recuperarlo." }, 503);
    return respond({ status: "accepted", already_sent: false });
  } catch { return respond({ error: "No pudimos completar la operación. Revisá el estado antes de reintentar." }, 503); }
}
