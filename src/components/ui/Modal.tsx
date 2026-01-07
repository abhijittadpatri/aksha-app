"use client";

import { useEffect, useId, useRef } from "react";

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  closeOnEsc = true,
  showCloseButton = true,
  preventCloseWhileBusy = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;

  title?: string;
  description?: string;

  children: React.ReactNode;
  footer?: React.ReactNode;

  size?: "sm" | "md" | "lg" | "xl";

  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;

  showCloseButton?: boolean;

  // If busy, you often don’t want close by backdrop/esc
  preventCloseWhileBusy?: boolean;
  busy?: boolean;
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC close
  useEffect(() => {
    if (!open) return;
    if (!closeOnEsc) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (preventCloseWhileBusy && busy) return;
      onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeOnEsc, preventCloseWhileBusy, busy, onClose]);

  // Focus the panel for accessibility (simple, no focus trap)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => panelRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const maxW =
    size === "sm"
      ? "sm:max-w-md"
      : size === "md"
      ? "sm:max-w-xl"
      : size === "lg"
      ? "sm:max-w-2xl"
      : "sm:max-w-3xl";

  const canClose = !(preventCloseWhileBusy && busy);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
    >
      {/* Backdrop click */}
      {closeOnBackdrop && (
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          aria-label="Close modal"
          onClick={() => {
            if (!canClose) return;
            onClose();
          }}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cls(
          "relative w-full outline-none",
          maxW,
          "modal"
        )}
      >
        <div className="max-h-[85vh] overflow-y-auto p-4 sm:p-5 space-y-4">
          {(title || description || showCloseButton) && (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {title ? (
                  <h2 id={titleId} className="text-lg font-semibold">
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <div id={descId} className="text-xs muted mt-1">
                    {description}
                  </div>
                ) : null}
              </div>

              {showCloseButton ? (
                <button
                  className="btn btn-ghost btn-sm shrink-0"
                  type="button"
                  onClick={() => {
                    if (!canClose) return;
                    onClose();
                  }}
                  disabled={!canClose}
                >
                  Close
                </button>
              ) : null}
            </div>
          )}

          <div className="space-y-4">{children}</div>

          {footer ? (
            <div className="pt-1 border-t border-white/10">{footer}</div>
          ) : null}

          <div className="h-2" />
        </div>
      </div>
    </div>
  );
}
