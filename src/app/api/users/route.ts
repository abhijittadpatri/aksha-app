import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";
import { hashPassword } from "@/lib/password";

function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

async function requireAdmin(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return null;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    include: { stores: true },
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

    const users = await prisma.user.findMany({
      where: { tenantId: me.tenantId },
      orderBy: { createdAt: "desc" },
      include: { stores: { include: { store: true } } },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        mustChangePassword: u.mustChangePassword,
        stores: u.stores.map((s) => ({ id: s.store.id, name: s.store.name })),
        createdAt: u.createdAt,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Users GET error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireAdmin(req);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const role = String(body.role || "BILLING").toUpperCase();
    const storeIds: string[] = Array.isArray(body.storeIds) ? body.storeIds : [];
    const tempPassword = String(body.tempPassword || "").trim();

    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
    if (!tempPassword || tempPassword.length < 6)
      return NextResponse.json({ error: "Temp password must be at least 6 chars" }, { status: 400 });

    // Limit roles (keep safe)
    const allowedRoles = ["ADMIN", "OWNER", "DOCTOR", "BILLING"];
    if (!allowedRoles.includes(role))
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });

    // Ensure stores belong to same tenant
    const stores = await prisma.store.findMany({
      where: { tenantId: me.tenantId, id: { in: storeIds } },
      select: { id: true },
    });

    if (storeIds.length > 0 && stores.length !== storeIds.length) {
      return NextResponse.json({ error: "One or more stores invalid" }, { status: 400 });
    }

    const passwordHash = await hashPassword(tempPassword);

    const created = await prisma.user.create({
      data: {
        tenantId: me.tenantId,
        email,
        name: name || null,
        role: role as any,
        passwordHash,
        mustChangePassword: true,
        stores: {
          create: stores.map((s) => ({ storeId: s.id })),
        },
      },
    });

    return NextResponse.json({ ok: true, userId: created.id });
  } catch (e: any) {
    // Handle unique email error gracefully
    const msg = String(e?.message ?? "");
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("email")) {
      return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: e?.message ?? "Users POST error" }, { status: 500 });
  }
}
