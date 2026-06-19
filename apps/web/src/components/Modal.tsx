import { useEffect } from "react";
import { Icon } from "@crestly/icons";

/**
 * CDS-faithful modal — bottom sheet on mobile (≤600px), centered dialog above.
 * Mirrors the `.install-modal` pattern in erp/includes/footer.php.
 *
 * Uses `install-modal__close` for the dismiss button so it matches the
 * cream-circle styling everywhere else in the app, and pins it to the
 * top-right of the head row so the title can be any height without
 * dragging the X around.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  actions,
  size = "md",
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 420, md: 560, lg: 720 } as const;

  return (
    <div className="install-modal is-open" role="dialog" aria-modal="true">
      <div className="install-modal__scrim" onClick={onClose} />
      <div className="install-modal__sheet" style={{ maxWidth: widths[size] }}>
        <div className="install-modal__handle" aria-hidden="true" />
        <div className="install-modal__head">
          <h3 className="install-modal__title" style={{ margin: 0, flex: 1, minWidth: 0 }}>
            {title}
          </h3>
          <button
            type="button"
            className="install-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="install-modal__body">{children}</div>
        {actions && <div className="install-modal__actions">{actions}</div>}
      </div>
    </div>
  );
}
