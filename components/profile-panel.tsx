"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  CreditCard,
  LogOut,
  Printer,
  Save,
  ShieldCheck,
  UserRound,
  WalletCards,
  X
} from "lucide-react";
import { currencyLabel, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";
import type { PrinterProfile, UserProfile } from "@/lib/types";
import { PrinterManager, type PrinterValues } from "@/components/printer-manager";
import { AccountCommunity } from "@/components/account-community";

export type ProfileView = "home" | "feedback" | "data" | "admin" | "preferences" | "production" | "printers";
const viewTitles: Record<ProfileView, MessageKey> = {
  home: "profile.title", feedback: "profile.feedback", data: "profile.data",
  admin: "profile.admin", preferences: "profile.preferences", production: "profile.production", printers: "printers"
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
  language?: AppLanguage;
  initialView?: ProfileView;
  email: string;
  userId: string;
  mode: "demo" | "local" | "authenticated" | "error";
  localData: Record<string, unknown>;
  profile: UserProfile;
  isSaving: boolean;
  printers: PrinterProfile[];
  isSavingPrinter: boolean;
  printerStatusMessage: string;
  onSavePrinter: (values: PrinterValues) => Promise<boolean>;
  onClose: () => void;
  onSave: (values: ProfileValues) => Promise<boolean>;
  onSignOut: () => void;
};

export function ProfilePanel({ language = "es", initialView = "home", email, userId, mode, localData, profile, isSaving, printers, isSavingPrinter, printerStatusMessage, onSavePrinter, onClose, onSave, onSignOut }: ProfilePanelProps) {
  const t = (key: MessageKey, values: Record<string, string | number> = {}) => translate(language, key, values);
  const [communityBusy, setCommunityBusy] = useState(false);
  const [view, setView] = useState<ProfileView>(initialView);
  const [saved, setSaved] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const menuTrigger = useRef<HTMLElement | null>(null);
  const blocked = isSaving || isSavingPrinter || communityBusy;

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
        if (event.target === event.currentTarget && !blocked) onClose();
      }}
    >
      <section ref={panelRef} className="panel modal-panel profile-panel" role="dialog" aria-modal="true" aria-labelledby="profile-title" lang={language}
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
          {view !== "home" && <button className="modal-close profile-back" type="button" onClick={() => navigate("home")} disabled={blocked} aria-label={t("profile.back")} title={t("profile.back")}><ArrowLeft size={20} aria-hidden="true" /></button>}
          <div>
            <p className="eyebrow">{t("profile.space")}</p>
            <h2 id="profile-title" ref={headingRef} tabIndex={-1}>{t(viewTitles[view])}</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} disabled={blocked} aria-label={t("profile.close")}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="profile-content" ref={contentRef}>
        <div className="profile-identity" hidden={view !== "home"}>
          <span className="profile-avatar"><UserRound size={24} aria-hidden="true" /></span>
          <div>
            <strong>{profile.display_name || email || t("profile.local")}</strong>
            <span>{email ? t("profile.synced", { email }) : t("profile.signIn")}</span>
          </div>
        </div>

        <nav className="profile-menu" aria-label={t("profile.currencyNav")} hidden={view !== "home"}>
          <button type="button" disabled={blocked} onClick={() => navigate("preferences")}>
            <WalletCards size={19} aria-hidden="true" />
            <span>
              <strong>{t("profile.preferences")}</strong>
              <small>{t("profile.savedCurrency", { currency: profile.base_currency || "CRC" })}</small>
              {values.base_currency !== (profile.base_currency || "CRC") && <small>{t("profile.unsavedCurrency")}</small>}
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </nav>

        <AccountCommunity key={userId || mode} userId={userId} mode={mode} localData={localData} onBusyChange={setCommunityBusy} view={view} onNavigate={navigate} />

        <nav className="profile-menu profile-settings-menu" aria-label={t("profile.settingsNav")} hidden={view !== "home"}>
          <button type="button" disabled={blocked} onClick={() => navigate("printers")}><Printer size={19} /><span><strong>{t("printers")}</strong><small>{t("profile.printersHelp")}</small></span><ChevronRight size={18} /></button>
          <button type="button" disabled={blocked} onClick={() => navigate("production")}><CreditCard size={19} /><span><strong>{t("profile.production")}</strong><small>{t("profile.productionHelp")}</small></span><ChevronRight size={18} /></button>
        </nav>
        {saved && <p className="account-notice" role="status">{t("profile.saved")}</p>}
        <div hidden={view !== "printers"}>
          <p className="account-notice" role="status">{printerStatusMessage}</p>
          <PrinterManager language={language} printers={printers} profile={profile} isSaving={isSavingPrinter} onBack={() => navigate("home")} onSave={onSavePrinter} backLabel={t("profile.space")} />
        </div>

        <form className="profile-preferences" onSubmit={submit} onChange={() => setSaved(false)} aria-busy={isSaving} hidden={view !== "preferences"}>
          <div className="profile-section-head">
            <span><WalletCards size={19} aria-hidden="true" /></span>
            <div><p className="eyebrow">{t("profile.financial")}</p><h3>{t("profile.preferences")}</h3></div>
          </div>
          <p className="form-help" id="profile-currency-help">{t("profile.currencyHelp")}</p>
          <div className="form-grid profile-form-grid">
            <label>{t("profile.baseCurrency")}<select aria-describedby="profile-currency-help" value={values.base_currency} disabled={isSaving} onChange={(event) => setValues({ ...values, base_currency: event.target.value })}><option value="CRC">{currencyLabel("CRC", language)}</option><option value="USD">{currencyLabel("USD", language)}</option><option value="EUR">{currencyLabel("EUR", language)}</option></select></label>
            <label>{t("profile.displayName")}<input maxLength={120} value={values.display_name} disabled={isSaving} onChange={(event) => setValues({ ...values, display_name: event.target.value })} /></label>
            <label>{t("profile.billingName")}<input maxLength={160} value={values.billing_name} disabled={isSaving} onChange={(event) => setValues({ ...values, billing_name: event.target.value })} /></label>
            <label>{t("profile.taxId")}<input maxLength={80} value={values.billing_tax_id} disabled={isSaving} placeholder={t("profile.taxIdPlaceholder")} onChange={(event) => setValues({ ...values, billing_tax_id: event.target.value })} /></label>
            <label className="wide">{t("profile.billingEmail")}<input type="email" maxLength={254} value={values.billing_email} disabled={isSaving} onChange={(event) => setValues({ ...values, billing_email: event.target.value })} /></label>
            <label className="wide">{t("profile.billingAddress")}<textarea maxLength={500} value={values.billing_address} disabled={isSaving} onChange={(event) => setValues({ ...values, billing_address: event.target.value })} /></label>
          </div>
          <button className="primary-action" type="submit" disabled={isSaving}><Save size={18} aria-hidden="true" />{isSaving ? t("profile.saving") : t("profile.savePreferences")}</button>
        </form>

        <form className="profile-preferences production-settings" onSubmit={submit} onChange={() => setSaved(false)} aria-busy={isSaving} hidden={view !== "production"}>
          <div className="profile-section-head">
            <span><CreditCard size={19} aria-hidden="true" /></span>
            <div><p className="eyebrow">{t("nav.production")}</p><h3>{t("profile.ratesTitle")}</h3></div>
          </div>
          <p className="form-help">{t("profile.ratesHelp")}</p>
          <div className="form-grid profile-form-grid">
            <label>{t("profile.costCurrency")}<select value={values.production_cost_currency} disabled={isSaving} onChange={(event) => setValues({ ...values, production_cost_currency: event.target.value })}><option value="CRC">{currencyLabel("CRC", language)}</option><option value="USD">{currencyLabel("USD", language)}</option><option value="EUR">{currencyLabel("EUR", language)}</option></select></label>
            <label>{t("profile.electricity")}<input type="number" min="0" step="0.01" value={values.electricity_price_per_kwh} disabled={isSaving} placeholder={t("profile.electricityExample")} onChange={(event) => setValues({ ...values, electricity_price_per_kwh: event.target.value })} /></label>
            <label>{t("profile.power")}<input type="number" min="0.01" step="0.01" value={values.printer_average_power_w} disabled={isSaving} placeholder={t("profile.powerExample")} onChange={(event) => setValues({ ...values, printer_average_power_w: event.target.value })} /></label>
            <label>{t("machineRate")}<input type="number" min="0" step="0.01" value={values.machine_cost_per_hour} disabled={isSaving} placeholder="0" onChange={(event) => setValues({ ...values, machine_cost_per_hour: event.target.value })} /></label>
            <label>{t("profile.labor")}<input type="number" min="0" step="0.01" value={values.labor_cost_per_hour} disabled={isSaving} placeholder="0" onChange={(event) => setValues({ ...values, labor_cost_per_hour: event.target.value })} /></label>
          </div>
          <button className="primary-action" type="submit" disabled={isSaving}><Save size={18} aria-hidden="true" />{isSaving ? t("profile.savingRates") : t("profile.saveRates")}</button>
        </form>

        <div className="profile-security" hidden={view !== "preferences"}>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>{t("profile.security")}</span>
        </div>

        {email && view === "home" && (
          <button className="profile-signout" type="button" onClick={onSignOut} disabled={isSaving || communityBusy}>
            <LogOut size={18} aria-hidden="true" />
            {t("profile.signOut")}
          </button>
        )}
        </div>
      </section>
    </div>
  );
}
