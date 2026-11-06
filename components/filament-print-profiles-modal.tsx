"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { defaultLanguage, formatDate, languageLocale, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";
import { ModalFrame } from "./modal-frame";
import { FilamentPrintProfileFields } from "./filament-print-profile-fields";
import { getSupabaseClient } from "../lib/supabase";
import { awaitPrintProfileRequest, confirmedPrintProfile, printProfileValues, restorePrintProfileOperation, type PrintProfileOperation } from "../lib/filament-print-profiles";
import type { FilamentPrintProfile, FilamentPrintProfileValues, FilamentRoll, PrinterProfile } from "../lib/types";
import styles from "./supplies-modal.module.css";

type ProfileMessage = { key: MessageKey; detail?: MessageKey; original?: string } | { original: string };

type Editor = { profileId: string; version: number; initial?: FilamentPrintProfileValues };
const numericHistoryFields = ["nozzle_diameter_mm", "nozzle_temperature_c", "bed_temperature_c", "flow_ratio"] as const;
const columns = "id,user_id,profile_id,version,request_id,roll_id,printer_id,printer_name,name,slicer,nozzle_diameter_mm,nozzle_temperature_c,bed_temperature_c,flow_ratio,notes,created_at";

export function FilamentPrintProfilesModal({ roll, printers, userId, synced, onClose, language = defaultLanguage }: {
  language?: AppLanguage;
  roll: FilamentRoll; printers: readonly PrinterProfile[]; userId: string; synced: boolean; onClose: () => void;
}) {
  const t = (key: MessageKey, values?: Readonly<Record<string, string | number>>) => translate(language, key, values);
  const locale = languageLocale(language);
  const renderMessage = (message: ProfileMessage) => <>
    {"key" in message && t(message.key)}
    {"key" in message && message.detail && <> {t(message.detail)}</>}
    {message.original && <> {"key" in message && " "}{language === "en" && <>{t("account.originalMessage")} </>}<span lang="">{message.original}</span></>}
  </>;
  const [profiles, setProfiles] = useState<FilamentPrintProfile[]>([]);
  const [history, setHistory] = useState<FilamentPrintProfile[] | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState<PrintProfileOperation | null>(null);
  const [loading, setLoading] = useState(synced);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ProfileMessage | null>(null);
  const [notice, setNotice] = useState<MessageKey | null>(null);
  const [reload, setReload] = useState(0);
  const active = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const status = useRef<HTMLParagraphElement>(null);
  const storageKey = `proper-print-profile-pending:${userId}:${roll.id}`;

  useEffect(() => {
    if (!synced) return;
    try {
      const saved = restorePrintProfileOperation(sessionStorage.getItem(storageKey), roll.id);
      if (saved) { setPending(saved); setEditor({ profileId: saved.p_profile_id, version: saved.p_expected_version, initial: saved.p_values }); }
    } catch (cause) { setError(cause instanceof Error ? { original: cause.message } : { key: "printProfile.restoreError" }); }
  }, [synced, storageKey, roll.id]);

  useEffect(() => {
    if (!synced) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    setLoading(true);
    async function load() {
      try {
        const client = getSupabaseClient();
        if (!client) throw new Error("La conexión no está disponible.");
        const rows: FilamentPrintProfile[] = [];
        for (let from = 0; ; from += 200) {
          const result = await awaitPrintProfileRequest(client.from("filament_print_profiles_current").select(columns)
            .eq("user_id", userId).eq("roll_id", roll.id).order("profile_id").range(from, from + 199).abortSignal(controller.signal), controller.signal);
          if (result.error) throw result.error;
          rows.push(...(result.data as FilamentPrintProfile[]));
          if (result.data.length < 200) break;
        }
        if (!controller.signal.aborted) setProfiles(rows);
      } catch {
        if (!cancelled) setError({ key: "printProfile.loadError" });
      } finally { if (!cancelled) setLoading(false); clearTimeout(timeout); }
    }
    let cancelled = false;
    void load();
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout); };
  }, [synced, userId, roll.id, reload]);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => { if (notice || error) status.current?.focus(); }, [notice, error]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !editor) return;
    let operation: PrintProfileOperation;
    try {
      operation = pending ?? { p_request_id: crypto.randomUUID(), p_profile_id: editor.profileId,
        p_expected_version: editor.version, p_values: printProfileValues(new FormData(event.currentTarget), roll.id) };
      // Persist the retry key before sending. A reload must not create a duplicate.
      sessionStorage.setItem(storageKey, JSON.stringify(operation));
    } catch (cause) { setError(cause instanceof Error ? { original: cause.message } : { key: "printProfile.prepareError" }); return; }
    lock.current = true; setBusy(true); setPending(operation); setError(null); setNotice(null);
    const controller = new AbortController(); active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const client = getSupabaseClient();
      if (!client || !synced) { setError({ key: "printProfile.saveError", detail: "printProfile.sessionRequired" }); return; }
      const result = await awaitPrintProfileRequest(client.rpc("save_filament_print_profile", operation).abortSignal(controller.signal), controller.signal);
      if (result.error) {
        // These SQL errors confirm rejection; transport errors keep the frozen attempt.
        if (["22023", "22P02", "23514", "23502", "42501", "40001"].includes(result.error.code)) {
          sessionStorage.removeItem(storageKey); setPending(null);
          setEditor({ profileId: operation.p_profile_id, version: operation.p_expected_version, initial: operation.p_values });
          if (result.error.code === "40001") { setEditor(null); setReload(value => value + 1); }
        }
        throw new Error(result.error.message);
      }
      if (!confirmedPrintProfile(result.data?.profile, operation, userId)) { setError({ key: "printProfile.saveError", detail: "printProfile.unconfirmed" }); return; }
      const saved = result.data.profile;
      sessionStorage.removeItem(storageKey);
      setProfiles(current => {
        const newer = current.find(item => item.profile_id === saved.profile_id && item.version > saved.version);
        return newer ? current : [saved, ...current.filter(item => item.profile_id !== saved.profile_id)];
      });
      setPending(null); setEditor(null);
      setNotice(result.data.replayed ? "printProfile.recovered" : "printProfile.saved");
    } catch (cause) {
      if (!controller.signal.aborted || active.current === controller) setError(cause instanceof Error ? { key: "printProfile.saveError", original: cause.message } : { key: "printProfile.saveError", detail: "printProfile.retryHelp" });
    } finally { clearTimeout(timeout); active.current = null; lock.current = false; setBusy(false); }
  }

  async function showHistory(profile: FilamentPrintProfile) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setNotice(null);
    const controller = new AbortController(); active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error();
      const result = await awaitPrintProfileRequest(client.from("filament_print_profiles").select(columns).eq("user_id", userId)
        .eq("roll_id", roll.id).eq("profile_id", profile.profile_id).order("version", { ascending: false }).limit(100).abortSignal(controller.signal), controller.signal);
      if (result.error) throw result.error;
      setHistory(result.data as FilamentPrintProfile[]);
    } catch { setError({ key: "printProfile.historyError" }); }
    finally { clearTimeout(timeout); active.current = null; lock.current = false; setBusy(false); }
  }

  return <ModalFrame lang={language} title={t(history ? "printProfile.history" : editor ? "printProfile.configuration" : "printProfile.title")}
    titleId="print-profiles-title" eyebrow={t("printProfile.eyebrow")} className={styles.modal} busy={busy} onClose={onClose}
    onBack={history ? () => setHistory(null) : editor && !pending ? () => { setEditor(null); setError(null); } : undefined}
    viewKey={history ? "history" : editor?.profileId ?? "list"} closeLabel={t("printProfile.close")} backLabel={t("printProfile.back")}>
    <p className={styles.intro}>{roll.color_name} · {roll.brand} · {roll.product_line || roll.material}</p>
    {!synced ? <p className="sync-note">{t("printProfile.signedOut")}</p> : <>
      {(notice || error) && <p className={styles.feedback} ref={status} tabIndex={-1} role={error ? "alert" : "status"}>{error ? renderMessage(error) : notice && t(notice)}</p>}
      {pending && <p className={styles.pending} role="status">{t("printProfile.pending")}</p>}
      {loading && <p role="status">{t("printProfile.loading")}</p>}
      {!editor && !history && <>
        <p>{t("printProfile.help")}</p>
        {error && <button type="button" disabled={busy || loading} onClick={() => { setError(null); setReload(value => value + 1); }}>{t("printProfile.retryLoad")}</button>}
        <button className={styles.primary} type="button" disabled={busy || loading || !!error || !printers.some(printer => printer.is_active)} onClick={() => {
          setEditor({ profileId: crypto.randomUUID(), version: 0 }); setNotice(null);
        }}>{t("printProfile.new")}</button>
        {!printers.some(printer => printer.is_active) && <p>{t("printProfile.printerHelp")}</p>}
        {!loading && !error && !profiles.length && <p>{t("printProfile.empty")}</p>}
        {profiles.map(profile => <article className={styles.details} key={profile.profile_id}>
          <h3>{profile.name}</h3><p>{profile.printer_name} · {profile.slicer || t("printProfile.noSlicer")} · {t("printProfile.revision", { number: profile.version.toLocaleString(locale) })}</p>
          <p>{t("printProfile.nozzle", { value: profile.nozzle_diameter_mm == null ? t("printProfile.unrecorded") : `${Number(profile.nozzle_diameter_mm).toLocaleString(locale)} mm` })}</p>
          <button type="button" disabled={busy} onClick={() => { setEditor({ profileId: profile.profile_id, version: profile.version, initial: profile }); setNotice(null); }}>{t("printProfile.edit", { name: profile.name })}</button>
          <button type="button" disabled={busy} onClick={() => void showHistory(profile)}>{t("printProfile.historyAction", { name: profile.name })}</button>
        </article>)}
      </>}
      {editor && <form className={styles.form} onSubmit={save}>
        <FilamentPrintProfileFields language={language} key={pending?.p_request_id ?? editor.profileId} roll={roll} printers={printers}
          initial={pending?.p_values ?? editor.initial} disabled={busy || !!pending} />
        <div className={styles.formActions}><button className={styles.primary} type="submit" disabled={busy}>{busy ? t("printProfile.confirming") : pending ? t("printProfile.retrySave") : t("printProfile.save")}</button></div>
      </form>}
      {history && <><p>{t("printProfile.historyHelp")}</p>{history.map(profile => <article key={profile.id} className={styles.details}>
        <h3>{profile.name} · {t("printProfile.revision", { number: profile.version.toLocaleString(locale) })}</h3><p>{profile.printer_name} · {profile.slicer || t("printProfile.noSlicer")}</p>
        <p>{language === "es" ? new Date(profile.created_at).toLocaleString(locale) : formatDate(profile.created_at, language, { dateStyle: "medium", timeStyle: "short" }) ?? t("dateUnavailable")}</p>
        <dl>{numericHistoryFields.map(key => <div key={key}><dt>{t(`printProfile.history.${key}`)}</dt><dd>{profile[key] == null ? t("printProfile.unrecorded") : Number(profile[key]).toLocaleString(locale)}</dd></div>)}</dl>
        {profile.notes && <p>{profile.notes}</p>}
      </article>)}</>}
    </>}
  </ModalFrame>;
}
