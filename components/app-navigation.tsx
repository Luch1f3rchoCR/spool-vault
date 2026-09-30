"use client";

import { BarChart3, Boxes, Disc3, FolderKanban, House, Layers3, Printer, QrCode, ReceiptText, Settings, WalletCards, Weight } from "lucide-react";

export type WorkspaceSection = "home" | "inventory" | "supplies" | "purchases" | "projects" | "production" | "costs" | "spools" | "reports" | "account" | "scan" | "weigh";

export function AppNavigation({ active, onSelect }: {
  active: WorkspaceSection; onSelect: (section: WorkspaceSection) => void;
}) {
  const groups = [
    { label: "Tu taller", items: [
      { key: "home", label: "Inicio", icon: House },
      { key: "inventory", label: "Inventario", icon: Layers3 },
      { key: "supplies", label: "Insumos", icon: Boxes },
      { key: "purchases", label: "Compras", icon: ReceiptText },
      { key: "projects", label: "Proyectos", icon: FolderKanban },
      { key: "production", label: "Producción", icon: Printer }
    ] },
    { label: "Organización", items: [
      { key: "spools", label: "Spools", icon: Disc3 },
      { key: "costs", label: "Costos", icon: WalletCards },
      { key: "reports", label: "Reportes", icon: BarChart3 },
      { key: "account", label: "Configuración", icon: Settings }
    ] },
    { label: "Herramientas", items: [
      { key: "scan", label: "Escanear QR", icon: QrCode },
      { key: "weigh", label: "Pesar filamento", icon: Weight }
    ] }
  ];
  return <nav className="workspace-navigation" aria-label="Menú del taller">
    {groups.map(group => <div className="workspace-nav-group" key={group.label}>
      <p>{group.label}</p>
      {group.items.map(item => <button key={item.key} type="button"
        aria-current={active === item.key ? "true" : undefined}
        onClick={() => onSelect(item.key as WorkspaceSection)}>
        <item.icon size={19} aria-hidden="true" /><span>{item.label}</span>
      </button>)}
    </div>)}
    <p className="workspace-pending">Pedidos: próximo módulo.</p>
  </nav>;
}
