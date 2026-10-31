"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Copy, CreditCard, Download, Lightbulb, Mail, RefreshCw, Send, UserPlus, Users, X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { APP_URL, FOUNDER_SCOPE, WELCOME_SUBJECT, welcomeText } from "@/lib/tester-welcome";
import { formatDate, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";
import type { ProfileView } from "@/components/profile-panel";

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
const statuses = { received: "account.received", reviewing: "account.reviewing", planned: "account.planned", resolved: "account.resolved" } as const;
type AccountMessage = { key: MessageKey } | { original: string };
const founderScope = FOUNDER_SCOPE;

export function AccountCommunity({ language = "es", userId, mode, localData, onBusyChange, view, onNavigate }: {
  language?: AppLanguage;
  userId: string; mode: "demo" | "local" | "authenticated" | "error";
  localData: Record<string, unknown>; onBusyChange: (busy: boolean) => void;
  view: ProfileView; onNavigate: (view: ProfileView) => void;
}) {
  const t = (key: MessageKey) => translate(language, key);
  const showMessage = (message: AccountMessage) => "key" in message ? t(message.key) : <>
    {language === "en" && <>{t("account.originalMessage")} </>}
    <span lang="">{message.original}</span>
  </>;
  const [membership, setMembership] = useState<Membership | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(Boolean(userId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountMessage | null>(null);
  const [notice, setNotice] = useState<AccountMessage | null>(null);
  const [kind, setKind] = useState<"idea" | "bug">("idea");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteReason, setInviteReason] = useState("");
  const [expectedFocus, setExpectedFocus] = useState("");
  const [inviteNotes, setInviteNotes] = useState<Array<{ membership_id: string; reason: string; expected_focus: string }>>([]);
  const [firstVisits, setFirstVisits] = useState<Array<{ membership_id: string; answers: { display_name: string; country: string; experience: string; usage: string; purpose: string; platform: string; printers: Array<{ name: string; manufacturer: string; model: string }> } }>>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [mailConfigured, setMailConfigured] = useState(false);
  const [sendOnSave, setSendOnSave] = useState(true);
  const [inviteReady, setInviteReady] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ id: string; message: string } | null>(null);
  const inviteResultRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [requestId, setRequestId] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  const connected = Boolean(userId);

  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);

  async function load() {
    const client = getSupabaseClient();
    if (!client || !userId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
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
      const notesResult = isAdmin ? await client.from("tester_invitation_notes").select("*") : { data: [], error: null };
      const visitsResult = isAdmin ? await client.from("tester_first_visits").select("membership_id,answers") : { data: [], error: null };
      if (notesResult.error || visitsResult.error) throw notesResult.error || visitsResult.error;
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
      setInviteNotes(notesResult.data ?? []);
      setFirstVisits(visitsResult.data ?? []);
      setDeliveries(deliveryData); setMailConfigured(configured);
    } catch {
      if (mounted.current) setError({ key: "account.loadError" });
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
    setBusy(true); setError(null); setNotice(null); setInviteResult(null);
    try { await action(); }
    catch (cause) {
      const message = cause && typeof cause === "object" && "message" in cause ? String(cause.message) : "";
      setError(cause instanceof AccountActionError || message.startsWith("Llegaste al limite") ? { original: message } : { key: "account.operationError" });
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
      setNotice({ key: "account.receivedNotice" });
    });
  }

  async function reserve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseClient();
    if (!client || !admin) return;
    await perform(async () => {
      const { data, error: writeError } = await client.rpc("reserve_tester_invitation", {
        p_email: inviteEmail.trim(), p_name: inviteName.trim(),
        p_reason: inviteReason.trim(), p_expected_focus: expectedFocus.trim()
      });
      if (writeError || !data?.id) throw writeError || new Error("missing confirmation");
      setMembers((current) => [data, ...current.filter((item) => item.id !== data.id)]);
      setInviteReady(!data.cancelled_at);
      if (data.cancelled_at) {
        throw new AccountActionError("Este correo tiene una invitación cancelada. No se envió una bienvenida.");
      }
      let message = data.activated_at
        ? "Esta persona ya tiene su membresía activa."
        : "Invitación guardada. No se envió un correo; podés compartir la bienvenida desde esta ficha.";
      if (mailConfigured && sendOnSave) message = await sendWelcome(data.id);
      // Only clear the draft after the requested reservation/send is confirmed.
      // An uncertain send keeps the entered values and the saved membership.
      setInviteName(""); setInviteEmail(""); setInviteReason(""); setExpectedFocus("");
      setNotice(null);
      setInviteResult({ id: data.id, message });
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
    if (!response.ok || result.status !== "accepted") throw new AccountActionError(result.error || "La invitación está guardada, pero no pudimos confirmar el envío de la bienvenida.");
    const message = result.already_sent ? "Esta bienvenida ya fue aceptada para envío. No se envió otra." : "Invitación guardada y bienvenida aceptada por el servicio de correo. La entrega al destinatario aún no está confirmada.";
    setNotice({ original: message });
    return message;
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
      setNotice({ key: "account.exportReady" });
    });
  }

  useEffect(() => { setNotice(null); setInviteResult(null); }, [view]);
  useEffect(() => {
    if (busy || view !== "admin") return;
    const target = error ? errorRef.current : inviteResult ? inviteResultRef.current : null;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [busy, error, inviteResult, view]);
  const ownFeedback = feedback.filter((item) => item.user_id === userId);

  return <div className="account-community" lang={language} aria-busy={busy} hidden={view === "preferences" || view === "production" || view === "printers"}>
    <div className="membership-card" hidden={view !== "home"}>
      <div className="membership-copy"><span className="membership-icon"><CreditCard size={20} aria-hidden="true" /></span><div>
        <p className="eyebrow">{t("account.license")}</p>
        <h3>{loading ? t("account.loading") : membership?.activated_at ? t("account.founder") : t("account.early")}</h3>
        <p>{membership?.activated_at ? t("account.lifetime") : connected ? t("account.personal") : t("account.local")}</p>
      </div></div>
      {membership?.activated_at && <details className="membership-terms"><summary>{t("account.terms")}</summary>{language === "en" && <p>{t("account.termsLanguage")}</p>}<p lang="es">{founderScope}</p><p lang="es">Beneficio founder-v1. Los servicios externos y futuros planes adicionales no están incluidos.</p></details>}
    </div>
    {error && <div ref={errorRef} tabIndex={-1} role="alert" className="account-error"><p>{showMessage(error)}</p><button type="button" onClick={() => void load()} disabled={busy || loading}><RefreshCw size={16} /> {t("account.retry")}</button></div>}
    {notice && <p role="status" className="account-notice">{showMessage(notice)}</p>}
    <nav className="profile-menu" aria-label={t("account.options")} hidden={view !== "home"}>
      <button type="button" onClick={() => onNavigate("feedback")} disabled={busy}><Lightbulb size={19} /><span><strong>{t("profile.feedback")}</strong><small>{t("account.feedbackHelp")}</small></span><ChevronRight size={18} /></button>
      <button type="button" onClick={() => onNavigate("data")} disabled={busy}><Download size={19} /><span><strong>{t("profile.data")}</strong><small>{t("account.dataHelp")}</small></span><ChevronRight size={18} /></button>
      {admin && <button lang="es" type="button" onClick={() => onNavigate("admin")} disabled={busy}><Users size={19} /><span><strong>Grupo de pruebas</strong><small>{members.filter((m) => m.activated_at).length} activos · {members.filter((m) => !m.activated_at && !m.cancelled_at).length} pendientes</small></span><ChevronRight size={18} /></button>}
    </nav>

    {view === "feedback" && <section className="account-section" aria-label={t("profile.feedback")}>
      <h3>{t("account.contribution")}</h3>
      {!connected ? <p>{t("account.signInFeedback")}</p> : <>
        <form onSubmit={sendFeedback}><fieldset disabled={busy || loading}>
          <label>{t("account.kind")}<select value={kind} onChange={(event) => { setKind(event.target.value as typeof kind); setRequestId(""); }}><option value="idea">{t("account.idea")}</option><option value="bug">{t("account.bug")}</option></select></label>
          <label>{t("account.title")}<input required minLength={4} maxLength={160} value={title} onChange={(event) => { setTitle(event.target.value); setRequestId(""); }} /></label>
          <label>{kind === "bug" ? t("account.bugDetails") : t("account.ideaDetails")}<textarea required minLength={10} maxLength={5000} rows={5} value={details} onChange={(event) => { setDetails(event.target.value); setRequestId(""); }} /></label>
          <button type="submit" className="primary-action"><Send size={18} />{busy ? t("account.sending") : t("account.send")}</button>
        </fieldset></form>
        <h4>{t("account.ownFeedback")}</h4>
        {!ownFeedback.length && <p>{t("account.noFeedback")}</p>}
        {ownFeedback.map((item) => <FeedbackItem key={item.id} item={item} language={language} />)}
      </>}
    </section>}

    {view === "data" && <section className="account-section" aria-label={t("profile.data")}>
      <h3>{t("profile.data")}</h3>
      <p>{connected ? t("account.syncedData") : mode === "demo" ? t("account.demoData") : t("account.localData")}</p>
      <p>{t("account.exportHelp")}</p>
      <button type="button" className="primary-action" onClick={() => void download()} disabled={busy || (!connected && mode === "error")}><Download size={18} />{busy ? t("account.preparing") : t("account.download")}</button>
      <p className="form-help">{t("account.restoreHelp")}</p>
      <button type="button" onClick={() => onNavigate("preferences")} disabled={busy}><CreditCard size={18} />{t("account.editProfile")}<ChevronRight size={18} /></button>
    </section>}

    {view === "admin" && admin && <section className="account-section" lang="es" aria-label="Grupo de pruebas">
      <p className="eyebrow">Solo administración</p>
      <h3>Agregar probador</h3>
      <p>{founderScope}</p>
      {!mailConfigured && <p className="account-notice">Envío automático pendiente de configuración. Podés guardar el probador y abrir la bienvenida en tu correo.</p>}
      <form onSubmit={reserve}><fieldset disabled={busy || loading}>
        <label>Nombre<input required minLength={2} maxLength={120} value={inviteName} onChange={(event) => { setInviteName(event.target.value); setInviteReady(false); }} /></label>
        <label>Correo de acceso<input required type="email" maxLength={254} autoCapitalize="none" value={inviteEmail} onChange={(event) => { setInviteEmail(event.target.value); setInviteReady(false); }} /></label>
        <label>Por qué invitamos a esta persona<input required minLength={3} maxLength={1000} value={inviteReason} onChange={(event) => setInviteReason(event.target.value)} /></label>
        <label>Qué nos gustaría que pruebe (opcional)<textarea maxLength={1000} rows={3} value={expectedFocus} onChange={(event) => setExpectedFocus(event.target.value)} /></label>
        <p className="form-help">Estas notas son solo para administración. La persona completará su experiencia, uso e impresoras al activar el acceso por primera vez. Repetir un correo recupera la invitación original sin cambiar sus notas.</p>
        {mailConfigured && <label className="account-checkbox"><input type="checkbox" checked={sendOnSave} onChange={(event) => setSendOnSave(event.target.checked)} />Enviar correo de bienvenida al guardar</label>}
        <details className="welcome-preview"><summary>Vista previa del correo de bienvenida</summary><p className="feedback-details">{welcomeText(inviteName.trim(), inviteEmail.trim() || "el correo registrado")}</p></details>
        <button className="primary-action" type="submit"><UserPlus size={18} />{busy ? "Procesando…" : mailConfigured && sendOnSave ? "Guardar y enviar bienvenida" : "Dar acceso gratuito de por vida"}</button>
      </fieldset></form>
      {inviteReady && <button type="button" className="account-copy" disabled={busy} onClick={() => void perform(async () => {
        await navigator.clipboard.writeText(APP_URL);
        setNotice({ original: "Enlace copiado. La persona debe entrar con el correo que registraste." });
      })}><Copy size={18} />Copiar enlace de la app</button>}
      <h4>Probadores</h4>
      {!members.length && <p>Todavía no has agregado probadores.</p>}
      {members.map((member) => <article className="account-list-row" key={member.id}
        ref={inviteResult?.id === member.id ? inviteResultRef : undefined}
        tabIndex={inviteResult?.id === member.id ? -1 : undefined}
        aria-label={`Invitación de ${member.display_name || member.email}`}>
        {inviteResult?.id === member.id && <p role="status" className="account-notice">{inviteResult.message}</p>}
        <strong>{member.display_name || member.email}</strong><span>{member.email}</span>
        <small>{member.cancelled_at ? "Invitación cancelada" : member.activated_at ? "Activa · gratis de por vida" : "Pendiente de primer ingreso"}</small>
        <small>{[member.country, member.printers].filter(Boolean).join(" · ")}</small>
        {member.testing_focus && <p>Referencia de la invitación anterior: {member.testing_focus}</p>}
        {inviteNotes.filter((note) => note.membership_id === member.id).map((note) => <div key={note.membership_id}><p><strong>Motivo:</strong> {note.reason}</p>{note.expected_focus && <p><strong>Pruebas previstas:</strong> {note.expected_focus}</p>}</div>)}
        {firstVisits.filter((visit) => visit.membership_id === member.id).map(({ answers }) => <details key={member.id}><summary>Respuestas del primer ingreso</summary>
          <p>{answers.display_name} · {answers.country || "País no indicado"}</p>
          <p>Experiencia: {({ beginner: "Principiante", intermediate: "Intermedia", advanced: "Avanzada" } as Record<string, string>)[answers.experience] || answers.experience}</p>
          <p>Uso: {({ hobby: "Hobby", professional: "Profesional", both: "Hobby y profesional" } as Record<string, string>)[answers.usage] || answers.usage}</p>
          <p>{answers.purpose}</p><p>Dispositivo: {answers.platform}</p>
          <p>Impresoras al ingresar: {answers.printers.map((printer) => [printer.name, printer.manufacturer, printer.model].filter(Boolean).join(" · ")).join("; ") || "Sin impresoras"}</p>
        </details>)}
        <small>{deliveryLabels[deliveries.find((delivery) => delivery.membership_id === member.id)?.status || "pending"]}</small>
        {!member.cancelled_at && <>
          <a className="account-mail-link" href={`mailto:${encodeURIComponent(member.email)}?subject=${encodeURIComponent(WELCOME_SUBJECT)}&body=${encodeURIComponent(welcomeText(member.display_name, member.email))}`}><Mail size={16} />Abrir bienvenida en mi correo</a>
          {mailConfigured && <button type="button" disabled={busy || ["accepted", "review_required"].includes(deliveries.find((delivery) => delivery.membership_id === member.id)?.status || "")} onClick={() => void perform(async () => {
            const message = await sendWelcome(member.id);
            setNotice(null); setInviteResult({ id: member.id, message });
          })}><Send size={16} />Enviar bienvenida</button>}
        </>}
        {!member.activated_at && !member.cancelled_at && !deliveries.find((delivery) => delivery.membership_id === member.id)?.first_attempt_at && <button type="button" disabled={busy} title="Cancelar invitación pendiente" onClick={() => void perform(async () => {
          const { error: cancelError } = await getSupabaseClient()!.rpc("cancel_tester_invitation", { p_id: member.id });
          if (cancelError) throw cancelError;
          await load(); setNotice({ original: "Invitación pendiente cancelada." });
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
          setNotice({ original: "Seguimiento actualizado." });
        })} />
      </FeedbackItem>)}
    </section>}
  </div>;
}

function FeedbackItem({ item, author, children, language = "es" }: { language?: AppLanguage; item: Feedback; author?: string; children?: React.ReactNode }) {
  const t = (key: MessageKey) => translate(language, key);
  const status = Object.hasOwn(statuses, item.status) ? statuses[item.status] : "account.statusUnavailable";
  return <article className="account-list-row" lang={language}><small>{t(item.kind === "bug" ? "account.bug" : "account.idea")} · {t(status)} · {formatDate(item.created_at, language) ?? t("dateUnavailable")}</small>
    {author && <small>{author}</small>}<strong>{item.title}</strong><p className="feedback-details">{item.details}</p>
    {item.admin_reply && <p className="feedback-details"><b>{t("account.reply")} </b>{item.admin_reply}</p>}{children}</article>;
}

function FeedbackReview({ item, disabled, onSave }: { item: Feedback; disabled: boolean; onSave: (status: Feedback["status"], reply: string) => Promise<void> }) {
  const [status, setStatus] = useState(item.status);
  const [reply, setReply] = useState(item.admin_reply);
  return <form onSubmit={(event) => { event.preventDefault(); void onSave(status, reply); }}><fieldset disabled={disabled}>
    <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value as Feedback["status"])}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{translate("es", label)}</option>)}</select></label>
    <label>Respuesta<textarea maxLength={2000} rows={2} value={reply} onChange={(event) => setReply(event.target.value)} /></label>
    <button type="submit"><Send size={16} />Guardar seguimiento</button>
  </fieldset></form>;
}
