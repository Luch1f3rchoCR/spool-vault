"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ModalFrame } from "./modal-frame";
import { FilamentPrintProfileFields } from "./filament-print-profile-fields";
import { getSupabaseClient } from "../lib/supabase";
import { awaitPrintProfileRequest, confirmedPrintProfile, printProfileValues, restorePrintProfileOperation, type PrintProfileOperation } from "../lib/filament-print-profiles";
import type { FilamentPrintProfile, FilamentPrintProfileValues, FilamentRoll, PrinterProfile } from "../lib/types";
import styles from "./supplies-modal.module.css";

type Editor = { profileId: string; version: number; initial?: FilamentPrintProfileValues };
const columns = "id,user_id,profile_id,version,request_id,roll_id,printer_id,printer_name,name,slicer,nozzle_diameter_mm,nozzle_temperature_c,bed_temperature_c,flow_ratio,notes,created_at";

export function FilamentPrintProfilesModal({ roll, printers, userId, synced, onClose }: {
  roll: FilamentRoll; printers: readonly PrinterProfile[]; userId: string; synced: boolean; onClose: () => void;
}) {
  const [profiles, setProfiles] = useState<FilamentPrintProfile[]>([]);
  const [history, setHistory] = useState<FilamentPrintProfile[] | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState<PrintProfileOperation | null>(null);
  const [loading, setLoading] = useState(synced);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo recuperar el intento pendiente."); }
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
        if (!cancelled) setError("No se pudieron cargar los perfiles. Reintentá antes de crear uno nuevo.");
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo preparar el guardado."); return; }
    lock.current = true; setBusy(true); setPending(operation); setError(""); setNotice("");
    const controller = new AbortController(); active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const client = getSupabaseClient();
      if (!client || !synced) throw new Error("Sesión requerida.");
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
      if (!confirmedPrintProfile(result.data?.profile, operation, userId)) throw new Error("La respuesta no confirmó esta configuración.");
      const saved = result.data.profile;
      sessionStorage.removeItem(storageKey);
      setProfiles(current => {
        const newer = current.find(item => item.profile_id === saved.profile_id && item.version > saved.version);
        return newer ? current : [saved, ...current.filter(item => item.profile_id !== saved.profile_id)];
      });
      setPending(null); setEditor(null);
      setNotice(result.data.replayed ? "Configuración recuperada: ya estaba guardada." : "Configuración guardada.");
    } catch (cause) {
      if (!controller.signal.aborted || active.current === controller) setError(`No se confirmó el guardado. ${cause instanceof Error ? cause.message : "Reintentá para recuperar el resultado."}`);
    } finally { clearTimeout(timeout); active.current = null; lock.current = false; setBusy(false); }
  }

  async function showHistory(profile: FilamentPrintProfile) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    const controller = new AbortController(); active.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error();
      const result = await awaitPrintProfileRequest(client.from("filament_print_profiles").select(columns).eq("user_id", userId)
        .eq("roll_id", roll.id).eq("profile_id", profile.profile_id).order("version", { ascending: false }).limit(100).abortSignal(controller.signal), controller.signal);
      if (result.error) throw result.error;
      setHistory(result.data as FilamentPrintProfile[]);
    } catch { setError("No se pudo cargar el historial. Podés reintentarlo."); }
    finally { clearTimeout(timeout); active.current = null; lock.current = false; setBusy(false); }
  }

  return <ModalFrame title={history ? "Historial del perfil" : editor ? "Configuración de impresión" : "Perfiles de impresión"}
    titleId="print-profiles-title" eyebrow="TU FILAMENTO" className={styles.modal} busy={busy} onClose={onClose}
    onBack={history ? () => setHistory(null) : editor && !pending ? () => { setEditor(null); setError(""); } : undefined}
    viewKey={history ? "history" : editor?.profileId ?? "list"} closeLabel="Cerrar perfiles de impresión">
    <p className={styles.intro}>{roll.color_name} · {roll.brand} · {roll.product_line || roll.material}</p>
    {!synced ? <p className="sync-note">Iniciá sesión para guardar perfiles con tus filamentos e impresoras. El modo local/demo no guarda estas configuraciones.</p> : <>
      {(notice || error) && <p className={styles.feedback} ref={status} tabIndex={-1} role={error ? "alert" : "status"}>{error || notice}</p>}
      {pending && <p className={styles.pending} role="status">Hay un intento pendiente. Reintentá con los mismos valores para confirmar si ya se guardó. Se conserva al cerrar o recargar esta pestaña.</p>}
      {loading && <p role="status">Cargando perfiles…</p>}
      {!editor && !history && <>
        <p>Guardá varias configuraciones probadas por impresora, boquilla o laminador. Cada edición conserva su revisión anterior.</p>
        {error && <button type="button" disabled={busy || loading} onClick={() => { setError(""); setReload(value => value + 1); }}>Reintentar carga</button>}
        <button className={styles.primary} type="button" disabled={busy || loading || !!error || !printers.some(printer => printer.is_active)} onClick={() => {
          setEditor({ profileId: crypto.randomUUID(), version: 0 }); setNotice("");
        }}>Nueva configuración</button>
        {!printers.some(printer => printer.is_active) && <p>Primero agregá una impresora activa desde Perfil → Mis impresoras.</p>}
        {!loading && !error && !profiles.length && <p>Todavía no hay configuraciones para este filamento.</p>}
        {profiles.map(profile => <article className={styles.details} key={profile.profile_id}>
          <h3>{profile.name}</h3><p>{profile.printer_name} · {profile.slicer || "Sin laminador registrado"} · Revisión {profile.version}</p>
          <p>Boquilla: {profile.nozzle_diameter_mm == null ? "Sin registrar" : `${profile.nozzle_diameter_mm} mm`}</p>
          <button type="button" disabled={busy} onClick={() => { setEditor({ profileId: profile.profile_id, version: profile.version, initial: profile }); setNotice(""); }}>Editar {profile.name}</button>
          <button type="button" disabled={busy} onClick={() => void showHistory(profile)}>Historial de {profile.name}</button>
        </article>)}
      </>}
      {editor && <form className={styles.form} onSubmit={save}>
        <FilamentPrintProfileFields key={pending?.p_request_id ?? editor.profileId} roll={roll} printers={printers}
          initial={pending?.p_values ?? editor.initial} disabled={busy || !!pending} />
        <div className={styles.formActions}><button className={styles.primary} type="submit" disabled={busy}>{busy ? "Confirmando…" : pending ? "Reintentar guardado" : "Guardar configuración"}</button></div>
      </form>}
      {history && <><p>Últimas 100 revisiones. Se muestran los valores registrados en cada guardado.</p>{history.map(profile => <article key={profile.id} className={styles.details}>
        <h3>{profile.name} · Revisión {profile.version}</h3><p>{profile.printer_name} · {profile.slicer || "Sin laminador registrado"}</p>
        <p>{new Date(profile.created_at).toLocaleString("es-CR")}</p>
        <dl>{["nozzle_diameter_mm", "nozzle_temperature_c", "bed_temperature_c", "flow_ratio"].map(key => <div key={key}><dt>{({ nozzle_diameter_mm: "Boquilla (mm)", nozzle_temperature_c: "Temperatura de boquilla (°C)", bed_temperature_c: "Temperatura de cama (°C)", flow_ratio: "Flujo (ratio)" })[key]}</dt><dd>{profile[key as keyof FilamentPrintProfile] ?? "Sin registrar"}</dd></div>)}</dl>
        {profile.notes && <p>{profile.notes}</p>}
      </article>)}</>}
    </>}
  </ModalFrame>;
}
