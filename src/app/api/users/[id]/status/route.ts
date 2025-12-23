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

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const adminId = getUserId(req);
    if (!adminId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { tenantId: true, role: true, isActive: true },
    });

    if (!admin) return NextResponse.json({ error: "User not found" }, { status: 401 });
    if (admin.isActive === false) return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    if (!canManage(admin.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const userId = String(ctx?.params?.id ?? "").trim();
    if (!userId) return NextResponse.json({ error: "Missing user id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const isActive = Boolean(body?.isActive);

    // Ensure target user belongs to same tenant
    const target = await prisma.user.findFirst({
      where: { id: userId, tenantId: admin.tenantId },
      select: { id: true, role: true },
    });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Optional safety: prevent disabling yourself
    if (userId === adminId) {
      return NextResponse.json({ error: "You cannot disable your own account." }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
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
    return NextResponse.json({ error: e?.message ?? "User status error" }, { status: 500 });
  }
}
