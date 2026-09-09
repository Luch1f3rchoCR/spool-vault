"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";

export function ModalFrame({ title, titleId, eyebrow, className = "", busy = false, onClose, onBack, viewKey, children, closeLabel = "Cerrar ventana" }: {
  title: string; titleId: string; eyebrow: string; className?: string; busy?: boolean;
  onClose: () => void; onBack?: () => void; viewKey?: string; children: ReactNode;
  closeLabel?: string;
}) {
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => { if (opener?.isConnected) opener.focus(); };
  }, []);
  useEffect(() => { heading.current?.focus(); panel.current?.scrollTo(0, 0); }, [viewKey]);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !busy) (onBack ?? onClose)();
  }}>
    <section ref={panel} className={`panel modal-panel modal-frame ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault(); event.stopPropagation();
          if (!busy) (onBack ?? onClose)();
        }
        if (event.key === "Tab") {
          const nodes = Array.from(panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
          ) ?? []).filter((node) => node.getClientRects().length > 0);
          const first = nodes[0], last = nodes.at(-1);
          if (!first) { event.preventDefault(); heading.current?.focus(); }
          else if (event.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement as HTMLElement))) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement as HTMLElement))) {
            event.preventDefault(); first.focus();
          }
        }
      }}>
      <div className="modal-head">
        {onBack && <button className="modal-close" type="button" onClick={onBack} disabled={busy} aria-label="Volver"><ArrowLeft size={20} aria-hidden="true" /></button>}
        <div className="modal-frame-heading"><p className="eyebrow">{eyebrow}</p><h2 ref={heading} tabIndex={-1} id={titleId}>{title}</h2></div>
        <button className="modal-close" type="button" onClick={onClose} disabled={busy} aria-label={closeLabel} title={closeLabel}><X size={20} aria-hidden="true" /></button>
      </div>
      {children}
    </section>
  </div>;
}
