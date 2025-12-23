import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

function canManage(role: any) {
  const r = String(role ?? "").toUpperCase();
  return r === "ADMIN" || r === "SHOP_OWNER";
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true, role: true, isActive: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }
    if (user.isActive === false) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }

    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "1";

    // Default behavior: return only ACTIVE stores (safe for pickers/modals).
    // Admin/Owner can request all stores by using ?all=1
    const where: any = {
      tenantId: user.tenantId,
      ...(all && canManage(user.role) ? {} : { isActive: true }),
    };

    const stores = await prisma.store.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        isActive: true,
        disabledAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ stores });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Stores error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true, role: true, isActive: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }
    if (user.isActive === false) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    if (!canManage(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const city = String(body?.city ?? "").trim();
    const address = String(body?.address ?? "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Store name is required" },
        { status: 400 }
      );
    }

    const store = await prisma.store.create({
      data: {
        tenantId: user.tenantId,
        name,
        city: city || null,
        address: address || null,
        isActive: true,
        disabledAt: null,
      },
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        isActive: true,
        disabledAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ store });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Create store error" },
      { status: 500 }
    );
  }
}
