import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";

function getUserId(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  return getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const userId = getUserId(req);
    if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 401 });

    const invoice = await prisma.invoice.findFirst({
      where: { id: ctx.params.id, tenantId: user.tenantId },
      include: {
        patient: true,
        store: true,
      },
    });

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    return NextResponse.json({ invoice });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Invoice GET error" }, { status: 500 });
  }
}
