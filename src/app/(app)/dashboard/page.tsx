"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n: any) {
  return safeNumber(n).toFixed(2);
}

function pct(v: any) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function signedMoney(n: any) {
  const x = safeNumber(n);
  const sign = x >= 0 ? "+" : "-";
  return `${sign}₹${money(Math.abs(x))}`;
}

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type MetricDelta = { value: number; delta: number; deltaPct: number };
type AggBlock = {
  invoiceCount: MetricDelta;
  unpaidCount: MetricDelta;
  grossRevenue: MetricDelta;
  paidRevenue: MetricDelta;
  avgInvoiceValue: MetricDelta;
};

type InsightsOverviewResponse = {
  scope?: { id?: string; name?: string };
  tenant?: { today?: AggBlock; month?: AggBlock };
};

type Me = {
  role: "ADMIN" | "SHOP_OWNER" | "DOCTOR" | "BILLING";
  tenant?: { name?: string | null } | null;
};

function DeltaPill({ delta, deltaPctVal }: { delta: number; deltaPctVal: number }) {
  const up = safeNumber(delta) >= 0;
  return (
    <span className={cls("badge", up ? "badge-ok" : "badge-danger")}>
      {signedMoney(delta)} ({pct(deltaPctVal)})
    </span>
  );
}

function KpiCard({
  label,
  value,
  hint,
  delta,
  deltaPctVal,
  tone = "brand",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  deltaPctVal?: number;
  tone?: "brand" | "info" | "success" | "warning";
  icon?: string;
}) {
  const toneVar =
    tone === "info"
      ? "var(--info)"
      : tone === "success"
      ? "var(--success)"
      : tone === "warning"
      ? "var(--warning)"
      : "var(--brand)";

  return (
    <div
      className="panel p-4 transition"
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.05), 0 14px 34px rgba(0,0,0,0.30)",
        background:
          `radial-gradient(800px 260px at 20% 0%, rgba(${toneVar},0.10), transparent 60%), ` +
          "rgba(var(--panel),0.78)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label">{label}</div>
          <div className="kpi mt-2 leading-tight break-words">{value}</div>
        </div>

        {icon ? (
          <div
            className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: `rgba(${toneVar},0.14)`,
              border: `1px solid rgba(${toneVar},0.22)`,
              color: "rgb(var(--fg))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
            aria-hidden="true"
          >
            <span className="text-base">{icon}</span>
          </div>
        ) : null}
      </div>

      {delta !== undefined && deltaPctVal !== undefined ? (
        <div className="mt-2">
          <DeltaPill delta={delta} deltaPctVal={deltaPctVal} />
        </div>
      ) : null}

      {hint ? <div className="mt-2 text-xs muted">{hint}</div> : null}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <div className="h2">{title}</div>
        {subtitle ? <div className="subtle mt-1">{subtitle}</div> : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

function ActionTile({
  href,
  title,
  subtitle,
  icon,
  tone = "brand",
}: {
  href: string;
  title: string;
  subtitle: string;
  icon: string;
  tone?: "brand" | "info" | "success" | "warning";
}) {
  const toneVar =
    tone === "info"
      ? "var(--info)"
      : tone === "success"
      ? "var(--success)"
      : tone === "warning"
      ? "var(--warning)"
      : "var(--brand)";

  return (
    <Link
      href={href}
      className="panel p-4 block transition"
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          `radial-gradient(900px 260px at 15% 0%, rgba(${toneVar},0.10), transparent 60%), ` +
          "rgba(var(--panel),0.76)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: `rgba(${toneVar},0.14)`,
            border: `1px solid rgba(${toneVar},0.22)`,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
          aria-hidden="true"
        >
          <span>{icon}</span>
        </div>

        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{title}</div>
          <div className="text-xs muted truncate">{subtitle}</div>
        </div>

        <div className="ml-auto text-xs muted">→</div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [data, setData] = useState<InsightsOverviewResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeStoreId =
    typeof window !== "undefined" ? localStorage.getItem("activeStoreId") : "";

  const qs = useMemo(() => {
    if (!activeStoreId) return "";
    return `?storeId=${encodeURIComponent(activeStoreId)}`;
  }, [activeStoreId]);

  async function loadMe() {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      setMe((json.user as Me) ?? null);
    } catch {
      setMe(null);
    }
  }

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/insights/overview${qs}`, { credentials: "include" });

      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok) {
        setErr(json.error ?? "Failed to load dashboard");
        setData(null);
        setLoading(false);
        return;
      }

      setData(json);
      setLoading(false);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load dashboard");
      setData(null);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    if (me === undefined) return;
    if (me === null) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.role, qs]);

  // Reload when store changes in other tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "activeStoreId") load();
    }
    window.addEventListener("storage", onStorage);

    const t = setInterval(() => {
      const current = localStorage.getItem("activeStoreId") || "";
      if (current !== (activeStoreId || "")) load();
    }, 1400);

    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStoreId]);

  if (me === null) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  const tenantToday = data?.tenant?.today;
  const tenantMonth = data?.tenant?.month;

  const scopeLabel =
    (data?.scope?.id === "all" ? "All Stores" : data?.scope?.name) ??
    (activeStoreId === "all" ? "All Stores" : "Store");

  const canSeeInsights = me?.role === "ADMIN" || me?.role === "SHOP_OWNER";
  const canSeePatients = me?.role === "ADMIN" || me?.role === "SHOP_OWNER" || me?.role === "DOCTOR" || me?.role === "BILLING";
  const canSeeInvoices = me?.role === "ADMIN" || me?.role === "SHOP_OWNER" || me?.role === "BILLING";

  return (
    <main
      className="p-4 md:p-6"
      style={{
        background:
          "radial-gradient(1100px 520px at 10% 0%, rgba(var(--brand),0.10), transparent 60%)," +
          "radial-gradient(900px 520px at 90% 0%, rgba(var(--info),0.08), transparent 60%)," +
          "radial-gradient(900px 520px at 60% 110%, rgba(var(--success),0.06), transparent 60%)",
      }}
    >
      <div className="page space-y-4">
        {/* Header */}
        <div className="card card-pad">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h1 className="h1">Dashboard</h1>
              <p className="subtle truncate">
                Scope: {scopeLabel}
                {me?.tenant?.name ? ` • ${me.tenant.name}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                className="btn btn-secondary w-full sm:w-auto"
                onClick={load}
                disabled={loading}
                type="button"
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          {err ? (
            <div
              className="mt-3 rounded-xl px-3 py-2 text-sm"
              style={{
                background: "rgba(var(--danger),0.16)",
                border: "1px solid rgba(var(--danger),0.24)",
              }}
            >
              {err}
            </div>
          ) : null}
        </div>

        {!data && !err && (
          <div className="panel p-5">
            <div className="h2">{loading ? "Loading…" : "No data yet"}</div>
            <div className="subtle mt-1">
              {activeStoreId ? "If this looks wrong, try Refresh." : "Select a store in the sidebar."}
            </div>
          </div>
        )}

        {data ? (
          <>
            {/* TODAY */}
            <div className="card card-pad">
              <SectionHeader
                title="Today"
                subtitle="High-signal metrics for what’s happening right now."
                right={<span className="badge badge-info">Scope: {scopeLabel}</span>}
              />

              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <KpiCard
                  label="Gross revenue"
                  value={`₹${money(tenantToday?.grossRevenue?.value ?? 0)}`}
                  delta={tenantToday?.grossRevenue?.delta ?? 0}
                  deltaPctVal={tenantToday?.grossRevenue?.deltaPct ?? 0}
                  hint="Total billed (before payment status)."
                  tone="brand"
                  icon="₹"
                />
                <KpiCard
                  label="Paid revenue"
                  value={`₹${money(tenantToday?.paidRevenue?.value ?? 0)}`}
                  delta={tenantToday?.paidRevenue?.delta ?? 0}
                  deltaPctVal={tenantToday?.paidRevenue?.deltaPct ?? 0}
                  hint="Collected amount for today."
                  tone="success"
                  icon="✓"
                />
                <KpiCard
                  label="Invoices"
                  value={`${tenantToday?.invoiceCount?.value ?? 0}`}
                  hint={`Unpaid: ${tenantToday?.unpaidCount?.value ?? 0}`}
                  tone="info"
                  icon="🧾"
                />
                <KpiCard
                  label="Avg invoice"
                  value={`₹${money(tenantToday?.avgInvoiceValue?.value ?? 0)}`}
                  delta={tenantToday?.avgInvoiceValue?.delta ?? 0}
                  deltaPctVal={tenantToday?.avgInvoiceValue?.deltaPct ?? 0}
                  hint="Average value per invoice today."
                  tone="warning"
                  icon="∅"
                />
              </div>
            </div>

            {/* MONTH */}
            <div className="card card-pad">
              <SectionHeader
                title="Month to date"
                subtitle="Trends and totals since the start of the month."
              />

              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <KpiCard
                  label="Gross revenue"
                  value={`₹${money(tenantMonth?.grossRevenue?.value ?? 0)}`}
                  delta={tenantMonth?.grossRevenue?.delta ?? 0}
                  deltaPctVal={tenantMonth?.grossRevenue?.deltaPct ?? 0}
                  hint="Month-to-date billed revenue."
                  tone="brand"
                  icon="₹"
                />
                <KpiCard
                  label="Paid revenue"
                  value={`₹${money(tenantMonth?.paidRevenue?.value ?? 0)}`}
                  delta={tenantMonth?.paidRevenue?.delta ?? 0}
                  deltaPctVal={tenantMonth?.paidRevenue?.deltaPct ?? 0}
                  hint="Month-to-date collected amount."
                  tone="success"
                  icon="✓"
                />
                <KpiCard
                  label="Invoices"
                  value={`${tenantMonth?.invoiceCount?.value ?? 0}`}
                  hint={`Unpaid: ${tenantMonth?.unpaidCount?.value ?? 0}`}
                  tone="info"
                  icon="🧾"
                />
                <KpiCard
                  label="Avg invoice"
                  value={`₹${money(tenantMonth?.avgInvoiceValue?.value ?? 0)}`}
                  delta={tenantMonth?.avgInvoiceValue?.delta ?? 0}
                  deltaPctVal={tenantMonth?.avgInvoiceValue?.deltaPct ?? 0}
                  hint="Average value per invoice this month."
                  tone="warning"
                  icon="∅"
                />
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="card card-pad">
              <SectionHeader title="Quick actions" subtitle="Jump to the most used pages." />

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                {canSeePatients ? (
                  <ActionTile
                    href="/patients"
                    title="Patients"
                    subtitle="Search, add, and manage patient records."
                    icon="👥"
                    tone="brand"
                  />
                ) : null}

                {canSeeInvoices ? (
                  <ActionTile
                    href="/invoices"
                    title="Invoices"
                    subtitle="View invoices, payment status, and totals."
                    icon="🧾"
                    tone="info"
                  />
                ) : null}

                {canSeeInsights ? (
                  <ActionTile
                    href="/insights"
                    title="Insights"
                    subtitle="Revenue, trends, and performance breakdowns."
                    icon="📈"
                    tone="success"
                  />
                ) : null}
              </div>

              {!activeStoreId ? (
                <div className="mt-3 text-xs muted">
                  Tip: Select an active store from the sidebar to see accurate totals.
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
