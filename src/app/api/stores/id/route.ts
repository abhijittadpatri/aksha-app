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

function parseBoolean(v: any): boolean | null {
  if (v === true || v === false) return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
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

    const storeId = String(ctx?.params?.id ?? "").trim();
    if (!storeId) {
      return NextResponse.json({ error: "Missing store id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = parseBoolean(body?.isActive);
    if (parsed === null) {
      return NextResponse.json(
        { error: "isActive must be a boolean" },
        { status: 400 }
      );
    }

    const store = await prisma.store.findFirst({
      where: { id: storeId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const updated = await prisma.store.update({
      where: { id: storeId },
      data: {
        isActive: parsed,
        disabledAt: parsed ? null : new Date(),
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

    return NextResponse.json({ store: updated });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Store update error" },
      { status: 500 }
    );
  }
}
