// src/app/api/users/[id]/reset-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";
import { hashPassword } from "@/lib/password";

type Ctx = { params: Promise<{ id: string }> };

// --------------------
// Helpers
// --------------------
function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

function isAdminOrOwner(role: string) {
  const r = String(role || "").toUpperCase();
  // ✅ Match Prisma enum: SHOP_OWNER is the "owner"
  return r === "ADMIN" || r === "SHOP_OWNER";
}

async function requireAdminOrOwner(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return null;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    include: { stores: true },
  });
  if (!me) return null;

  if (!isAdminOrOwner(String(me.role))) return null;

  return me;
}

// --------------------
// POST /api/users/[id]/reset-password
// - ADMIN can reset only users within same tenant AND sharing at least one store
// - SHOP_OWNER can reset any user within same tenant
// - Sets mustChangePassword=true
// --------------------
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireAdminOrOwner(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const tempPassword = String(body.tempPassword || "").trim();

    if (tempPassword.length < 6) {
      return NextResponse.json({ error: "Temp password must be 6+ characters" }, { status: 400 });
    }

    // Target must be in same tenant
    const target = await prisma.user.findFirst({
      where: { id, tenantId: me.tenantId },
      include: { stores: true },
    });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // ADMIN scoping: must share at least one store
    const meRole = String(me.role).toUpperCase();
    if (meRole === "ADMIN") {
      const myStoreIds = new Set((me.stores ?? []).map((s) => s.storeId));
      const sharesStore = (target.stores ?? []).some((s) => myStoreIds.has(s.storeId));
      if (!sharesStore) {
        return NextResponse.json(
          { error: "Forbidden: you can only reset users in your stores" },
          { status: 403 }
        );
      }
    }

    const passwordHash = await hashPassword(tempPassword);

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    return NextResponse.json({
      ok: true,
      invite: {
        email: target.email,
        tempPassword,
        note: "User must change password at next login.",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Reset password error" }, { status: 500 });
  }
}
