import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

function getUserId(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

// GET /api/invoices?patientId=...
export async function GET(req: Request) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const url = new URL(req.url);
    const patientId = url.searchParams.get("patientId");
    if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, tenantId: user.tenantId },
    });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const invoices = await prisma.invoice.findMany({
      where: { tenantId: user.tenantId, patientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invoices });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Invoices GET error" }, { status: 500 });
  }
}

// POST /api/invoices { patientId, storeId, orderId, discount, paid, paymentMode }
export async function POST(req: Request) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

    if (!(user.role === "BILLING" || user.role === "ADMIN" || user.role === "SHOP_OWNER")) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const body = await req.json();
    const { patientId, storeId, orderId, discount, paid, paymentMode } = body;

    if (!patientId || !storeId || !orderId) {
      return NextResponse.json(
        { error: "patientId, storeId, orderId are required" },
        { status: 400 }
      );
    }

    const order = await prisma.spectacleOrder.findFirst({
      where: { id: orderId, tenantId: user.tenantId, patientId },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const items = (order.itemsJson as any)?.items ?? [];
    const subTotal = items.reduce((sum: number, it: any) => {
      const qty = Number(it.qty || 0);
      const rate = Number(it.rate || 0);
      return sum + qty * rate;
    }, 0);

    const disc = Number(discount || 0);
    const grandTotal = Math.max(0, subTotal - disc);

    const invoiceNo = `INV-${Date.now()}`; // prototype; later use sequence per store

const created = await prisma.invoice.create({
  data: {
    tenantId: user.tenantId,
    storeId,
    patientId,
    orderId,
    invoiceNo,

    // ✅ store everything here to match your schema
    totalsJson: {
      items: order.itemsJson?.items ?? [],
      subTotal,
      discount: disc,
      total: grandTotal,
      paid: Boolean(paid),
      paymentMode: paymentMode || "Cash",
    },

    // ✅ use schema field that exists (based on error)
    paymentStatus: Boolean(paid) ? "PAID" : "UNPAID",
  },
});


    return NextResponse.json({ invoice: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Invoices POST error" }, { status: 500 });
  }
}
