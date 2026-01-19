// src/components/patients/PatientOrdersTab.tsx
"use client";

import React from "react";
import PopoverMenu from "@/components/ui/PopoverMenu";
import {
  cls,
  safeDate,
  money,
  statusBadge,
  KpiChip,
  RowCard,
  safeNumber,
} from "@/components/patients/patientUi";

export default function PatientOrdersTab({
  orders,
  orderErr,
  invErr,
  billedOrderIds,
  invoiceByOrderId,
  invActionLoading,

  onCreateOrder,
  onRefreshOrders,

  orderComputed,

  invoiceTotal,
  invoicePaymentStatus,
  invoiceAmountPaid,

  onGenerateInvoiceForOrder,
  onOpenInvoiceById,
  onOpenPaymentModal,
  onUpdateOrderStatus,
}: {
  orders: any[];
  orderErr: string | null;
  invErr: string | null;

  billedOrderIds: Set<string>;
  invoiceByOrderId: Map<string, any>;
  invActionLoading: string | null;

  onCreateOrder: () => void;
  onRefreshOrders: () => void;

  orderComputed: (o: any) => {
    breakdown: any;
    total: number;
    adv: number;
    balance: number;
  };

  invoiceTotal: (inv: any) => number;
  invoicePaymentStatus: (inv: any) => "Paid" | "Partial" | "Unpaid";
  invoiceAmountPaid: (inv: any) => number;

  onGenerateInvoiceForOrder: (orderId: string) => void | Promise<void>;
  onOpenInvoiceById: (invoiceId: string) => void;
  onOpenPaymentModal: (inv: any) => void;

  onUpdateOrderStatus: (orderId: string, status: string) => void | Promise<void>;
}) {
  const [orderMenuFor, setOrderMenuFor] = React.useState<string | null>(null);
  const [orderMenuAnchor, setOrderMenuAnchor] = React.useState<HTMLElement | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="h2">Orders</div>

        <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
          <button className="btn btn-primary" type="button" onClick={onCreateOrder}>
            + Create Order
          </button>
          <button className="btn btn-secondary" type="button" onClick={onRefreshOrders}>
            Refresh
          </button>
        </div>
      </div>

      {orderErr && (
        <div className="panel p-3">
          <div className="text-sm" style={{ color: "rgb(var(--danger))" }}>
            {orderErr}
          </div>
        </div>
      )}

      {invErr && (
        <div className="panel p-3">
          <div className="text-sm" style={{ color: "rgb(var(--danger))" }}>
            {invErr}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {orders.map((o) => {
          const orderId = String(o.id);
          const billed = billedOrderIds.has(orderId);
          const oc = orderComputed(o);

          const inv = invoiceByOrderId.get(orderId) ?? null;
          const invPS = inv ? invoicePaymentStatus(inv) : null;
          const invTotal = inv ? invoiceTotal(inv) : 0;

          // balance derived from invoice status (if exists)
          let displayBalance = oc.balance;
          if (inv) {
            const paidAmt = invoiceAmountPaid(inv);
            const totalAmt = invoiceTotal(inv);
            const ps = invoicePaymentStatus(inv);
            if (ps === "Paid") displayBalance = 0;
            else if (ps === "Partial") displayBalance = Math.max(0, totalAmt - paidAmt);
          }

          // primary CTA based on state
          let primaryLabel = "Generate Invoice";
          let primaryAction: () => void | Promise<void> = () => onGenerateInvoiceForOrder(String(o.id));
          let primaryKind: "primary" | "secondary" = "primary";

          if (billed && inv?.id) {
            if (invPS === "Paid") {
              primaryLabel = "Open Invoice";
              primaryAction = () => onOpenInvoiceById(String(inv.id));
              primaryKind = "secondary";
            } else {
              primaryLabel = "Record Payment";
              primaryAction = () => onOpenPaymentModal(inv);
              primaryKind = "primary";
            }
          }

          const pills: Array<{ key: string; node: React.ReactNode }> = [
            { key: `o-status-${orderId}`, node: o.status ? <span className="badge">{String(o.status)}</span> : null },
            { key: `o-billed-${orderId}`, node: billed ? statusBadge("ok", "Billed") : statusBadge("warn", "Unbilled") },
            ...(invPS
              ? [
                  {
                    key: `o-pay-${orderId}`,
                    node:
                      invPS === "Paid"
                        ? statusBadge("ok", "Paid")
                        : invPS === "Partial"
                        ? statusBadge("warn", "Partial")
                        : statusBadge("warn", "Unpaid"),
                  },
                ]
              : []),
          ].filter((p) => p.node != null);

          return (
            <RowCard
              key={orderId}
              left={
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {pills.map((p) => (
                      <span key={p.key}>{p.node}</span>
                    ))}
                  </div>

                  <div className="mt-1 text-sm font-semibold">Order</div>
                  <div className="text-xs muted truncate">
                    {safeDate(o.createdAt)} • Order ID: {String(o.id).slice(-6)} • Rx: {o.prescriptionId ?? "—"}
                  </div>

                  {inv?.invoiceNo ? (
                    <div className="text-xs muted truncate">
                      Invoice:{" "}
                      <span style={{ color: "rgb(var(--fg))", fontWeight: 600 }}>{inv.invoiceNo}</span> • ₹{money(invTotal)}
                    </div>
                  ) : (
                    <div className="text-xs muted truncate">Invoice: —</div>
                  )}
                </div>
              }
              mid={
                <div className="grid grid-cols-3 gap-2">
                  <KpiChip label="Total" value={`₹${money(inv ? invTotal : oc.total)}`} tone="info" />
                  <KpiChip
                    label="Advance/Paid"
                    value={`₹${money(inv ? invoiceAmountPaid(inv) : oc.adv)}`}
                    tone="ok"
                  />
                  <KpiChip
                    label="Balance"
                    value={`₹${money(displayBalance)}`}
                    tone={safeNumber(displayBalance) <= 0 ? "ok" : "warn"}
                  />
                </div>
              }
              right={
                <div className="flex flex-col gap-2 lg:items-end">
                  <button
                    className={cls("btn w-full", primaryKind === "primary" ? "btn-primary" : "btn-secondary")}
                    type="button"
                    onClick={primaryAction}
                    disabled={invActionLoading === orderId}
                  >
                    {invActionLoading === orderId ? "Working…" : primaryLabel}
                  </button>

                  <button
                    className="btn btn-ghost w-full"
                    type="button"
                    onClick={(e) => {
                      const nextId = orderMenuFor === orderId ? null : orderId;
                      setOrderMenuFor(nextId);
                      setOrderMenuAnchor(nextId ? (e.currentTarget as HTMLElement) : null);
                    }}
                  >
                    More •••
                  </button>

                  <PopoverMenu
                    open={orderMenuFor === orderId}
                    anchorEl={orderMenuAnchor}
                    onClose={() => {
                      setOrderMenuFor(null);
                      setOrderMenuAnchor(null);
                    }}
                    items={[
                      {
                        id: `ready-${orderId}`,
                        label: "Mark Ready",
                        onClick: () => onUpdateOrderStatus(orderId, "Ready"),
                        disabled: invActionLoading === orderId,
                      },
                      {
                        id: `delivered-${orderId}`,
                        label: "Mark Delivered",
                        onClick: () => onUpdateOrderStatus(orderId, "Delivered"),
                        disabled: invActionLoading === orderId,
                      },
                      ...(inv?.id
                        ? [
                            {
                              id: `openinv-${orderId}`,
                              label: "Open Invoice",
                              onClick: () => onOpenInvoiceById(String(inv.id)),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              }
              bottom={
                oc.breakdown?.notes ? (
                  <div className="surface-muted p-3">
                    <div className="text-xs muted mb-1">Notes</div>
                    <div className="text-sm" style={{ color: "rgb(var(--fg-muted))" }}>
                      {String(oc.breakdown.notes)}
                    </div>
                  </div>
                ) : null
              }
            />
          );
        })}

        {orders.length === 0 && <div className="panel p-4 text-sm muted">No orders yet.</div>}
      </div>
    </div>
  );
}
