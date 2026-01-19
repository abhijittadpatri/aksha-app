import React from "react";

export function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function fmt(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function money(n: any) {
  return safeNumber(n).toFixed(2);
}

export function safeDate(d: any) {
  try {
    return d ? new Date(d).toLocaleString() : "";
  } catch {
    return "";
  }
}

export function statusBadge(
  kind: "ok" | "warn" | "danger" | "muted" | "info",
  text: string
) {
  const k =
    kind === "ok"
      ? "badge badge-ok"
      : kind === "warn"
      ? "badge badge-warn"
      : kind === "danger"
      ? "badge badge-danger"
      : kind === "info"
      ? "badge badge-info"
      : "badge";
  return <span className={k}>{text}</span>;
}

export function SegTab({
  active,
  label,
  meta,
  onClick,
}: {
  active: boolean;
  label: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        "shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition",
        "focus-visible:outline-none",
        active
          ? "bg-[rgba(var(--brand),0.16)] text-[rgb(var(--fg))] shadow-[0_10px_24px_rgba(var(--brand),0.12)]"
          : "bg-[rgba(255,255,255,0.04)] text-[rgb(var(--fg-muted))] hover:bg-[rgba(255,255,255,0.07)] hover:text-[rgb(var(--fg))]"
      )}
      style={{ border: "1px solid rgba(255,255,255,0.10)" }}
    >
      <span className={cls(active ? "font-semibold" : "font-medium")}>
        {label}
      </span>

      {meta ? (
        <span
          className={cls(
            "text-[11px] px-2 py-[2px] rounded-full",
            active ? "text-[rgb(var(--fg))]" : "text-[rgb(var(--fg-muted))]"
          )}
          style={{
            background: active
              ? "rgba(255,255,255,0.10)"
              : "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          {meta}
        </span>
      ) : null}
    </button>
  );
}

export function KpiChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "info" | "ok" | "warn" | "danger";
}) {
  const glow =
    tone === "info"
      ? "rgba(var(--info),0.08)"
      : tone === "ok"
      ? "rgba(var(--success),0.08)"
      : tone === "warn"
      ? "rgba(var(--warning),0.10)"
      : tone === "danger"
      ? "rgba(var(--danger),0.10)"
      : "rgba(255,255,255,0.03)";

  return (
    <div
      className="surface-muted px-3 py-2 rounded-2xl"
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          `radial-gradient(600px 160px at 20% 0%, ${glow}, transparent 60%),` +
          "linear-gradient(180deg, rgba(var(--panel-2),0.92), rgba(var(--panel),0.90))",
      }}
    >
      <div className="text-[11px] muted">{label}</div>
      <div className="text-sm font-semibold" style={{ color: "rgb(var(--fg))" }}>
        {value}
      </div>
    </div>
  );
}

export function RowCard({
  left,
  mid,
  right,
  bottom,
}: {
  left: React.ReactNode;
  mid?: React.ReactNode;
  right?: React.ReactNode;
  bottom?: React.ReactNode;
}) {
  // IMPORTANT: Do NOT clip popovers/menus.
  return (
    <div className="panel p-4 space-y-3" style={{ overflow: "visible" }}>
      <div className="flex flex-col lg:flex-row lg:items-start gap-3">
        <div className="min-w-0 flex-1">{left}</div>
        {mid ? <div className="w-full lg:w-[360px] xl:w-[420px]">{mid}</div> : null}
        {right ? <div className="w-full lg:w-[220px]">{right}</div> : null}
      </div>
      {bottom ? <div>{bottom}</div> : null}
    </div>
  );
}
