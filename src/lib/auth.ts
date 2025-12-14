import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type AuthedUser = {
  id: string;
  role: string;
  tenantId: string;
  storeIds?: string[];
};

/**
 * Reads session cookie set by /login and returns the user + tenant context.
 * Throws on unauthenticated.
 */
export async function requireUser(_req?: Request): Promise<AuthedUser> {
  // Session cookie name used across the app (change ONLY if your login uses a different cookie)
  const session = cookies().get("session")?.value;

  if (!session) {
    throw new Error("Unauthorized");
  }

  // For MVP we store userId in cookie (common in your current flow)
  // If your cookie stores JSON, this still works because we fall back to parsing.
  let userId = session;
  try {
    const maybe = JSON.parse(session);
    if (maybe?.userId) userId = String(maybe.userId);
  } catch {
    // cookie is plain userId
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, tenantId: true },
  });

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
