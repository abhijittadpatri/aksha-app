// src/app/login/page.tsx
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
        return;
      }

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
    <main className="min-h-[100dvh] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <div
              className="h-11 w-11 rounded-2xl"
              style={{
                background:
                  "radial-gradient(120% 120% at 30% 20%, rgba(var(--brand),0.60), rgba(var(--brand),0.10))",
                boxShadow:
                  "0 18px 45px rgba(var(--brand),0.18), inset 0 1px 0 rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            />
            <div className="min-w-0">
              <div className="text-lg font-semibold leading-tight">Aksha</div>
              <div className="text-xs muted">Clinic OS • Secure Sign-in</div>
            </div>
          </div>
        </div>

        {/* Contrast wrapper: gives the card a “stand out” rim + glow */}
        <div
          className="rounded-[22px] p-[1px]"
          style={{
            background:
              "linear-gradient(135deg, rgba(var(--brand),0.55), rgba(255,255,255,0.08), rgba(var(--brand),0.18))",
            boxShadow: "0 26px 70px rgba(0,0,0,0.55)",
          }}
        >
          {/* The actual sign-in block (slightly brighter surface than default card) */}
          <div
            className="rounded-[22px] p-4 md:p-5 space-y-4"
            style={{
              background:
                "linear-gradient(180deg, rgba(var(--panel-2),0.92), rgba(var(--panel),0.88))",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
              <p className="text-sm muted">Use your email and password to continue.</p>
            </div>

            {err && (
              <div
                className="rounded-xl px-3 py-2 text-sm"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(var(--danger),0.22), rgba(var(--danger),0.12))",
                  border: "1px solid rgba(var(--danger),0.28)",
                  color: "rgb(var(--fg))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                {err}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <div className="label">Email</div>
                <input
                  className="input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  disabled={busy}
                />
              </div>

              <div className="space-y-1">
                <div className="label">Password</div>
                <input
                  className="input"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                />
              </div>

              <button className="btn btn-primary w-full" onClick={submit} disabled={busy} type="button">
                {busy ? "Signing in..." : "Login"}
              </button>

              {/* <button
                className="btn btn-secondary w-full"
                type="button"
                onClick={() => {
                  setEmail("");
                  setPassword("");
                  setErr(null);
                }}
                disabled={busy}
              >
                Clear
              </button> */}
            </div>

            <div className="text-xs muted">
              If your password was reset by Admin, you may be redirected to change it.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-[11px] muted text-center">
          © {new Date().getFullYear()} Aksha
        </div>
      </div>
    </main>
  );
}
