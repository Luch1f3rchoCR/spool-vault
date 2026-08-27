"use client";

import { House, LogIn, PackageSearch, UserRound, Weight } from "lucide-react";

type MobileNavigationProps = {
  isSignedIn: boolean;
  onAccount: () => void;
  onWeigh: () => void;
};

export function MobileNavigation({ isSignedIn, onAccount, onWeigh }: MobileNavigationProps) {
  return (
    <nav className="mobile-nav" aria-label="Navegación principal">
      <a href="#inicio"><House size={20} aria-hidden="true" /><span>Inicio</span></a>
      <a href="#inventario"><PackageSearch size={20} aria-hidden="true" /><span>Inventario</span></a>
      <button type="button" onClick={onWeigh}><Weight size={20} aria-hidden="true" /><span>Pesar</span></button>
      <button type="button" onClick={onAccount}>
        {isSignedIn ? <UserRound size={20} aria-hidden="true" /> : <LogIn size={20} aria-hidden="true" />}
        <span>{isSignedIn ? "Perfil" : "Entrar"}</span>
      </button>
    </nav>
  );
}
