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

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true, role: true, isActive: true },
    });

    if (!me) return NextResponse.json({ error: "User not found" }, { status: 401 });
    if (me.isActive === false)
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    if (!canManage(me.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await ctx.params;
    const targetUserId = String(id ?? "").trim();
    if (!targetUserId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const isActive = Boolean(body?.isActive);

    const target = await prisma.user.findFirst({
      where: { id: targetUserId, tenantId: me.tenantId },
      select: { id: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        isActive,
        disabledAt: isActive ? null : new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mustChangePassword: true,
        isActive: true,
        disabledAt: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "User status update error" },
      { status: 500 }
    );
  }
}
