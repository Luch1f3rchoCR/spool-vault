"use client";

import { defaultLanguage, translate, type AppLanguage } from "@/lib/i18n";

import { FolderKanban, Layers3, Menu, ReceiptText } from "lucide-react";
import type { WorkspaceSection } from "@/components/app-navigation";

type MobileNavigationProps = {
  language?: AppLanguage;
  active: WorkspaceSection;
  onSelect: (section: WorkspaceSection) => void;
  onMore: () => void;
};

export function MobileNavigation({ active, onSelect, onMore, language = defaultLanguage }: MobileNavigationProps) {
  return (
    <nav className="mobile-nav" aria-label={translate(language, "nav.primary")} lang={language}>
      <button type="button" aria-current={active === "inventory" ? "true" : undefined} onClick={() => onSelect("inventory")}><Layers3 size={20} aria-hidden="true" /><span>{translate(language, "nav.inventory")}</span></button>
      <button type="button" aria-current={active === "purchases" ? "true" : undefined} onClick={() => onSelect("purchases")}><ReceiptText size={20} aria-hidden="true" /><span>{translate(language, "nav.purchases")}</span></button>
      <button type="button" aria-current={active === "projects" ? "true" : undefined} onClick={() => onSelect("projects")}><FolderKanban size={20} aria-hidden="true" /><span>{translate(language, "projects")}</span></button>
      <button type="button" onClick={onMore} aria-haspopup="dialog"><Menu size={20} aria-hidden="true" /><span>{translate(language, "nav.more")}</span></button>
    </nav>
  );
}
