// src/app/login/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function EmailIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={props.className} fill="none">
      <path
        d="M4.5 7.5A3 3 0 0 1 7.5 4.5h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.9"
      />
      <path
        d="m6.8 8.2 4.4 3.3c.5.38 1.2.38 1.7 0l4.4-3.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={props.className} fill="none">
      <path
        d="M7.5 10.5V8.3a4.5 4.5 0 1 1 9 0v2.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.5 10.5h11A2.5 2.5 0 0 1 20 13v5.5A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5V13a2.5 2.5 0 0 1 2.5-2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.95"
      />
      <path d="M12 14.2v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const canSubmit = useMemo(() => {
    const e = email.trim().toLowerCase();
    return e.length > 0 && password.length >= 6 && !busy;
  }, [email, password, busy]);

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
    <main
      className="min-h-[100dvh] flex items-center justify-center px-4 py-10"
      style={{
        // IMPORTANT: use modern rgb(var(--x) / a) syntax (your tokens are "R G B")
        background:
          "radial-gradient(1100px 520px at 10% 5%, rgb(var(--brand) / 0.22), transparent 60%)," +
          "radial-gradient(900px 520px at 90% 0%, rgb(var(--info) / 0.16), transparent 60%)," +
          "radial-gradient(900px 520px at 60% 110%, rgb(var(--success) / 0.12), transparent 60%)," +
          "linear-gradient(180deg, rgb(var(--bg)), rgb(var(--bg)))",
      }}
    >
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <div
              className="h-11 w-11 rounded-2xl"
              style={{
                background:
                  "radial-gradient(120% 120% at 30% 20%, rgb(var(--brand) / 0.80), rgb(var(--brand) / 0.14))",
                boxShadow:
                  "0 18px 45px rgb(var(--brand) / 0.18), inset 0 1px 0 rgb(255 255 255 / 0.10)",
                border: "1px solid rgb(255 255 255 / 0.10)",
              }}
            />
            <div className="min-w-0">
              <div className="text-lg font-semibold leading-tight">Aksha</div>
              <div className="text-xs muted">Clinic OS • Secure sign-in</div>
            </div>
          </div>
        </div>

        {/* Premium rim */}
        <div
          className="rounded-[24px] p-[1px]"
          style={{
            background:
              "linear-gradient(135deg," +
              "  rgb(var(--brand) / 0.60)," +
              "  rgb(var(--info) / 0.28)," +
              "  rgb(var(--success) / 0.22)," +
              "  rgb(255 255 255 / 0.10)" +
              ")",
            boxShadow: "0 26px 70px rgb(0 0 0 / 0.62)",
          }}
        >
          {/* Sign-in block */}
          <div
            className="rounded-[24px] px-4 py-5 md:px-5 md:py-6 space-y-4"
            style={{
              background:
                "linear-gradient(180deg, rgb(var(--panel-2) / 0.92), rgb(var(--panel) / 0.88))",
              border: "1px solid rgb(255 255 255 / 0.06)",
              boxShadow:
                "inset 0 1px 0 rgb(255 255 255 / 0.06), 0 30px 80px rgb(0 0 0 / 0.55)",
              backdropFilter: "blur(6px)",
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
                    "linear-gradient(180deg, rgb(var(--danger) / 0.22), rgb(var(--danger) / 0.12))",
                  border: "1px solid rgb(var(--danger) / 0.30)",
                  color: "rgb(var(--fg))",
                  boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.06)",
                }}
              >
                {err}
              </div>
            )}

            <div className="grid gap-3">
              {/* Email */}
              <div className="space-y-1">
                <div className="label">Email </div>
                
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "rgb(var(--fg-muted))" }}
                  >
                  </span>
                  <input
                    className="input pl-10"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    disabled={busy}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <div className="label">Password</div>
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "rgb(var(--fg-muted))" }}
                  >
                  </span>

                  <input
                    className="input pl-10 pr-12"
                    placeholder="••••••••"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={busy}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                  />

                  <button
                    type="button"
                    className={cls("btn btn-ghost btn-icon-sm absolute right-2 top-1/2 -translate-y-1/2")}
                    onClick={() => setShowPw((v) => !v)}
                    disabled={busy}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    title={showPw ? "Hide password" : "Show password"}
                    style={{
                      // slightly more visible on this page
                      borderColor: "rgb(255 255 255 / 0.14)",
                      color: "rgb(var(--fg))",
                    }}
                  >
                    {showPw ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  className={cls("btn w-full", "btn-primary")}
                  onClick={submit}
                  disabled={!canSubmit}
                  type="button"
                >
                  {busy ? "Signing in..." : "Sign in"}
                </button>

                <button
                  className="btn btn-secondary w-full"
                  type="button"
                  onClick={() => {
                    if (busy) return;
                    setEmail("");
                    setPassword("");
                    setErr(null);
                  }}
                  disabled={busy}
                >
                  Clear
                </button>
              </div>

              {/* Helper */}
              <div
                className="rounded-xl p-3 text-xs"
                style={{
                  background: "rgb(255 255 255 / 0.04)",
                  border: "1px solid rgb(255 255 255 / 0.10)",
                  boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.05)",
                }}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-full"
                    style={{
                      background: "rgb(var(--info) / 0.16)",
                      border: "1px solid rgb(var(--info) / 0.26)",
                      color: "rgb(var(--fg))",
                    }}
                  >
                    i
                  </span>
                  <div className="muted">
                    If your password was reset by Admin, you may be redirected to change it.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-[11px] muted text-center">
          © {new Date().getFullYear()} Aksha • Secure Access
        </div>
      </div>
    </main>
  );
}
