"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  CreditCard,
  LogOut,
  Save,
  ShieldCheck,
  UserRound,
  WalletCards,
  X
} from "lucide-react";
import type { UserProfile } from "@/lib/types";
import { AccountCommunity } from "@/components/account-community";

export type ProfileView = "home" | "feedback" | "data" | "admin" | "preferences" | "production";
const viewTitles: Record<ProfileView, string> = {
  home: "Perfil", feedback: "Compartir una idea", data: "Mis datos",
  admin: "Grupo de pruebas", preferences: "Moneda y facturación", production: "Tarifas de impresión"
};

export type ProfileValues = {
  display_name: string;
  base_currency: string;
  billing_name: string;
  billing_tax_id: string;
  billing_email: string;
  billing_address: string;
  production_cost_currency: string;
  electricity_price_per_kwh: string;
  printer_average_power_w: string;
  machine_cost_per_hour: string;
  labor_cost_per_hour: string;
};

type ProfilePanelProps = {
  email: string;
  userId: string;
  mode: "demo" | "local" | "authenticated" | "error";
  localData: Record<string, unknown>;
  profile: UserProfile;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: ProfileValues) => Promise<boolean>;
  onSignOut: () => void;
};

export function ProfilePanel({ email, userId, mode, localData, profile, isSaving, onClose, onSave, onSignOut }: ProfilePanelProps) {
  const [communityBusy, setCommunityBusy] = useState(false);
  const [view, setView] = useState<ProfileView>("home");
  const [saved, setSaved] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const menuTrigger = useRef<HTMLElement | null>(null);
  const blocked = isSaving || communityBusy;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => { if (opener?.isConnected) opener.focus(); };
  }, []);

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
    if (view === "home" && menuTrigger.current?.isConnected) menuTrigger.current.focus();
    else headingRef.current?.focus();
  }, [view]);

  function navigate(next: ProfileView) {
    if (blocked) return;
    if (view === "home") menuTrigger.current = document.activeElement as HTMLElement;
    setSaved(false);
    setView(next);
  }
  const [values, setValues] = useState<ProfileValues>({
    display_name: profile.display_name ?? "",
    base_currency: profile.base_currency || "CRC",
    billing_name: profile.billing_name ?? "",
    billing_tax_id: profile.billing_tax_id ?? "",
    billing_email: profile.billing_email ?? email,
    billing_address: profile.billing_address ?? "",
    production_cost_currency: profile.production_cost_currency || profile.base_currency || "CRC",
    electricity_price_per_kwh: profile.electricity_price_per_kwh == null ? "" : String(profile.electricity_price_per_kwh),
    printer_average_power_w: profile.printer_average_power_w == null ? "" : String(profile.printer_average_power_w),
    machine_cost_per_hour: String(profile.machine_cost_per_hour ?? 0),
    labor_cost_per_hour: String(profile.labor_cost_per_hour ?? 0)
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(await onSave(values));
  }

  return (
    <div
      className="modal-backdrop profile-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving && !communityBusy) onClose();
      }}
    >
      <section ref={panelRef} className="panel modal-panel profile-panel" role="dialog" aria-modal="true" aria-labelledby="profile-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            if (!blocked) { if (view === "home") onClose(); else navigate("home"); }
          }
          if (event.key === "Tab") {
            const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]'
            ) ?? []).filter((element) => element.getClientRects().length > 0);
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (!first) { event.preventDefault(); headingRef.current?.focus(); }
            else if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement as HTMLElement))) {
              event.preventDefault(); last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement as HTMLElement))) {
              event.preventDefault(); first.focus();
            }
          }
        }}>
        <div className="modal-head profile-head">
          {view !== "home" && <button className="modal-close profile-back" type="button" onClick={() => navigate("home")} disabled={blocked} aria-label="Volver a Tu espacio" title="Volver a Tu espacio"><ArrowLeft size={20} aria-hidden="true" /></button>}
          <div>
            <p className="eyebrow">Tu espacio</p>
            <h2 id="profile-title" ref={headingRef} tabIndex={-1}>{viewTitles[view]}</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} disabled={isSaving || communityBusy} aria-label="Cerrar perfil">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="profile-content" ref={contentRef}>
        <div className="profile-identity" hidden={view !== "home"}>
          <span className="profile-avatar"><UserRound size={24} aria-hidden="true" /></span>
          <div>
            <strong>{profile.display_name || email || "Modo local"}</strong>
            <span>{email ? `${email} · cuenta sincronizada` : "Iniciá sesión para sincronizar tu cuenta"}</span>
          </div>
        </div>

        <AccountCommunity key={userId || mode} userId={userId} mode={mode} localData={localData} onBusyChange={setCommunityBusy} view={view} onNavigate={navigate} />

        <nav className="profile-menu profile-settings-menu" aria-label="Preferencias de tu espacio" hidden={view !== "home"}>
          <button type="button" disabled={blocked} onClick={() => navigate("preferences")}><WalletCards size={19} /><span><strong>Moneda y facturación</strong><small>Perfil y preferencias financieras</small></span><ChevronRight size={18} /></button>
          <button type="button" disabled={blocked} onClick={() => navigate("production")}><CreditCard size={19} /><span><strong>Tarifas de impresión</strong><small>Electricidad, máquina y mano de obra</small></span><ChevronRight size={18} /></button>
        </nav>
        {saved && <p className="account-notice" role="status">Cambios guardados.</p>}

        <form className="profile-preferences" onSubmit={submit} onChange={() => setSaved(false)} aria-busy={isSaving} hidden={view !== "preferences"}>
          <div className="profile-section-head">
            <span><WalletCards size={19} aria-hidden="true" /></span>
            <div><p className="eyebrow">Preferencias financieras</p><h3>Moneda y facturación</h3></div>
          </div>
          <p className="form-help">La moneda base solo cambia cómo ves tus resúmenes. Nunca reescribe precios ni tipos de cambio históricos.</p>
          <div className="form-grid profile-form-grid">
            <label>Nombre para mostrar<input maxLength={120} value={values.display_name} disabled={isSaving} onChange={(event) => setValues({ ...values, display_name: event.target.value })} /></label>
            <label>Moneda base<select value={values.base_currency} disabled={isSaving} onChange={(event) => setValues({ ...values, base_currency: event.target.value })}><option value="CRC">CRC · Colón costarricense</option><option value="USD">USD · Dólar estadounidense</option><option value="EUR">EUR · Euro</option></select></label>
            <label>Nombre de facturación<input maxLength={160} value={values.billing_name} disabled={isSaving} onChange={(event) => setValues({ ...values, billing_name: event.target.value })} /></label>
            <label>Identificación fiscal<input maxLength={80} value={values.billing_tax_id} disabled={isSaving} placeholder="Cédula física o jurídica" onChange={(event) => setValues({ ...values, billing_tax_id: event.target.value })} /></label>
            <label className="wide">Correo de facturación<input type="email" maxLength={254} value={values.billing_email} disabled={isSaving} onChange={(event) => setValues({ ...values, billing_email: event.target.value })} /></label>
            <label className="wide">Dirección de facturación<textarea maxLength={500} value={values.billing_address} disabled={isSaving} onChange={(event) => setValues({ ...values, billing_address: event.target.value })} /></label>
          </div>
          <button className="primary-action" type="submit" disabled={isSaving}><Save size={18} aria-hidden="true" />{isSaving ? "Guardando perfil…" : "Guardar preferencias"}</button>
        </form>

        <form className="profile-preferences production-settings" onSubmit={submit} onChange={() => setSaved(false)} aria-busy={isSaving} hidden={view !== "production"}>
          <div className="profile-section-head">
            <span><CreditCard size={19} aria-hidden="true" /></span>
            <div><p className="eyebrow">Producción</p><h3>Tarifas para calcular impresiones</h3></div>
          </div>
          <p className="form-help">Son valores predeterminados. Cada corrida guarda una copia y nunca cambia aunque después modifiqués estas tarifas.</p>
          <div className="form-grid profile-form-grid">
            <label>Moneda de costos<select value={values.production_cost_currency} disabled={isSaving} onChange={(event) => setValues({ ...values, production_cost_currency: event.target.value })}><option value="CRC">CRC · Colón costarricense</option><option value="USD">USD · Dólar estadounidense</option><option value="EUR">EUR · Euro</option></select></label>
            <label>Electricidad por kWh<input type="number" min="0" step="0.01" value={values.electricity_price_per_kwh} disabled={isSaving} placeholder="Ej. 95" onChange={(event) => setValues({ ...values, electricity_price_per_kwh: event.target.value })} /></label>
            <label>Potencia promedio de impresora (W)<input type="number" min="0.01" step="0.01" value={values.printer_average_power_w} disabled={isSaving} placeholder="Ej. 120" onChange={(event) => setValues({ ...values, printer_average_power_w: event.target.value })} /></label>
            <label>Costo de máquina por hora<input type="number" min="0" step="0.01" value={values.machine_cost_per_hour} disabled={isSaving} placeholder="0" onChange={(event) => setValues({ ...values, machine_cost_per_hour: event.target.value })} /></label>
            <label>Costo de mano de obra por hora<input type="number" min="0" step="0.01" value={values.labor_cost_per_hour} disabled={isSaving} placeholder="0" onChange={(event) => setValues({ ...values, labor_cost_per_hour: event.target.value })} /></label>
          </div>
          <button className="primary-action" type="submit" disabled={isSaving}><Save size={18} aria-hidden="true" />{isSaving ? "Guardando tarifas…" : "Guardar tarifas"}</button>
        </form>

        <div className="profile-security" hidden={view !== "preferences"}>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Spool Vault nunca guardará números de tarjeta.</span>
        </div>

        {email && view === "home" && (
          <button className="profile-signout" type="button" onClick={onSignOut} disabled={isSaving || communityBusy}>
            <LogOut size={18} aria-hidden="true" />
            Cerrar sesión
          </button>
        )}
        </div>
      </section>
    </div>
  );
}
