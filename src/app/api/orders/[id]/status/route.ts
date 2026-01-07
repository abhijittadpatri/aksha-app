// src/app/api/orders/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

// PATCH /api/orders/[id]/status  { status: "Draft" | "Ready" | "Delivered" }
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

    // Billing/Admin/ShopOwner can update order status
    if (!(user.role === "BILLING" || user.role === "ADMIN" || user.role === "SHOP_OWNER")) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const { id: orderId } = await ctx.params;
    if (!orderId) return NextResponse.json({ error: "Order id is required" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const status = String(body?.status ?? "").trim();

    const allowed = new Set(["Draft", "Ready", "Delivered"]);
    if (!allowed.has(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${Array.from(allowed).join(", ")}` },
        { status: 400 }
      );
    }

    // Ensure order belongs to same tenant
    const order = await prisma.spectacleOrder.findFirst({
      where: { id: orderId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const updated = await prisma.spectacleOrder.update({
      where: { id: orderId },
      data: { status },
    });

    return NextResponse.json({ order: updated });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Orders status PATCH error" },
      { status: 500 }
    );
  }
}
