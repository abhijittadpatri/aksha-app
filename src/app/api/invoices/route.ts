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

// GET /api/invoices?patientId=...&storeId=...
// ✅ patientId is OPTIONAL
// ✅ storeId can be "all" for SHOP_OWNER
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);

    const url = new URL(req.url);
    const patientId = url.searchParams.get("patientId");
    const storeIdParam = url.searchParams.get("storeId");

    // Owner can view "all" stores (within their allowed stores set)
    const isOwner = user.role === "SHOP_OWNER";
    const isAllStores = isOwner && storeIdParam === "all";

    // Decide store scope
    let storeFilter: any = undefined;

    if (isAllStores) {
      // All stores owner has access to
      storeFilter = { in: user.allowedStoreIds };
    } else if (storeIdParam) {
      // Single store; must be allowed
      if (!user.allowedStoreIds.includes(storeIdParam)) {
        return NextResponse.json({ error: "No store access" }, { status: 403 });
      }
      storeFilter = storeIdParam;
    } else {
      // Default to first allowed store (safe fallback)
      if (!user.allowedStoreIds.length) {
        return NextResponse.json({ error: "No store access" }, { status: 403 });
      }
      storeFilter = user.allowedStoreIds[0];
    }

    // Build WHERE
    const where: any = {
      tenantId: user.tenantId,
      ...(storeFilter
        ? typeof storeFilter === "string"
          ? { storeId: storeFilter }
          : { storeId: storeFilter }
        : {}),
    };

    // ✅ Only filter by patientId if provided
    if (patientId) {
      // Ensure patient belongs to tenant (so random IDs don't leak existence)
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
// ✅ Enforce store access; owner can create for any allowed store, admin for allowed, billing for allowed
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

    // Store access check (owner/admin/billing can only create within allowed stores)
    if (!user.allowedStoreIds.includes(storeId)) {
      return NextResponse.json({ error: "No store access" }, { status: 403 });
    }

    // Validate patient within tenant and store (optional: you can remove store check if patient is chain-wide)
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
        // Your schema default is "Unpaid" — keep consistent casing
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
