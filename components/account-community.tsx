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
const deliveryLabels = { pending: "admin.deliveryPending", sending: "admin.deliverySending", accepted: "admin.deliveryAccepted", uncertain: "admin.deliveryUncertain", review_required: "admin.deliveryReview" } as const;
class AccountActionError extends Error {
  constructor(readonly displayMessage: AccountMessage) { super("Account action could not be confirmed"); }
}
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
  const t = (key: MessageKey, values: Record<string, string | number> = {}) => translate(language, key, values);
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
  const [inviteResult, setInviteResult] = useState<{ id: string; message: AccountMessage } | null>(null);
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
      setError(cause instanceof AccountActionError ? cause.displayMessage : message.startsWith("Llegaste al limite") ? { original: message } : { key: "account.operationError" });
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
        throw new AccountActionError({ key: "admin.cancelledError" });
      }
      let message: AccountMessage = { key: data.activated_at ? "admin.alreadyActive" : "admin.reserved" };
      if (mailConfigured && sendOnSave) message = await sendWelcome(data.id);
      // Only clear the draft after the requested reservation/send is confirmed.
      // An uncertain send keeps the entered values and the saved membership.
      setInviteName(""); setInviteEmail(""); setInviteReason(""); setExpectedFocus("");
      setNotice(null);
      setInviteResult({ id: data.id, message });
    });
  }

  async function sendWelcome(id: string): Promise<AccountMessage> {
    const session = await getSupabaseClient()!.auth.getSession();
    if (!session.data.session) throw new AccountActionError({ key: "admin.signInWelcome" });
    let response: Response;
    try {
      response = await fetch("/api/admin/tester-welcome", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.data.session.access_token}` },
        body: JSON.stringify({ membership_id: id }), signal: AbortSignal.timeout(25000)
      });
    } catch { throw new AccountActionError({ key: "admin.uncertainError" }); }
    const result = await response.json();
    await load();
    if (!response.ok || result.status !== "accepted") throw new AccountActionError(result.error ? { original: String(result.error) } : { key: "admin.unconfirmedError" });
    const message: AccountMessage = { key: result.already_sent ? "admin.alreadySent" : "admin.accepted" };
    setNotice(message);
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
  function deliveryLabel(status: Delivery["status"] = "pending") {
    return t(Object.hasOwn(deliveryLabels, status) ? deliveryLabels[status] : "account.statusUnavailable");
  }
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
      {admin && <button type="button" onClick={() => onNavigate("admin")} disabled={busy}><Users size={19} /><span><strong>{t("profile.admin")}</strong><small>{t("admin.counts", { active: members.filter((m) => m.activated_at).length, pending: members.filter((m) => !m.activated_at && !m.cancelled_at).length })}</small></span><ChevronRight size={18} /></button>}
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

    {view === "admin" && admin && <section className="account-section" aria-label={t("profile.admin")}>
      <p className="eyebrow">{t("admin.onlyAdmin")}</p>
      <h3>{t("admin.addTester")}</h3>
      {language === "en" && <p className="form-help">{t("account.termsLanguage")}</p>}<p lang="es">{founderScope}</p>
      {!mailConfigured && <p className="account-notice">{t("admin.automaticPending")}</p>}
      <form onSubmit={reserve}><fieldset disabled={busy || loading}>
        <label>{t("name")}<input required minLength={2} maxLength={120} value={inviteName} onChange={(event) => { setInviteName(event.target.value); setInviteReady(false); }} /></label>
        <label>{t("admin.accessEmail")}<input required type="email" maxLength={254} autoCapitalize="none" value={inviteEmail} onChange={(event) => { setInviteEmail(event.target.value); setInviteReady(false); }} /></label>
        <label>{t("admin.reasonField")}<input required minLength={3} maxLength={1000} value={inviteReason} onChange={(event) => setInviteReason(event.target.value)} /></label>
        <label>{t("admin.expectedFocusField")}<textarea maxLength={1000} rows={3} value={expectedFocus} onChange={(event) => setExpectedFocus(event.target.value)} /></label>
        <p className="form-help">{t("admin.notesHelp")}</p>
        {mailConfigured && <label className="account-checkbox"><input type="checkbox" checked={sendOnSave} onChange={(event) => setSendOnSave(event.target.checked)} />{t("admin.sendOnSave")}</label>}
        <details className="welcome-preview"><summary>{t("admin.preview")}</summary>{language === "en" && <p className="form-help">{t("admin.emailLanguage")}</p>}<p className="feedback-details" lang="es">{welcomeText(inviteName.trim(), inviteEmail.trim() || "el correo registrado")}</p></details>
        <button className="primary-action" type="submit"><UserPlus size={18} />{busy ? t("admin.processing") : mailConfigured && sendOnSave ? t("admin.saveSend") : t("admin.lifetimeAccess")}</button>
      </fieldset></form>
      {inviteReady && <button type="button" className="account-copy" disabled={busy} onClick={() => void perform(async () => {
        await navigator.clipboard.writeText(APP_URL);
        setNotice({ key: "admin.linkCopied" });
      })}><Copy size={18} />{t("admin.copyLink")}</button>}
      <h4>{t("admin.testers")}</h4>
      {!members.length && <p>{t("admin.noTesters")}</p>}
      {members.map((member) => <article className="account-list-row" key={member.id}
        ref={inviteResult?.id === member.id ? inviteResultRef : undefined}
        tabIndex={inviteResult?.id === member.id ? -1 : undefined}
        aria-label={t("admin.invitationLabel", { name: member.display_name || member.email })}>
        {inviteResult?.id === member.id && <p role="status" className="account-notice">{showMessage(inviteResult.message)}</p>}
        <strong>{member.display_name || member.email}</strong><span>{member.email}</span>
        <small>{member.cancelled_at ? t("admin.cancelled") : member.activated_at ? t("admin.active") : t("admin.pendingActivation")}</small>
        <small>{[member.country, member.printers].filter(Boolean).join(" · ")}</small>
        {member.testing_focus && <p>{t("admin.previousFocus", { focus: member.testing_focus })}</p>}
        {inviteNotes.filter((note) => note.membership_id === member.id).map((note) => <div key={note.membership_id}><p><strong>{t("admin.reason")}</strong> {note.reason}</p>{note.expected_focus && <p><strong>{t("admin.expectedTests")}</strong> {note.expected_focus}</p>}</div>)}
        {firstVisits.filter((visit) => visit.membership_id === member.id).map(({ answers }) => <details key={member.id}><summary>{t("admin.firstVisitAnswers")}</summary>
          <p>{answers.display_name} · {answers.country || t("admin.noCountry")}</p>
          <p>{t("admin.experience")} {({ beginner: t("admin.beginner"), intermediate: t("admin.intermediate"), advanced: t("admin.advanced") } as Record<string, string>)[answers.experience] || answers.experience}</p>
          <p>{t("admin.usage")} {({ hobby: t("admin.hobby"), professional: t("admin.professional"), both: t("admin.both") } as Record<string, string>)[answers.usage] || answers.usage}</p>
          <p>{answers.purpose}</p><p>{t("admin.device")} {answers.platform}</p>
          <p>{t("admin.initialPrinters")} {answers.printers.map((printer) => [printer.name, printer.manufacturer, printer.model].filter(Boolean).join(" · ")).join("; ") || t("admin.noPrinters")}</p>
        </details>)}
        <small>{deliveryLabel(deliveries.find((delivery) => delivery.membership_id === member.id)?.status)}</small>
        {!member.cancelled_at && <>
          <a className="account-mail-link" href={`mailto:${encodeURIComponent(member.email)}?subject=${encodeURIComponent(WELCOME_SUBJECT)}&body=${encodeURIComponent(welcomeText(member.display_name, member.email))}`}><Mail size={16} />{t("admin.openMail")}</a>
          {mailConfigured && <button type="button" disabled={busy || ["accepted", "review_required"].includes(deliveries.find((delivery) => delivery.membership_id === member.id)?.status || "")} onClick={() => void perform(async () => {
            const message = await sendWelcome(member.id);
            setNotice(null); setInviteResult({ id: member.id, message });
          })}><Send size={16} />{t("admin.sendWelcome")}</button>}
        </>}
        {!member.activated_at && !member.cancelled_at && !deliveries.find((delivery) => delivery.membership_id === member.id)?.first_attempt_at && <button type="button" disabled={busy} title={t("admin.cancelPendingTitle")} onClick={() => void perform(async () => {
          const { error: cancelError } = await getSupabaseClient()!.rpc("cancel_tester_invitation", { p_id: member.id });
          if (cancelError) throw cancelError;
          await load(); setNotice({ key: "admin.cancelledNotice" });
        })}><X size={16} />{t("admin.cancel")}</button>}
      </article>)}
      <h4>{t("admin.groupFeedback")}</h4>
      <p className="form-help">{t("admin.recentFeedbackHelp")}</p>
      {!feedback.length && <p>{t("admin.noFeedback")}</p>}
      {feedback.map((item) => <FeedbackItem language={language} key={item.id} item={item} author={members.find((member) => member.user_id === item.user_id)?.display_name || members.find((member) => member.user_id === item.user_id)?.email}>
        <FeedbackReview language={language} key={`${item.id}-${item.status}-${item.admin_reply}`} item={item} disabled={busy} onSave={(status, reply) => perform(async () => {
          const { data, error: reviewError } = await getSupabaseClient()!.from("user_feedback").update({ status, admin_reply: reply }).eq("id", item.id).select("*").single();
          if (reviewError || !data) throw reviewError || new Error("missing confirmation");
          setFeedback((current) => current.map((entry) => entry.id === data.id ? data : entry));
          setNotice({ key: "admin.updated" });
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

function FeedbackReview({ item, disabled, onSave, language = "es" }: { language?: AppLanguage; item: Feedback; disabled: boolean; onSave: (status: Feedback["status"], reply: string) => Promise<void> }) {
  const t = (key: MessageKey) => translate(language, key);
  const [status, setStatus] = useState(item.status);
  const [reply, setReply] = useState(item.admin_reply);
  return <form onSubmit={(event) => { event.preventDefault(); void onSave(status, reply); }}><fieldset disabled={disabled}>
    <label>{t("admin.status")}<select value={status} onChange={(event) => setStatus(event.target.value as Feedback["status"])}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
    <label>{t("admin.reply")}<textarea maxLength={2000} rows={2} value={reply} onChange={(event) => setReply(event.target.value)} /></label>
    <button type="submit"><Send size={16} />{t("admin.saveReview")}</button>
  </fieldset></form>;
}
