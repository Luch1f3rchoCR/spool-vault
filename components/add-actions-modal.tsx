"use client";

import { ChevronRight, LinkIcon, PackagePlus, Plus } from "lucide-react";
import { ModalFrame } from "@/components/modal-frame";

export type AddAction = "filament" | "create-spool" | "assign-spool" | "manage-spools";

export function AddActionsModal({ onClose, onSelect }: { onClose: () => void; onSelect: (action: AddAction) => void }) {
  const actions = [
    { key: "filament", title: "Nuevo filamento", description: "Registrá el rollo, su color y su compra.", icon: Plus },
    { key: "create-spool", title: "Crear spool", description: "Enumerá un spool vacío y guardá su tara.", icon: PackagePlus },
    { key: "assign-spool", title: "Asignar spool", description: "Vinculá un spool vacío con un filamento existente.", icon: LinkIcon }
  ] as const;
  return <ModalFrame title="¿Qué querés agregar?" titleId="add-actions-title" eyebrow="Tu inventario" className="add-actions-modal" onClose={onClose}>
    <div className="add-action-options">{actions.map(({ key, title, description, icon: Icon }) =>
      <button type="button" key={key} onClick={() => onSelect(key)}>
        <Icon size={23} aria-hidden="true" /><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={18} aria-hidden="true" />
      </button>
    )}</div>
    <button className="manage-spools-link" type="button" onClick={() => onSelect("manage-spools")}>Ver y administrar mis spools</button>
  </ModalFrame>;
}
