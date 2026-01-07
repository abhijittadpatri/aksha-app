"use client";

import { useEffect } from "react";

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
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
  busy?: boolean;
}) {
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  const maxW =
    size === "sm"
      ? "sm:max-w-sm"
      : size === "md"
      ? "sm:max-w-md"
      : size === "lg"
      ? "sm:max-w-lg"
      : "sm:max-w-xl";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className={cls(
          "absolute inset-0 modal-backdrop",
          closeOnBackdrop ? "cursor-pointer" : ""
        )}
        onClick={() => {
          if (!closeOnBackdrop) return;
          if (busy) return;
          onClose();
        }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={cls(
          "relative w-full",
          maxW,
          // mobile: sheet style
          "rounded-t-2xl sm:rounded-2xl",
          "overflow-hidden"
        )}
      >
        {/* 👇 Accent ring + glow wrapper */}
        <div
          className="relative rounded-t-2xl sm:rounded-2xl p-[1px]"
          style={{
            background:
              "linear-gradient(135deg, rgba(var(--brand),0.55), rgba(255,255,255,0.08), rgba(var(--brand-2),0.45))",
            boxShadow:
              "0 30px 90px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.05), 0 0 40px rgba(var(--brand),0.10)",
          }}
        >
          {/* Main surface */}
          <div className="modal relative overflow-hidden">
            {/* 👇 subtle top highlight so it doesn’t “merge” */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-16"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.00))",
              }}
            />

            {/* Header */}
            {(title || description) && (
              <div
                className="px-4 py-3 relative"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {title ? (
                      <div className="text-base font-semibold truncate">{title}</div>
                    ) : null}
                    {description ? (
                      <div className="mt-1 text-[11px] subtle leading-snug">
                        {description}
                      </div>
                    ) : null}
                  </div>

                  <button
                    className="btn btn-ghost btn-icon-sm shrink-0"
                    onClick={() => {
                      if (busy) return;
                      onClose();
                    }}
                    type="button"
                    aria-label="Close"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Body */}
            <div className="max-h-[80vh] overflow-y-auto px-4 py-4 relative">
              {children}
            </div>

            {/* Footer */}
            {footer ? (
              <div
                className="px-4 py-3 relative"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                {footer}
                {/* iOS safe-area pad */}
                <div
                  className="h-1"
                  style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                />
              </div>
            ) : (
              <div
                className="h-2"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
