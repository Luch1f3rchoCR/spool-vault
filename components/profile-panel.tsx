"use client";

import {
  ChevronRight,
  CreditCard,
  Download,
  Lightbulb,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
  X
} from "lucide-react";

type ProfilePanelProps = {
  email: string;
  onClose: () => void;
  onSignOut: () => void;
};

export function ProfilePanel({ email, onClose, onSignOut }: ProfilePanelProps) {
  return (
    <div
      className="modal-backdrop profile-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="panel modal-panel profile-panel" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <div className="modal-head profile-head">
          <div>
            <p className="eyebrow">Tu espacio</p>
            <h2 id="profile-title">Perfil</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar perfil">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="profile-identity">
          <span className="profile-avatar"><UserRound size={24} aria-hidden="true" /></span>
          <div>
            <strong>{email || "Modo local"}</strong>
            <span>{email ? "Cuenta sincronizada" : "Iniciá sesión para sincronizar tu cuenta"}</span>
          </div>
        </div>

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
            <Settings size={19} aria-hidden="true" />
            <span><strong>Preferencias</strong><small>Moneda, unidades y alertas</small></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
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
          <button className="profile-signout" type="button" onClick={onSignOut}>
            <LogOut size={18} aria-hidden="true" />
            Cerrar sesión
          </button>
        )}
      </section>
    </div>
  );
}
