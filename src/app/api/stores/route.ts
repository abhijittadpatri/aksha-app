import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

function roleOf(v: any) {
  return String(v ?? "").toUpperCase();
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const me = await prisma.user.findUnique({
      where: { id: userId },
      include: { stores: true },
    });

    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = roleOf(me.role);

    // ✅ Allow only Admin + Shop Owner for now
    if (role !== "ADMIN" && role !== "SHOP_OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ✅ SHOP_OWNER sees all tenant stores
    if (role === "SHOP_OWNER") {
      const stores = await prisma.store.findMany({
        where: { tenantId: me.tenantId },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, city: true },
      });

      return NextResponse.json({ stores });
    }

    // ✅ ADMIN: only stores they are assigned to
    const allowedStoreIds = (me.stores ?? []).map((s) => s.storeId);

    const stores = await prisma.store.findMany({
      where: { tenantId: me.tenantId, id: { in: allowedStoreIds } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, city: true },
    });

    return NextResponse.json({ stores });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Stores GET error" }, { status: 500 });
  }
}
