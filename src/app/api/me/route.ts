import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const userId = getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);

    if (!userId) return NextResponse.json({ user: null });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        stores: { include: { store: true } },
      },
    });

    if (!user) return NextResponse.json({ user: null });

    const role = String(user.role ?? "").toUpperCase();

    // Default: only stores explicitly linked to user
    let stores = (user.stores ?? []).map((s) => s.store);

    // SHOP_OWNER: all stores in the tenant
    if (role === "SHOP_OWNER") {
      stores = await prisma.store.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { name: "asc" },
      });
    }

    // Return a minimal store shape (keeps payload small & consistent)
    const storePayload = stores.map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city ?? null,
    }));

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        tenant: user.tenant ? { id: user.tenant.id, name: user.tenant.name } : null,
        stores: storePayload,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { user: null, error: e?.message ?? "ME error" },
      { status: 500 }
    );
  }
}
