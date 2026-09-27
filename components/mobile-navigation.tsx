"use client";

import { FolderKanban, Layers3, Menu, ReceiptText } from "lucide-react";
import type { WorkspaceSection } from "@/components/app-navigation";

type MobileNavigationProps = {
  active: WorkspaceSection;
  onSelect: (section: WorkspaceSection) => void;
  onMore: () => void;
};

export function MobileNavigation({ active, onSelect, onMore }: MobileNavigationProps) {
  return (
    <nav className="mobile-nav" aria-label="Navegación principal">
      <button type="button" aria-current={active === "inventory" ? "true" : undefined} onClick={() => onSelect("inventory")}><Layers3 size={20} aria-hidden="true" /><span>Inventario</span></button>
      <button type="button" aria-current={active === "purchases" ? "true" : undefined} onClick={() => onSelect("purchases")}><ReceiptText size={20} aria-hidden="true" /><span>Compras</span></button>
      <button type="button" aria-current={active === "projects" ? "true" : undefined} onClick={() => onSelect("projects")}><FolderKanban size={20} aria-hidden="true" /><span>Proyectos</span></button>
      <button type="button" onClick={onMore} aria-haspopup="dialog"><Menu size={20} aria-hidden="true" /><span>Más</span></button>
    </nav>
  );
}
