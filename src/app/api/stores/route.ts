import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

async function requireAdmin(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return null;

  const me = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!me) return null;

  const role = String(me.role || "").toUpperCase();
  if (role !== "ADMIN" && role !== "OWNER") return null;

  return me;
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireAdmin(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const stores = await prisma.store.findMany({
      where: { tenantId: me.tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, city: true },
    });

    return NextResponse.json({ stores });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Stores GET error" }, { status: 500 });
  }
}
