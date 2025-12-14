import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

function getUserId(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

// GET /api/orders?patientId=...
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

    const orders = await prisma.spectacleOrder.findMany({
      where: { tenantId: user.tenantId, patientId },
      orderBy: { createdAt: "desc" },
      include: { prescription: true },
    });

    return NextResponse.json({ orders });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Orders GET error" }, { status: 500 });
  }
}

// POST /api/orders { patientId, storeId, prescriptionId, itemsJson }
export async function POST(req: Request) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

    // Billing/Admin/ShopOwner can create orders
    if (!(user.role === "BILLING" || user.role === "ADMIN" || user.role === "SHOP_OWNER")) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const body = await req.json();
    const { patientId, storeId, prescriptionId, itemsJson } = body;

    if (!patientId || !storeId) {
      return NextResponse.json({ error: "patientId and storeId are required" }, { status: 400 });
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, tenantId: user.tenantId },
    });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const created = await prisma.spectacleOrder.create({
      data: {
        tenantId: user.tenantId,
        storeId,
        patientId,
        prescriptionId: prescriptionId || null,
        status: "Draft",
        itemsJson: itemsJson ?? {},
      },
    });

    return NextResponse.json({ order: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Orders POST error" }, { status: 500 });
  }
}
