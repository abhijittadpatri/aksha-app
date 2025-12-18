"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SHOW_QUICK_LOGIN =
  process.env.NEXT_PUBLIC_SHOW_QUICK_LOGIN === "true";


// ✅ Update these to match your seeded/demo users + temp passwords
const QUICK_USERS = [
  { label: "Login as Admin (Chain Owner)", email: "admin@aksha.demo", password: "Welcome1" },
  { label: "Login as Doctor", email: "doctor@aksha.demo", password: "Welcome1" },
  { label: "Login as Billing", email: "billing@aksha.demo", password: "Welcome1" },
];

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function quickLogin(email: string) {
  setErr(null);
  setLoading(true);

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error ?? "Quick login failed");
      setLoading(false);
      return;
    }

if (data?.user?.mustChangePassword) {
  router.push("/change-password");
} else {
  router.push("/dashboard");
}
router.refresh();

  } catch (e: any) {
    setErr(String(e?.message ?? e ?? "Quick login failed"));
    setLoading(false);
  }
}


  async function loginWithPassword(e: string, p: string) {
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e.trim().toLowerCase(), password: p }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(data.error ?? "Login failed");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setErr(String(e?.message ?? e ?? "Login failed"));
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-xl p-6 space-y-4 bg-white">
        <h1 className="text-xl font-semibold">Aksha Login</h1>
        <p className="text-sm text-gray-600">
          Sign in with email + password. Quick logins are for demo/testing.
        </p>

        {err && <div className="text-sm text-red-600">{err}</div>}

        {/* ✅ Real login */}
        <div className="border rounded-2xl p-4 space-y-3">
          <div className="text-lg font-semibold">Sign in</div>

          <div className="grid grid-cols-1 gap-3">
            <input
              className="border rounded-lg p-2"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
            <input
              className="border rounded-lg p-2"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <button
              className="bg-black text-white rounded-lg p-2 disabled:opacity-60"
              disabled={loading}
              onClick={() => loginWithPassword(email, password)}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>
        </div>

        {/* ✅ Quick demo logins (now use email/password too) */}
        {SHOW_QUICK_LOGIN && (
          <div className="space-y-2">
            {USERS.map((u) => (
              <button
                key={u.email}
                className="w-full bg-black text-white rounded-lg p-2 disabled:opacity-60"
                disabled={loading !== null}
                onClick={() => login(u.email)}
              >
                {loading === u.email ? "Logging in..." : u.label}
              </button>
            ))}
          </div>
        )}

        <div className="text-xs text-gray-500">
          Tip: If a user is new, they may be redirected to <b>/change-password</b> after login.
        </div>
      </div>
    </main>
  );
}
