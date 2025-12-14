import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

function getUserId(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

// GET /api/prescriptions?patientId=...
export async function GET(req: Request) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const url = new URL(req.url);
    const patientId = url.searchParams.get("patientId");
    if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

    // Ensure patient belongs to same tenant
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, tenantId: user.tenantId },
    });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const prescriptions = await prisma.prescription.findMany({
      where: { tenantId: user.tenantId, patientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ prescriptions });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Prescriptions GET error" }, { status: 500 });
  }
}

// POST /api/prescriptions { patientId, storeId, rxJson }
export async function POST(req: Request) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

    // RBAC: only Doctor/Admin/ShopOwner can create prescriptions
    if (!(user.role === "DOCTOR" || user.role === "ADMIN" || user.role === "SHOP_OWNER")) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const body = await req.json();
    const { patientId, storeId, rxJson } = body;

    if (!patientId || !storeId || !rxJson) {
      return NextResponse.json(
        { error: "patientId, storeId and rxJson are required" },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, tenantId: user.tenantId },
    });
    if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

    const created = await prisma.prescription.create({
      data: {
        tenantId: user.tenantId,
        storeId,
        patientId,
        rxJson,
      },
    });

    return NextResponse.json({ prescription: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Prescriptions POST error" }, { status: 500 });
  }
}
