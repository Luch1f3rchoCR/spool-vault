"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ModalFrame } from "@/components/modal-frame";
import { ProperSignature } from "@/components/proper-brand";
import { getSupabaseClient } from "@/lib/supabase";
import { defaultLanguage, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";
import type { PrinterProfile } from "@/lib/types";

type PrinterDraft = { key: string; name: string; manufacturer: string; model: string; location: string };
type FirstVisit = { status: "pending" | "active" | "not_invited"; display_name?: string };
const emptyPrinter = (): PrinterDraft => ({ key: crypto.randomUUID(), name: "", manufacturer: "", model: "", location: "" });

export function TesterFirstVisit({ language = defaultLanguage, userId, onComplete, onSignOut }: {
  language?: AppLanguage;
  userId: string; onComplete: (printers: PrinterProfile[]) => void; onSignOut: () => void;
}) {
  const t = (key: MessageKey, values: Record<string, string | number> = {}) => translate(language, key, values);
  const [visit, setVisit] = useState<FirstVisit | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
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
    setChecking(true); setError(null);
    try {
      const { data, error: problem } = await client.rpc("get_tester_first_visit");
      if (problem || !data?.status) throw problem || new Error("missing response");
      if (mounted.current) { setVisit(data); setName(data.display_name || ""); }
    } catch {
      if (mounted.current) setError("firstVisit.checkError");
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
    pending.current = true; setBusy(true); setError(null);
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
      if (mounted.current) setError("firstVisit.activationError");
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }

  if (!showing) return null;
  return <ModalFrame lang={language} title={visit?.status === "pending" ? t("firstVisit.workshop") : t("firstVisit.invitation")} titleId="tester-first-visit-title"
    eyebrow={t("firstVisit.eyebrow")} className="tester-first-visit"
    busy={busy || checking} onClose={onSignOut} closeLabel={t("firstVisit.leave")}>
    <ProperSignature />
    <p className="form-help">{t("firstVisit.onceHelp")}</p>
    {checking && <p role="status">{t("firstVisit.checking")}</p>}
    {error && <p className="account-error" role="alert">{t(error)}</p>}
    {!checking && visit?.status !== "pending" && error && <button type="button" onClick={() => void check()}>{t("firstVisit.retry")}</button>}
    {!checking && visit?.status === "pending" && <form onSubmit={submit}>
      <fieldset disabled={busy} className="first-visit-fields">
        <div className="form-grid">
          <label>{t("firstVisit.yourName")}<input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>{t("firstVisit.country")}<input maxLength={80} value={country} onChange={(e) => setCountry(e.target.value)} /></label>
          <label>{t("firstVisit.experience")}<select required value={experience} onChange={(e) => setExperience(e.target.value)}><option value="">{t("firstVisit.choose")}</option><option value="beginner">{t("firstVisit.beginner")}</option><option value="intermediate">{t("admin.intermediate")}</option><option value="advanced">{t("admin.advanced")}</option></select></label>
          <label>{t("firstVisit.usage")}<select required value={usage} onChange={(e) => setUsage(e.target.value)}><option value="">{t("firstVisit.choose")}</option><option value="hobby">{t("firstVisit.hobby")}</option><option value="professional">{t("firstVisit.professional")}</option><option value="both">{t("firstVisit.both")}</option></select></label>
          <label className="wide">{t("firstVisit.purpose")}<textarea required minLength={3} maxLength={1000} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t("firstVisit.purposePlaceholder")} /></label>
          <label>{t("firstVisit.platform")}<select required value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">{t("firstVisit.choose")}</option><option value="ios">iPhone / iPad</option><option value="android">Android</option><option value="desktop">{t("firstVisit.desktop")}</option><option value="mixed">{t("firstVisit.mixedDevices")}</option></select></label>
        </div>
        <h3>{t("firstVisit.printers")}</h3>
        <p className="form-help">{t("firstVisit.printersHelp")}</p>
        {printers.map((printer, index) => <div className="first-visit-printer" key={printer.key}>
          <h4>{t("firstVisit.printer", { number: index + 1 })}</h4>
          <div className="form-grid">
            {(["name", "manufacturer", "model", "location"] as const).map((field) => <label key={field}>{({ name: t("firstVisit.printerName"), manufacturer: t("brand"), model: t("model"), location: t("firstVisit.location") })[field]}
              <input required={field === "name"} maxLength={field === "location" ? 160 : 120} value={printer[field]} onChange={(e) => setPrinters((rows) => rows.map((row) => row.key === printer.key ? { ...row, [field]: e.target.value } : row))} />
            </label>)}
          </div>
          <button type="button" onClick={() => setPrinters((rows) => rows.filter((row) => row.key !== printer.key))}><Trash2 size={16} />{t("firstVisit.removePrinter", { number: index + 1 })}</button>
        </div>)}
        <button type="button" disabled={printers.length >= 20} onClick={() => setPrinters((rows) => [...rows, emptyPrinter()])}><Plus size={17} />{t("firstVisit.addPrinter")}</button>
        <p className="form-help">{t("firstVisit.answersHelp")}</p>
        <p className="form-help">{t("account.pilotHelp")}</p>
        <label className="account-checkbox"><input required type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />{t("firstVisit.acceptScope")}</label>
        <button className="primary-action" type="submit" disabled={!accepted}>{busy ? t("firstVisit.activating") : t("firstVisit.activate")}</button>
        <button type="button" onClick={onSignOut}>{t("firstVisit.leave")}</button>
      </fieldset>
    </form>}
  </ModalFrame>;
}
