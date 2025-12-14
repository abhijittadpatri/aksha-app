import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

function getUserId(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

// GET /api/patients?storeId=...
export async function GET(req: Request) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const url = new URL(req.url);
    const storeId = url.searchParams.get("storeId");
    if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

    const patients = await prisma.patient.findMany({
      where: { tenantId: user.tenantId, storeId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ patients });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Patients GET error" }, { status: 500 });
  }
}

// POST /api/patients  { storeId, name, mobile, age, gender, address }
export async function POST(req: Request) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const body = await req.json();
    const { storeId, name, mobile, age, gender, address } = body;

    if (!storeId || !name) {
      return NextResponse.json({ error: "storeId and name are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

    const patient = await prisma.patient.create({
      data: {
        tenantId: user.tenantId,
        storeId,
        name,
        mobile: mobile || null,
        age: age === "" || age === undefined ? null : Number(age),
        gender: gender || null,
        address: address || null,
      },
    });

    return NextResponse.json({ patient });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Patients POST error" }, { status: 500 });
  }
}
