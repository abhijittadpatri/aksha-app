import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const me = await prisma.user.findUnique({
      where: { id: userId },
      include: { stores: true, tenant: true },
    });
    if (!me) return NextResponse.json({ error: "User not found" }, { status: 401 });

    // Only OWNER/ADMIN can run setup
    const role = String(me.role || "");
    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const city = String(body?.city ?? "").trim();
    const address = String(body?.address ?? "").trim();

    if (!name) return NextResponse.json({ error: "Store name is required" }, { status: 400 });

    // Create store
    const store = await prisma.store.create({
      data: {
        tenantId: me.tenantId,
        name,
        city: city || null,
        address: address || null,
      },
    });

    // Link current user to this store (UserStore join table)
    // If your join model uses different field names, adjust here.
    await prisma.userStore.create({
      data: {
        userId: me.id,
        storeId: store.id,
      },
    });

    return NextResponse.json({ store });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Setup error" },
      { status: 500 }
    );
  }
}
