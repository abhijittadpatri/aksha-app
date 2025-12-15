import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getCookieFromHeader } from "@/lib/session";
import type { NextRequest } from "next/server";

export type AuthedUser = {
  id: string;
  role: string;
  tenantId: string;
};

export async function requireUser(req: NextRequest): Promise<AuthedUser> {
  const cookieHeader = req.headers.get("cookie");
  const session = getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);

  if (!session) {
    throw new Error("Unauthorized");
  }

  // session is userId in your current flow
  const user = await prisma.user.findUnique({
    where: { id: session },
    select: { id: true, role: true, tenantId: true },
  });

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
