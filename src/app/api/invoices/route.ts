// src/app/api/invoices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

function getOrderItems(itemsJson: any): any[] {
  if (!itemsJson) return [];
  if (typeof itemsJson === "object" && Array.isArray(itemsJson.items)) return itemsJson.items;
  return [];
}

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

  // For SHOP_OWNER, we allow all stores in the tenant
  let allowedStoreIds = (user.stores ?? []).map((s) => s.storeId);

  if (user.role === "SHOP_OWNER") {
    const allStores = await prisma.store.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true },
    });
    allowedStoreIds = allStores.map((s) => s.id);
  }

  return {
    id: user.id,
    tenantId: user.tenantId,
    role: user.role as any,
    allowedStoreIds,
  };
}

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// GET /api/invoices?patientId=...&storeId=...
// patientId OPTIONAL
// storeId can be "all" for SHOP_OWNER
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);

    const url = new URL(req.url);
    const patientId = url.searchParams.get("patientId");
    const storeIdParam = url.searchParams.get("storeId");

    const isOwner = user.role === "SHOP_OWNER";
    const isAllStores = isOwner && storeIdParam === "all";

    // Store scope
    let storeWhere: any = undefined;

    if (isAllStores) {
      storeWhere = { in: user.allowedStoreIds };
    } else if (storeIdParam) {
      if (!user.allowedStoreIds.includes(storeIdParam)) {
        return NextResponse.json({ error: "No store access" }, { status: 403 });
      }
      storeWhere = storeIdParam;
    } else {
      if (!user.allowedStoreIds.length) {
        return NextResponse.json({ error: "No store access" }, { status: 403 });
      }
      storeWhere = user.allowedStoreIds[0];
    }

    const where: any = {
      tenantId: user.tenantId,
      ...(storeWhere ? { storeId: storeWhere } : {}),
    };

    // Optional patient filter
    if (patientId) {
      const patient = await prisma.patient.findFirst({
        where: { id: patientId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

      where.patientId = patientId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: patientId ? 200 : 100, // list page: limit to recent; patient view: allow more
      include: {
        patient: { select: { id: true, name: true, mobile: true } },
        store: { select: { id: true, name: true, city: true } },
      },
    });

    return NextResponse.json({ invoices });
  } catch (e: any) {
    const msg = e?.message ?? "Invoices GET error";
    const status = msg === "Not logged in" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// POST /api/invoices { patientId, storeId, orderId, discount, paid, paymentMode }
// Enforce store access; billing/admin/owner can create within allowed stores
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);

    if (!(user.role === "BILLING" || user.role === "ADMIN" || user.role === "SHOP_OWNER")) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const patientId = String(body.patientId ?? "").trim();
    const storeId = String(body.storeId ?? "").trim();
    const orderId = String(body.orderId ?? "").trim();

    const discount = safeNumber(body.discount);
    const paid = Boolean(body.paid);
    const paymentMode = String(body.paymentMode ?? "Cash");

    if (!patientId || !storeId || !orderId) {
      return NextResponse.json(
        { error: "patientId, storeId, orderId are required" },
        { status: 400 }
      );
    }

    if (!user.allowedStoreIds.includes(storeId)) {
      return NextResponse.json({ error: "No store access" }, { status: 403 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const order = await prisma.spectacleOrder.findFirst({
      where: { id: orderId, tenantId: user.tenantId, patientId, storeId },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const items = getOrderItems(order.itemsJson);
    const subTotal = items.reduce((sum: number, it: any) => {
      const qty = safeNumber(it.qty);
      const rate = safeNumber(it.rate);
      return sum + qty * rate;
    }, 0);

    const disc = safeNumber(discount);
    const grandTotal = Math.max(0, subTotal - disc);

    const invoiceNo = `INV-${Date.now()}`; // prototype

    const created = await prisma.invoice.create({
      data: {
        tenantId: user.tenantId,
        storeId,
        patientId,
        orderId,
        invoiceNo,
        totalsJson: {
          items,
          subTotal,
          discount: disc,
          total: grandTotal,
          paid,
          paymentMode: paymentMode || "Cash",
        },
        paymentStatus: paid ? "Paid" : "Unpaid",
      },
    });

    return NextResponse.json({ invoice: created });
  } catch (e: any) {
    const msg = e?.message ?? "Invoices POST error";
    const status = msg === "Not logged in" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
