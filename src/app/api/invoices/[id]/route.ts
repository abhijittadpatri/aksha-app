// src/app/api/invoices/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

async function requireUser(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) throw new Error("Not logged in");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { stores: true },
  });

  if (!user) throw new Error("User not found");

  const allowedStoreIds = (user.stores ?? []).map((s) => s.storeId);

  return {
    id: user.id,
    tenantId: user.tenantId,
    role: user.role,
    allowedStoreIds,
  };
}

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function computePaymentStatus(total: number, amountPaid: number) {
  if (amountPaid <= 0) return "Unpaid";
  if (amountPaid >= total) return "Paid";
  return "Partial";
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        patient: true,
        store: true,
        order: true,
        items: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const isOwner = user.role === "SHOP_OWNER";
    const isAdmin = user.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      if (!user.allowedStoreIds.includes(invoice.storeId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({ invoice });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status = msg === "Not logged in" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * PATCH /api/invoices/[id]
 * Body: { amountPaid: number, paymentMode: string }
 *
 * Writes to:
 * - invoice.paymentStatus (top-level)  ✅ keeps UI consistent
 * - totalsJson.amountPaid
 * - totalsJson.paymentMode
 * - totalsJson.paymentStatus (Paid | Partial | Unpaid)
 * - totalsJson.paid (boolean, optional)
 *
 * NOTE: No schema changes required.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    // Only Billing/Admin/ShopOwner should update payments
    if (!(user.role === "BILLING" || user.role === "ADMIN" || user.role === "SHOP_OWNER")) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Store authorization for non-owner/admin
    const isOwner = user.role === "SHOP_OWNER";
    const isAdmin = user.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      if (!user.allowedStoreIds.includes(invoice.storeId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const amountPaid = Math.max(0, safeNumber(body?.amountPaid));
    const paymentMode = String(body?.paymentMode ?? "Cash").trim() || "Cash";

    // Determine total from totalsJson.total or invoice.total (fallback)
    const totalsJson: any = (invoice as any).totalsJson ?? {};
    const total = safeNumber(totalsJson?.total ?? (invoice as any).total ?? 0);

    const paymentStatus = computePaymentStatus(total, amountPaid);

    const newTotals = {
      ...totalsJson,
      amountPaid,
      paymentMode,
      paymentStatus, // UI reads this ✅
      paid: paymentStatus === "Paid", // optional but helpful ✅
    };

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        totalsJson: newTotals,
        paymentStatus, // ✅ keep top-level in sync with totalsJson.paymentStatus
      },
      include: {
        patient: true,
        store: true,
        order: true,
        items: true,
      },
    });

    return NextResponse.json({ invoice: updated });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status = msg === "Not logged in" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
