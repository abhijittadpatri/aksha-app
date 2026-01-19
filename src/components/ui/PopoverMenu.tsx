// src/components/ui/PopoverMenu.tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cls } from "@/components/patients/patientUi";

export default function PopoverMenu({
  open,
  anchorEl,
  onClose,
  items,
  width = 240,
}: {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  items: Array<{
    id?: string;
    label: string;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
  }>;
  width?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    function compute() {
      const el = anchorEl;
      if (!el) return;

      const r = el.getBoundingClientRect();
      const margin = 10;

      const left = Math.min(
        window.innerWidth - width - margin,
        Math.max(margin, r.right - width)
      );
      const top = Math.min(window.innerHeight - margin, r.bottom + 8);

      setPos({ top, left });
    }

    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);

    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open, anchorEl, width]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[80]" onMouseDown={onClose} />
      <div
        className="fixed z-[90] rounded-xl border p-1 shadow"
        style={{
          top: pos.top,
          left: pos.left,
          width,
          background: "rgb(var(--panel))",
          borderColor: "rgba(255,255,255,0.10)",
          boxShadow: "0 18px 44px rgba(0,0,0,0.55)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {items.map((it, idx) => (
          <button
            key={it.id ?? `${it.label}-${idx}`}
            className={cls(
              "w-full text-left px-3 py-2 text-sm rounded-lg",
              it.disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-[rgba(255,255,255,0.06)]",
              it.danger ? "text-[rgb(var(--danger))]" : "text-[rgb(var(--fg))]"
            )}
            onClick={() => {
              if (it.disabled) return;
              it.onClick();
              onClose();
            }}
            type="button"
            disabled={it.disabled}
          >
            {it.label}
          </button>
        ))}
      </div>
    </>,
    document.body
  );
}
