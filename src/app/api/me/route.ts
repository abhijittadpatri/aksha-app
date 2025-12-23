import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

export async function GET(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    // Keep base user fetch light & explicit
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mustChangePassword: true,
        isActive: true,
        tenantId: true,
        tenant: { select: { name: true } },
        stores: {
          select: {
            store: {
              select: {
                id: true,
                name: true,
                city: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    // ✅ Block disabled users
    if (user.isActive === false) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }

    // ✅ Stores:
    // - SHOP_OWNER: all tenant stores (so sidebar/dashboard store switcher works)
    // - Others: only stores explicitly assigned via UserStore
    let stores: Array<{ id: string; name: string; city: string | null; isActive: boolean }> = [];

    if (user.role === "SHOP_OWNER") {
      const tenantStores = await prisma.store.findMany({
        where: { tenantId: user.tenantId },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        select: { id: true, name: true, city: true, isActive: true },
      });

      stores = tenantStores.map((s) => ({
        id: s.id,
        name: s.name,
        city: s.city ?? null,
        isActive: s.isActive !== false,
      }));
    } else {
      stores = (user.stores ?? [])
        .map((us) => us.store)
        .filter(Boolean)
        .map((s) => ({
          id: s.id,
          name: s.name,
          city: s.city ?? null,
          isActive: s.isActive !== false,
        }));
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        isActive: user.isActive !== false,
        tenant: user.tenant ? { name: user.tenant.name ?? null } : null,
        stores,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Me error" }, { status: 500 });
  }
}
