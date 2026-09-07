"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Copy, CreditCard, Download, Lightbulb, Mail, RefreshCw, Send, UserPlus, Users, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { FOUNDER_SCOPE, welcomeText } from "@/lib/tester-welcome";

type Membership = {
  id: string; email: string; display_name: string; user_id: string | null;
  plan_code: string; terms_version: string; granted_at: string;
  activated_at: string | null; cancelled_at: string | null;
  country?: string; printers?: string; platform?: string; experience?: string; testing_focus?: string;
};
type Delivery = { membership_id: string; status: "pending" | "sending" | "accepted" | "uncertain" | "review_required"; first_attempt_at: string | null; accepted_at: string | null };
const deliveryLabels = { pending: "Bienvenida pendiente", sending: "Envío por confirmar", accepted: "Bienvenida aceptada para envío", uncertain: "Envío sin confirmar", review_required: "Correo pendiente de revisión" };
class AccountActionError extends Error {}
type Feedback = {
  id: string; user_id: string; kind: "idea" | "bug"; title: string; details: string;
  status: "received" | "reviewing" | "planned" | "resolved";
  admin_reply: string; created_at: string;
};
const statuses = { received: "Recibido", reviewing: "En revisión", planned: "Planeado", resolved: "Resuelto" };
const founderScope = FOUNDER_SCOPE;

export function AccountCommunity({ userId, mode, localData, onBusyChange }: {
  userId: string; mode: "demo" | "local" | "authenticated" | "error";
  localData: Record<string, unknown>; onBusyChange: (busy: boolean) => void;
}) {
  const [view, setView] = useState<"none" | "feedback" | "data" | "admin">("none");
  const [membership, setMembership] = useState<Membership | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(Boolean(userId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState<"idea" | "bug">("idea");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteDetails, setInviteDetails] = useState({ country: "", printers: "", platform: "unspecified", experience: "unspecified", testing_focus: "" });
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [mailConfigured, setMailConfigured] = useState(false);
  const [sendOnSave, setSendOnSave] = useState(true);
  const [inviteReady, setInviteReady] = useState(false);
  const [requestId, setRequestId] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  const connected = Boolean(userId);

  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);

  async function load() {
    const client = getSupabaseClient();
    if (!client || !userId) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const memberResult = await client.rpc("claim_tester_membership");
      if (memberResult.error) throw memberResult.error;
      const adminResult = await client.from("app_admins").select("user_id").eq("user_id", userId).maybeSingle();
      if (adminResult.error) throw adminResult.error;
      const isAdmin = Boolean(adminResult.data);
      const feedbackQuery = client.from("user_feedback").select("*").order("created_at", { ascending: false }).limit(100);
      const feedbackResult = await (isAdmin ? feedbackQuery : feedbackQuery.eq("user_id", userId));
      if (feedbackResult.error) throw feedbackResult.error;
      const membersResult = isAdmin
        ? await client.from("tester_memberships").select("*").order("granted_at", { ascending: false }).limit(100)
        : { data: [], error: null };
      if (membersResult.error) throw membersResult.error;
      let deliveryData: Delivery[] = [];
      let configured = false;
      if (isAdmin) {
        const deliveryResult = await client.from("tester_welcome_deliveries").select("membership_id,status,first_attempt_at,accepted_at");
        if (deliveryResult.error) throw deliveryResult.error;
        deliveryData = deliveryResult.data ?? [];
        const session = await client.auth.getSession();
        if (session.data.session) {
          try {
            const response = await fetch("/api/admin/tester-welcome", { headers: { Authorization: `Bearer ${session.data.session.access_token}` }, cache: "no-store" });
            if (response.ok) configured = (await response.json()).configured === true;
          } catch { configured = false; }
        }
      }
      if (!mounted.current) return;
      setMembership(memberResult.data?.id ? memberResult.data : null);
      setAdmin(isAdmin);
      setFeedback(feedbackResult.data ?? []);
      setMembers(membersResult.data ?? []);
      setDeliveries(deliveryData); setMailConfigured(configured);
    } catch {
      if (mounted.current) setError("No pudimos cargar la membresía y los aportes. Revisá tu conexión y reintentá.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
    // The parent remounts this component when the signed-in account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (cause) {
      const message = cause && typeof cause === "object" && "message" in cause ? String(cause.message) : "";
      setError(cause instanceof AccountActionError || message.startsWith("Llegaste al limite") ? message : "No pudimos confirmar la operación. Podés reintentar; conservamos lo que escribiste.");
    } finally { pending.current = false; setBusy(false); }
  }

  async function sendFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseClient();
    if (!client || !userId) return;
    const id = requestId || crypto.randomUUID();
    setRequestId(id);
    await perform(async () => {
      const { data, error: writeError } = await client.rpc("submit_feedback", {
        p_id: id, p_kind: kind, p_title: title.trim(), p_details: details.trim()
      });
      if (writeError || !data?.id) throw writeError || new Error("missing confirmation");
      setFeedback((current) => [data, ...current.filter((item) => item.id !== data.id)]);
      setTitle(""); setDetails(""); setRequestId("");
      setNotice("Aporte recibido. Podés ver su estado aquí.");
    });
  }

  async function reserve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseClient();
    if (!client || !admin) return;
    await perform(async () => {
      const { data, error: writeError } = await client.rpc("reserve_tester_details", {
        p_email: inviteEmail.trim(), p_name: inviteName.trim(),
        p_country: inviteDetails.country, p_printers: inviteDetails.printers,
        p_platform: inviteDetails.platform, p_experience: inviteDetails.experience, p_testing_focus: inviteDetails.testing_focus
      });
      if (writeError || !data?.id) throw writeError || new Error("missing confirmation");
      setMembers((current) => [data, ...current.filter((item) => item.id !== data.id)]);
      setInviteReady(!data.cancelled_at);
      setNotice(data.cancelled_at ? "Este correo tiene una invitación cancelada." : data.activated_at
        ? "Esta persona ya tiene su membresía activa." : "Acceso reservado. Compartile el enlace de la app para entrar con este correo.");
      if (!data.cancelled_at && mailConfigured && sendOnSave) await sendWelcome(data.id);
    });
  }

  async function sendWelcome(id: string) {
    const session = await getSupabaseClient()!.auth.getSession();
    if (!session.data.session) throw new AccountActionError("Iniciá sesión para enviar la bienvenida.");
    let response: Response;
    try {
      response = await fetch("/api/admin/tester-welcome", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.data.session.access_token}` },
        body: JSON.stringify({ membership_id: id }), signal: AbortSignal.timeout(25000)
      });
    } catch { throw new AccountActionError("La licencia está guardada. No pudimos confirmar el correo; revisá su estado antes de reintentar."); }
    const result = await response.json();
    await load();
    if (!response.ok) throw new AccountActionError(result.error || "No pudimos confirmar el envío de la bienvenida.");
    setNotice(result.already_sent ? "Esta bienvenida ya fue aceptada para envío. No se envió otra." : "Licencia guardada y bienvenida aceptada por el servicio de correo. La entrega al destinatario aún no está confirmada.");
  }

  async function download() {
    await perform(async () => {
      let payload: unknown;
      if (connected) {
        const client = getSupabaseClient();
        if (!client) throw new Error("session missing");
        const { data, error: exportError } = await client.rpc("export_my_data");
        if (exportError || !data || data.user_id !== userId) throw exportError || new Error("session changed");
        payload = data;
      } else {
        if (mode === "error" || mode === "authenticated") throw new Error("account unavailable");
        payload = { format: "spool-vault-account", version: 1, source: mode, exported_at: new Date().toISOString(), includes_binary_files: false, tables: localData };
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `spool-vault-${connected ? "cuenta" : mode}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNotice("Respaldo preparado para descargar.");
    });
  }

  function toggle(next: typeof view) { setView(view === next ? "none" : next); setNotice(""); }
  const ownFeedback = feedback.filter((item) => item.user_id === userId);

  return <div className="account-community" aria-busy={busy}>
    <div className="membership-card">
      <div className="membership-copy"><span className="membership-icon"><CreditCard size={20} aria-hidden="true" /></span><div>
        <p className="eyebrow">Licencia personal</p>
        <h3>{loading ? "Consultando membresía…" : membership?.activated_at ? "Probador fundador" : "Acceso anticipado"}</h3>
        <p>{membership?.activated_at ? "Gratis de por vida · sin vencimiento" : connected ? "Cuenta personal" : "Modo local · sin membresía vinculada"}</p>
      </div></div>
      {membership?.activated_at && <details className="membership-terms"><summary>Qué incluye mi membresía</summary><p>{founderScope}</p><p>Beneficio founder-v1. Los servicios externos y futuros planes adicionales no están incluidos.</p></details>}
    </div>
    {error && <div role="alert" className="account-error"><p>{error}</p><button type="button" onClick={() => void load()} disabled={busy || loading}><RefreshCw size={16} /> Reintentar carga</button></div>}
    {notice && <p role="status" className="account-notice">{notice}</p>}
    <div className="profile-menu" aria-label="Opciones de tu espacio">
      <button type="button" onClick={() => toggle("feedback")} aria-expanded={view === "feedback"} disabled={busy}><Lightbulb size={19} /><span><strong>Compartir una idea</strong><small>Ideas y reportes de errores</small></span><ChevronRight size={18} /></button>
      <button type="button" onClick={() => toggle("data")} aria-expanded={view === "data"} disabled={busy}><Download size={19} /><span><strong>Mis datos</strong><small>Datos personales y respaldo</small></span><ChevronRight size={18} /></button>
      {admin && <button type="button" onClick={() => toggle("admin")} aria-expanded={view === "admin"} disabled={busy}><Users size={19} /><span><strong>Grupo de pruebas</strong><small>{members.filter((m) => m.activated_at).length} activos · {members.filter((m) => !m.activated_at && !m.cancelled_at).length} pendientes</small></span><ChevronRight size={18} /></button>}
    </div>

    {view === "feedback" && <section className="account-section" aria-label="Compartir una idea">
      <h3>Tu aporte</h3>
      {!connected ? <p>Iniciá sesión para enviar ideas y errores al equipo.</p> : <>
        <form onSubmit={sendFeedback}><fieldset disabled={busy || loading}>
          <label>Tipo de aporte<select value={kind} onChange={(event) => { setKind(event.target.value as typeof kind); setRequestId(""); }}><option value="idea">Idea</option><option value="bug">Error</option></select></label>
          <label>Título<input required minLength={4} maxLength={160} value={title} onChange={(event) => { setTitle(event.target.value); setRequestId(""); }} /></label>
          <label>{kind === "bug" ? "Qué pasó y qué esperabas" : "Contanos tu idea"}<textarea required minLength={10} maxLength={5000} rows={5} value={details} onChange={(event) => { setDetails(event.target.value); setRequestId(""); }} /></label>
          <button type="submit" className="primary-action"><Send size={18} />{busy ? "Enviando…" : "Enviar aporte"}</button>
        </fieldset></form>
        <h4>Mis aportes</h4>
        {!ownFeedback.length && <p>Todavía no has enviado aportes.</p>}
        {ownFeedback.map((item) => <FeedbackItem key={item.id} item={item} />)}
      </>}
    </section>}

    {view === "data" && <section className="account-section" aria-label="Mis datos">
      <h3>Mis datos</h3>
      <p>{connected ? "Datos de tu cuenta sincronizada." : mode === "demo" ? "Datos de demostración. No son un inventario sincronizado." : "Datos locales de este navegador."}</p>
      <p>El respaldo JSON incluye inventario, compras, consumos, pesajes, proyectos y perfil. Conserva referencias a fotos y archivos; no incluye los archivos en sí.</p>
      <button type="button" className="primary-action" onClick={() => void download()} disabled={busy || (!connected && mode === "error")}><Download size={18} />{busy ? "Preparando…" : "Descargar mis datos"}</button>
      <p className="form-help">Los datos personales y de facturación se pueden editar en las preferencias de abajo. La restauración automática de este respaldo aún no está disponible.</p>
    </section>}

    {view === "admin" && admin && <section className="account-section" aria-label="Grupo de pruebas">
      <p className="eyebrow">Solo administración</p>
      <h3>Agregar probador</h3>
      <p>{founderScope}</p>
      {!mailConfigured && <p className="account-notice">Envío automático pendiente de configuración. Podés guardar el probador y abrir la bienvenida en tu correo.</p>}
      <form onSubmit={reserve}><fieldset disabled={busy || loading}>
        <label>Nombre<input required minLength={2} maxLength={120} value={inviteName} onChange={(event) => { setInviteName(event.target.value); setInviteReady(false); }} /></label>
        <label>Correo de acceso<input required type="email" maxLength={254} autoCapitalize="none" value={inviteEmail} onChange={(event) => { setInviteEmail(event.target.value); setInviteReady(false); }} /></label>
        <label>País (opcional)<input maxLength={80} value={inviteDetails.country} onChange={(event) => setInviteDetails({ ...inviteDetails, country: event.target.value })} /></label>
        <label>Impresoras (opcional)<input maxLength={300} value={inviteDetails.printers} onChange={(event) => setInviteDetails({ ...inviteDetails, printers: event.target.value })} /></label>
        <label>Dispositivo<select value={inviteDetails.platform} onChange={(event) => setInviteDetails({ ...inviteDetails, platform: event.target.value })}><option value="unspecified">Sin especificar</option><option value="ios">iPhone / iPad</option><option value="android">Android</option><option value="desktop">Computadora</option><option value="mixed">Varios dispositivos</option></select></label>
        <label>Experiencia en impresión 3D<select value={inviteDetails.experience} onChange={(event) => setInviteDetails({ ...inviteDetails, experience: event.target.value })}><option value="unspecified">Sin especificar</option><option value="beginner">Principiante</option><option value="intermediate">Intermedia</option><option value="advanced">Avanzada</option></select></label>
        <label>Qué nos ayudará a probar (opcional)<textarea maxLength={1000} rows={3} value={inviteDetails.testing_focus} onChange={(event) => setInviteDetails({ ...inviteDetails, testing_focus: event.target.value })} /></label>
        {mailConfigured && <label className="account-checkbox"><input type="checkbox" checked={sendOnSave} onChange={(event) => setSendOnSave(event.target.checked)} />Enviar correo de bienvenida al guardar</label>}
        <details className="welcome-preview"><summary>Vista previa del correo de bienvenida</summary><p className="feedback-details">{welcomeText(inviteName.trim(), inviteEmail.trim() || "el correo registrado")}</p></details>
        <button className="primary-action" type="submit"><UserPlus size={18} />{busy ? "Procesando…" : mailConfigured && sendOnSave ? "Guardar y enviar bienvenida" : "Dar acceso gratuito de por vida"}</button>
      </fieldset></form>
      {inviteReady && <button type="button" className="account-copy" disabled={busy} onClick={() => void perform(async () => {
        await navigator.clipboard.writeText("https://spool-vault.vercel.app/");
        setNotice("Enlace copiado. La persona debe entrar con el correo que registraste.");
      })}><Copy size={18} />Copiar enlace de la app</button>}
      <h4>Probadores</h4>
      {!members.length && <p>Todavía no has agregado probadores.</p>}
      {members.map((member) => <article className="account-list-row" key={member.id}>
        <strong>{member.display_name || member.email}</strong><span>{member.email}</span>
        <small>{member.cancelled_at ? "Invitación cancelada" : member.activated_at ? "Activa · gratis de por vida" : "Pendiente de primer ingreso"}</small>
        <small>{[member.country, member.printers].filter(Boolean).join(" · ")}</small>
        {member.testing_focus && <p>{member.testing_focus}</p>}
        <small>{deliveryLabels[deliveries.find((delivery) => delivery.membership_id === member.id)?.status || "pending"]}</small>
        {!member.cancelled_at && <>
          <a className="account-mail-link" href={`mailto:${encodeURIComponent(member.email)}?subject=${encodeURIComponent("Bienvenido a Spool Vault · Probador fundador")}&body=${encodeURIComponent(welcomeText(member.display_name, member.email))}`}><Mail size={16} />Abrir bienvenida en mi correo</a>
          {mailConfigured && <button type="button" disabled={busy || ["accepted", "review_required"].includes(deliveries.find((delivery) => delivery.membership_id === member.id)?.status || "")} onClick={() => void perform(() => sendWelcome(member.id))}><Send size={16} />Enviar bienvenida</button>}
        </>}
        {!member.activated_at && !member.cancelled_at && !deliveries.find((delivery) => delivery.membership_id === member.id)?.first_attempt_at && <button type="button" disabled={busy} title="Cancelar invitación pendiente" onClick={() => void perform(async () => {
          const { error: cancelError } = await getSupabaseClient()!.rpc("cancel_tester_invitation", { p_id: member.id });
          if (cancelError) throw cancelError;
          await load(); setNotice("Invitación pendiente cancelada.");
        })}><X size={16} />Cancelar invitación</button>}
      </article>)}
      <h4>Aportes del grupo</h4>
      <p className="form-help">Últimos 100 aportes. Las respuestas son visibles para su autor.</p>
      {!feedback.length && <p>Todavía no hay aportes.</p>}
      {feedback.map((item) => <FeedbackItem key={item.id} item={item} author={members.find((member) => member.user_id === item.user_id)?.display_name || members.find((member) => member.user_id === item.user_id)?.email}>
        <FeedbackReview key={`${item.id}-${item.status}-${item.admin_reply}`} item={item} disabled={busy} onSave={(status, reply) => perform(async () => {
          const { data, error: reviewError } = await getSupabaseClient()!.from("user_feedback").update({ status, admin_reply: reply }).eq("id", item.id).select("*").single();
          if (reviewError || !data) throw reviewError || new Error("missing confirmation");
          setFeedback((current) => current.map((entry) => entry.id === data.id ? data : entry));
          setNotice("Seguimiento actualizado.");
        })} />
      </FeedbackItem>)}
    </section>}
  </div>;
}

function FeedbackItem({ item, author, children }: { item: Feedback; author?: string; children?: React.ReactNode }) {
  return <article className="account-list-row"><small>{item.kind === "bug" ? "Error" : "Idea"} · {statuses[item.status]} · {new Date(item.created_at).toLocaleDateString("es-CR")}</small>
    {author && <small>{author}</small>}<strong>{item.title}</strong><p className="feedback-details">{item.details}</p>
    {item.admin_reply && <p className="feedback-details"><b>Respuesta: </b>{item.admin_reply}</p>}{children}</article>;
}

function FeedbackReview({ item, disabled, onSave }: { item: Feedback; disabled: boolean; onSave: (status: Feedback["status"], reply: string) => Promise<void> }) {
  const [status, setStatus] = useState(item.status);
  const [reply, setReply] = useState(item.admin_reply);
  return <form onSubmit={(event) => { event.preventDefault(); void onSave(status, reply); }}><fieldset disabled={disabled}>
    <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value as Feedback["status"])}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Respuesta<textarea maxLength={2000} rows={2} value={reply} onChange={(event) => setReply(event.target.value)} /></label>
    <button type="submit"><Send size={16} />Guardar seguimiento</button>
  </fieldset></form>;
}
