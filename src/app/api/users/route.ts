// src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";
import { hashPassword } from "@/lib/password";

// =====================
// Helpers
// =====================
function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

type AuthedUser = {
  id: string;
  tenantId: string;
  role: string;
  allowedStoreIds: string[];
};

async function requireAuthed(req: NextRequest): Promise<AuthedUser> {
  const userId = getUserId(req);
  if (!userId) throw new Error("Not logged in");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { stores: true },
  });

  if (!user) throw new Error("User not found");

  const allowedStoreIds = (user.stores ?? []).map((s) => s.storeId);

  return {
    id: user.id,
    tenantId: user.tenantId,
    role: String(user.role),
    allowedStoreIds,
  };
}

// ✅ Canonical role checks (match Prisma schema)
function isShopOwner(role: string) {
  return role === "SHOP_OWNER";
}
function isAdmin(role: string) {
  return role === "ADMIN";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateTempPassword(pw: string) {
  const t = (pw ?? "").trim();
  if (t.length < 6) return "Temp password must be at least 6 characters.";
  return null;
}

// Creation policy:
// - SHOP_OWNER: cannot be created via API (manual only)
// - SHOP_OWNER can create: ADMIN, DOCTOR, BILLING
// - ADMIN can create: DOCTOR, BILLING
function canCreateRole(creatorRole: string, targetRole: string) {
  if (targetRole === "SHOP_OWNER") return false;

  if (isShopOwner(creatorRole)) {
    return ["ADMIN", "DOCTOR", "BILLING"].includes(targetRole);
  }

  if (isAdmin(creatorRole)) {
    return ["DOCTOR", "BILLING"].includes(targetRole);
  }

  return false;
}

// =====================
// GET /api/users
// - SHOP_OWNER: all users in tenant
// - ADMIN: users who share at least 1 store with admin
// =====================
export async function GET(req: NextRequest) {
  try {
    const me = await requireAuthed(req);

    if (!isShopOwner(me.role) && !isAdmin(me.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (isShopOwner(me.role)) {
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
          mustChangePassword: (u as any).mustChangePassword ?? false,
          createdAt: u.createdAt,
          stores: (u.stores ?? []).map((s) => s.store),
        })),
      });
    }

    // ADMIN: only users who have any store that admin has access to
    const users = await prisma.user.findMany({
      where: {
        tenantId: me.tenantId,
        stores: { some: { storeId: { in: me.allowedStoreIds } } },
      },
      orderBy: { createdAt: "desc" },
      include: { stores: { include: { store: true } } },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        mustChangePassword: (u as any).mustChangePassword ?? false,
        createdAt: u.createdAt,
        stores: (u.stores ?? []).map((s) => s.store),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Users GET error" }, { status: 500 });
  }
}

// =====================
// POST /api/users
// Create user with temp password + mustChangePassword=true
// - SHOP_OWNER cannot be created here (manual only)
// - ADMIN cannot create ADMIN/SHOP_OWNER
// - StoreIds must be within creator’s store access unless creator is SHOP_OWNER
// =====================
export async function POST(req: NextRequest) {
  try {
    const me = await requireAuthed(req);

    if (!isShopOwner(me.role) && !isAdmin(me.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(String(body.email ?? ""));
    const name = String(body.name ?? "").trim() || null;
    const role = String(body.role ?? "BILLING").trim(); // must match Prisma enum strings
    const storeIds = Array.isArray(body.storeIds) ? body.storeIds.map(String) : [];
    const tempPassword = String(body.tempPassword ?? "");

    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    if (!storeIds.length) return NextResponse.json({ error: "Select at least one store" }, { status: 400 });

    // Enforce role policy
    if (!canCreateRole(me.role, role)) {
      return NextResponse.json(
        { error: role === "SHOP_OWNER" ? "Shop owners must be created manually" : "Not allowed to create this role" },
        { status: 403 }
      );
    }

    // Enforce store scoping
    if (!isShopOwner(me.role)) {
      // Admin can only assign within their own stores
      const bad = storeIds.find((id: string) => !me.allowedStoreIds.includes(id));
      if (bad) {
        return NextResponse.json({ error: "You can only assign users to your stores" }, { status: 403 });
      }
    } else {
      // SHOP_OWNER: ensure stores belong to tenant (safety)
      const count = await prisma.store.count({
        where: { id: { in: storeIds }, tenantId: me.tenantId },
      });
      if (count !== storeIds.length) {
        return NextResponse.json({ error: "One or more stores are invalid for this tenant" }, { status: 400 });
      }
    }

    const pwErr = validateTempPassword(tempPassword);
    if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

    // Prevent duplicates
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(tempPassword.trim());

    const created = await prisma.user.create({
      data: {
        tenantId: me.tenantId,
        email,
        name,
        role: role as any,
        passwordHash,
        mustChangePassword: true,
        stores: {
          create: storeIds.map((storeId: string) => ({ storeId })),
        },
      } as any,
      include: { stores: { include: { store: true } } },
    });

    return NextResponse.json({
      user: {
        id: created.id,
        email: created.email,
        name: created.name,
        role: created.role,
        mustChangePassword: (created as any).mustChangePassword ?? true,
        stores: (created.stores ?? []).map((s) => s.store),
      },
      invite: {
        email: created.email,
        tempPassword: tempPassword.trim(),
        note: "User must change password at next login.",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Users POST error" }, { status: 500 });
  }
}
