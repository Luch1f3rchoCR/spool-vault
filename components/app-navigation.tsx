"use client";

import { defaultLanguage, translate, type AppLanguage, type MessageKey } from "@/lib/i18n";

import { BarChart3, Boxes, Disc3, FolderKanban, House, Layers3, Printer, QrCode, ReceiptText, Settings, WalletCards, Weight } from "lucide-react";

export type WorkspaceSection = "home" | "inventory" | "supplies" | "purchases" | "projects" | "production" | "costs" | "spools" | "reports" | "account" | "scan" | "weigh";

export function AppNavigation({ active, onSelect, language = defaultLanguage }: {
  language?: AppLanguage; active: WorkspaceSection; onSelect: (section: WorkspaceSection) => void;
}) {
  const t = (key: MessageKey) => translate(language, key);
  const groups = [
    { id: "workshop", label: t("nav.workshop"), items: [
      { key: "home", label: t("nav.home"), icon: House },
      { key: "inventory", label: t("nav.inventory"), icon: Layers3 },
      { key: "supplies", label: t("nav.supplies"), icon: Boxes },
      { key: "purchases", label: t("nav.purchases"), icon: ReceiptText },
      { key: "projects", label: t("projects"), icon: FolderKanban },
      { key: "production", label: t("nav.production"), icon: Printer }
    ] },
    { id: "organization", label: t("nav.organization"), items: [
      { key: "spools", label: t("nav.spools"), icon: Disc3 },
      { key: "costs", label: t("nav.costs"), icon: WalletCards },
      { key: "reports", label: t("nav.reports"), icon: BarChart3 },
      { key: "account", label: t("nav.settings"), icon: Settings }
    ] },
    { id: "tools", label: t("nav.tools"), items: [
      { key: "scan", label: t("nav.scan"), icon: QrCode },
      { key: "weigh", label: t("nav.weigh"), icon: Weight }
    ] }
  ];
  return <nav className="workspace-navigation" aria-label={t("nav.menu")} lang={language}>
    {groups.map(group => <div className="workspace-nav-group" key={group.id}>
      <p>{group.label}</p>
      {group.items.map(item => <button key={item.key} type="button"
        aria-current={active === item.key ? "true" : undefined}
        onClick={() => onSelect(item.key as WorkspaceSection)}>
        <item.icon size={19} aria-hidden="true" /><span>{item.label}</span>
      </button>)}
    </div>)}
    <p className="workspace-pending">{t("nav.pendingOrders")}</p>
  </nav>;
}
