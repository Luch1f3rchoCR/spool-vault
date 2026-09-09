"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ModalFrame } from "@/components/modal-frame";
import { getSupabaseClient } from "@/lib/supabase";
import { FOUNDER_SCOPE } from "@/lib/tester-welcome";
import type { PrinterProfile } from "@/lib/types";

type PrinterDraft = { key: string; name: string; manufacturer: string; model: string; location: string };
type FirstVisit = { status: "pending" | "active" | "not_invited"; display_name?: string };
const emptyPrinter = (): PrinterDraft => ({ key: crypto.randomUUID(), name: "", manufacturer: "", model: "", location: "" });

export function TesterFirstVisit({ userId, onComplete, onSignOut }: {
  userId: string; onComplete: (printers: PrinterProfile[]) => void; onSignOut: () => void;
}) {
  const [visit, setVisit] = useState<FirstVisit | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [experience, setExperience] = useState("");
  const [usage, setUsage] = useState("");
  const [purpose, setPurpose] = useState("");
  const [platform, setPlatform] = useState("");
  const [printers, setPrinters] = useState<PrinterDraft[]>([]);
  const [accepted, setAccepted] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);

  async function check() {
    const client = getSupabaseClient();
    if (!client) return;
    setChecking(true); setError("");
    try {
      const { data, error: problem } = await client.rpc("get_tester_first_visit");
      if (problem || !data?.status) throw problem || new Error("missing response");
      if (mounted.current) { setVisit(data); setName(data.display_name || ""); }
    } catch {
      if (mounted.current) setError("No pudimos comprobar tu invitación. Reintentá para continuar.");
    } finally { if (mounted.current) setChecking(false); }
  }

  useEffect(() => {
    mounted.current = true;
    void check();
    return () => { mounted.current = false; };
    // This component remounts for every signed-in account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const showing = checking || Boolean(error) || visit?.status === "pending";
  useEffect(() => {
    if (!showing) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [showing]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !accepted) return;
    const client = getSupabaseClient();
    if (!client) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const { data, error: problem } = await client.rpc("complete_tester_first_visit", {
        p_answers: {
          display_name: name.trim(), country: country.trim(), experience, usage,
          purpose: purpose.trim(), platform, accepted_terms: true,
          printers: printers.map(({ key, ...printer }) => ({ ...printer, name: printer.name.trim() }))
        }
      });
      if (problem || data?.status !== "active" || !Array.isArray(data.printers)) throw problem || new Error("missing confirmation");
      if (mounted.current) { onComplete(data.printers); setVisit({ status: "active" }); }
    } catch {
      if (mounted.current) setError("No pudimos confirmar la activación. Conservamos tus respuestas; reintentá sin duplicar impresoras.");
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }

  if (!showing) return null;
  return <ModalFrame title={visit?.status === "pending" ? "Conozcamos tu taller" : "Tu invitación"} titleId="tester-first-visit-title"
    eyebrow="Probador fundador · primer ingreso" className="tester-first-visit"
    busy={busy || checking} onClose={onSignOut} closeLabel="Salir y completar después">
    <p className="form-help">Completás esto una sola vez, después de verificar tu correo. Tus impresoras quedarán en Perfil → Mis impresoras y podrás editarlas allí.</p>
    {checking && <p role="status">Comprobando invitación…</p>}
    {error && <p className="account-error" role="alert">{error}</p>}
    {!checking && visit?.status !== "pending" && error && <button type="button" onClick={() => void check()}>Reintentar</button>}
    {!checking && visit?.status === "pending" && <form onSubmit={submit}>
      <fieldset disabled={busy} className="first-visit-fields">
        <div className="form-grid">
          <label>Tu nombre<input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>País (opcional)<input maxLength={80} value={country} onChange={(e) => setCountry(e.target.value)} /></label>
          <label>Experiencia en impresión 3D<select required value={experience} onChange={(e) => setExperience(e.target.value)}><option value="">Elegí una opción</option><option value="beginner">Estoy empezando</option><option value="intermediate">Intermedia</option><option value="advanced">Avanzada</option></select></label>
          <label>¿Cómo usás la impresión 3D?<select required value={usage} onChange={(e) => setUsage(e.target.value)}><option value="">Elegí una opción</option><option value="hobby">Hobby / uso personal</option><option value="professional">Trabajo / negocio</option><option value="both">Ambos</option></select></label>
          <label className="wide">¿Qué imprimís o para qué la usás?<textarea required minLength={3} maxLength={1000} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Figuras, prototipos, repuestos, productos para vender…" /></label>
          <label>¿Desde dónde usarás la app?<select required value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">Elegí una opción</option><option value="ios">iPhone / iPad</option><option value="android">Android</option><option value="desktop">Computadora</option><option value="mixed">Varios dispositivos</option></select></label>
        </div>
        <h3>Tus impresoras</h3>
        <p className="form-help">Una línea por máquina. Si todavía no tenés una, podés continuar sin agregarla. No pedimos claves ni conectamos tus equipos automáticamente.</p>
        {printers.map((printer, index) => <div className="first-visit-printer" key={printer.key}>
          <h4>Impresora {index + 1}</h4>
          <div className="form-grid">
            {(["name", "manufacturer", "model", "location"] as const).map((field) => <label key={field}>{({ name: "Nombre o apodo", manufacturer: "Marca", model: "Modelo", location: "Ubicación (opcional)" })[field]}
              <input required={field === "name"} maxLength={field === "location" ? 160 : 120} value={printer[field]} onChange={(e) => setPrinters((rows) => rows.map((row) => row.key === printer.key ? { ...row, [field]: e.target.value } : row))} />
            </label>)}
          </div>
          <button type="button" onClick={() => setPrinters((rows) => rows.filter((row) => row.key !== printer.key))}><Trash2 size={16} />Quitar impresora {index + 1}</button>
        </div>)}
        <button type="button" disabled={printers.length >= 20} onClick={() => setPrinters((rows) => [...rows, emptyPrinter()])}><Plus size={17} />Agregar otra impresora</button>
        <p className="form-help">El equipo del programa podrá ver tus respuestas para organizar las pruebas. Las respuestas iniciales se conservan; editar una impresora no cambia ese registro.</p>
        <p className="form-help">{FOUNDER_SCOPE}</p>
        <label className="account-checkbox"><input required type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />Entiendo el alcance personal del beneficio de probador fundador.</label>
        <button className="primary-action" type="submit" disabled={!accepted}>{busy ? "Guardando y activando…" : "Guardar y activar mi acceso"}</button>
        <button type="button" onClick={onSignOut}>Salir y completar después</button>
      </fieldset>
    </form>}
  </ModalFrame>;
}
