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

    // 🔑 OWNER sees ALL stores in tenant
    let stores = user.stores.map((s) => s.store);

    if (user.role === "OWNER") {
      const allStores = await prisma.store.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { name: "asc" },
      });
      stores = allStores;
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        tenant: user.tenant,
        stores,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { user: null, error: e?.message ?? "ME error" },
      { status: 500 }
    );
  }
}
