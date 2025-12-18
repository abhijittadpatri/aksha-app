import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";
import { hashPassword } from "@/lib/password";

type Ctx = { params: Promise<{ id: string }> };

function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

async function requireAdmin(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return null;

  const me = await prisma.user.findUnique({ where: { id: userId } });
  if (!me) return null;

  const role = String(me.role || "").toUpperCase();
  if (role !== "ADMIN" && role !== "OWNER") return null;

  return me;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireAdmin(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const tempPassword = String(body.tempPassword || "").trim();

    if (tempPassword.length < 6) {
      return NextResponse.json({ error: "Temp password must be 6+ characters" }, { status: 400 });
    }

    // Only reset within same tenant
    const target = await prisma.user.findFirst({
      where: { id, tenantId: me.tenantId },
      select: { id: true },
    });

    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const passwordHash = await hashPassword(tempPassword);

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Reset password error" }, { status: 500 });
  }
}
