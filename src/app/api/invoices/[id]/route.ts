// src/app/api/invoices/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

function getUserId(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

async function requireUser(req: NextRequest) {
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
    role: user.role,
    allowedStoreIds,
  };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;

    // Fetch invoice in same tenant
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        patient: true,
        store: true,
        order: true,
        items: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Authorization: non-owner/admin should only access invoices for their stores
    const isOwner = user.role === "SHOP_OWNER";
    const isAdmin = user.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      if (!user.allowedStoreIds.includes(invoice.storeId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({ invoice });
  } catch (e: any) {
    const msg = e?.message ?? "Server error";
    const status = msg === "Not logged in" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
