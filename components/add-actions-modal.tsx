"use client";

import { ChevronRight, LinkIcon, PackagePlus, Plus } from "lucide-react";
import { ModalFrame } from "@/components/modal-frame";
import { defaultLanguage, translate, type AppLanguage } from "@/lib/i18n";

export type AddAction = "filament" | "create-spool" | "assign-spool" | "manage-spools";

export function AddActionsModal({ language = defaultLanguage, onClose, onSelect }: {
  language?: AppLanguage;
  onClose: () => void;
  onSelect: (action: AddAction) => void;
}) {
  const actions = [
    { key: "filament", title: "addActions.filament", description: "addActions.filamentHelp", icon: Plus },
    { key: "create-spool", title: "addActions.createSpool", description: "addActions.createSpoolHelp", icon: PackagePlus },
    { key: "assign-spool", title: "addActions.assignSpool", description: "addActions.assignSpoolHelp", icon: LinkIcon }
  ] as const;
  return <ModalFrame
    lang={language}
    title={translate(language, "addActions.title")}
    titleId="add-actions-title"
    eyebrow={translate(language, "addActions.eyebrow")}
    className="add-actions-modal"
    onClose={onClose}
    closeLabel={translate(language, "addActions.close")}
  >
    <div className="add-action-options">{actions.map(({ key, title, description, icon: Icon }) =>
      <button type="button" key={key} onClick={() => onSelect(key)}>
        <Icon size={23} aria-hidden="true" /><span><strong>{translate(language, title)}</strong><small>{translate(language, description)}</small></span><ChevronRight size={18} aria-hidden="true" />
      </button>
    )}</div>
    <button className="manage-spools-link" type="button" onClick={() => onSelect("manage-spools")}>{translate(language, "addActions.manageSpools")}</button>
  </ModalFrame>;
}
