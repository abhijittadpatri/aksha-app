"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);

    const e = email.trim().toLowerCase();
    const p = password;

    if (!e) return setErr("Email is required");
    if (!p || p.length < 6) return setErr("Password must be at least 6 characters");

    setBusy(true);
    try {
      const res = await fetch("/api/auth/login-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, password: p }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(data.error ?? "Login failed");
        setBusy(false);
        return;
      }

      // If API tells us to force password change, respect it
      if (data.mustChangePassword) {
        router.push("/change-password");
        router.refresh();
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Login error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-2xl p-6 space-y-4 bg-white">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-gray-600">Use your email and password.</p>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        <div className="grid grid-cols-1 gap-3">
          <input
            className="border rounded-lg p-2"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="border rounded-lg p-2"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />

          <button
            className="bg-black text-white rounded-lg p-2 disabled:opacity-60"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Signing in..." : "Login"}
          </button>
        </div>

        <div className="text-xs text-gray-500">
          If your password was reset by Admin, you may be redirected to change it.
        </div>
      </div>
    </main>
  );
}
