"use client";

import { useState } from "react";
import {
  ChevronRight,
  CreditCard,
  Download,
  Lightbulb,
  LogOut,
  Save,
  ShieldCheck,
  UserRound,
  WalletCards,
  X
} from "lucide-react";
import type { UserProfile } from "@/lib/types";

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
  profile: UserProfile;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: ProfileValues) => Promise<boolean>;
  onSignOut: () => void;
};

export function ProfilePanel({ email, profile, isSaving, onClose, onSave, onSignOut }: ProfilePanelProps) {
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
    await onSave(values);
  }

  return (
    <div
      className="modal-backdrop profile-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section className="panel modal-panel profile-panel" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <div className="modal-head profile-head">
          <div>
            <p className="eyebrow">Tu espacio</p>
            <h2 id="profile-title">Perfil</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} disabled={isSaving} aria-label="Cerrar perfil">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="profile-identity">
          <span className="profile-avatar"><UserRound size={24} aria-hidden="true" /></span>
          <div>
            <strong>{profile.display_name || email || "Modo local"}</strong>
            <span>{email ? `${email} · cuenta sincronizada` : "Iniciá sesión para sincronizar tu cuenta"}</span>
          </div>
        </div>

        <form className="profile-preferences" onSubmit={submit} aria-busy={isSaving}>
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

        <form className="profile-preferences production-settings" onSubmit={submit} aria-busy={isSaving}>
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

        <div className="membership-card">
          <div className="membership-copy">
            <span className="membership-icon"><CreditCard size={20} aria-hidden="true" /></span>
            <div>
              <p className="eyebrow">Membresía</p>
              <h3>Plan personal · acceso anticipado</h3>
              <p>La pasarela de pago y los planes se conectarán acá cuando estén definidos.</p>
            </div>
          </div>
          <button type="button" disabled>Ver planes · próximamente</button>
        </div>

        <div className="profile-menu" aria-label="Opciones de perfil">
          <button type="button" disabled>
            <Lightbulb size={19} aria-hidden="true" />
            <span><strong>Compartir una idea</strong><small>Feedback y nuevas funciones</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" disabled>
            <Download size={19} aria-hidden="true" />
            <span><strong>Mis datos</strong><small>Exportación y respaldo</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <div className="profile-security">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Spool Vault nunca guardará números de tarjeta.</span>
          </div>
        </div>

        {email && (
          <button className="profile-signout" type="button" onClick={onSignOut} disabled={isSaving}>
            <LogOut size={18} aria-hidden="true" />
            Cerrar sesión
          </button>
        )}
      </section>
    </div>
  );
}
