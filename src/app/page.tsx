import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCookieFromHeader, SESSION_COOKIE_NAME } from "@/lib/session";

export default function Home() {
  const cookieHeader = headers().get("cookie");
  const uid = getCookieFromHeader(cookieHeader, SESSION_COOKIE_NAME);

  if (uid) {
    redirect("/dashboard");
  }

  redirect("/login");
}
