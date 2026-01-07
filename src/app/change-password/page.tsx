// src/app/change-password/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me", { credentials: "include" });
      const data = await res.json().catch(() => ({ user: null }));
      setMe(data.user);
      if (!data.user) router.push("/login");
    })();
  }, [router]);

  async function submit() {
    setErr(null);
    setOk(null);

    const a = p1;
    const b = p2;

    if (a.length < 6) return setErr("Password must be at least 6 characters");
    if (a !== b) return setErr("Passwords do not match");

    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: a }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(data.error ?? "Failed");

      setOk("Password updated ✅");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 800);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="mb-4">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-2xl"
              style={{
                background:
                  "radial-gradient(120% 120% at 30% 20%, rgba(var(--brand),0.55), rgba(var(--brand),0.12))",
                boxShadow: "0 18px 40px rgba(var(--brand),0.18)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            />
            <div className="min-w-0">
              <div className="text-lg font-semibold leading-tight">Aksha</div>
              <div className="text-xs muted">Security • Set a new password</div>
            </div>
          </div>
        </div>

        <div className="card card-pad space-y-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Set your password</h1>
            <p className="text-sm muted">
              For security, please set a new password before continuing.
            </p>
          </div>

          {err && (
            <div
              className="rounded-xl px-3 py-2 text-sm"
              style={{
                background: "rgba(var(--danger), 0.16)",
                border: "1px solid rgba(var(--danger), 0.25)",
                color: "rgb(var(--fg))",
              }}
            >
              {err}
            </div>
          )}

          {ok && (
            <div
              className="rounded-xl px-3 py-2 text-sm"
              style={{
                background: "rgba(var(--success), 0.16)",
                border: "1px solid rgba(var(--success), 0.22)",
                color: "rgb(var(--fg))",
              }}
            >
              {ok}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <div className="label">New password</div>
              <input
                className="input"
                type="password"
                placeholder="At least 6 characters"
                value={p1}
                onChange={(e) => setP1(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </div>

            <div className="space-y-1">
              <div className="label">Confirm password</div>
              <input
                className="input"
                type="password"
                placeholder="Re-enter password"
                value={p2}
                onChange={(e) => setP2(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </div>

            <button className="btn btn-primary w-full" onClick={submit} disabled={busy} type="button">
              {busy ? "Updating..." : "Update Password"}
            </button>

            <button
              className="btn btn-secondary w-full"
              type="button"
              disabled={busy}
              onClick={() => {
                setP1("");
                setP2("");
                setErr(null);
                setOk(null);
              }}
            >
              Clear
            </button>
          </div>

          {me?.email ? <div className="text-xs muted">Signed in as {me.email}</div> : null}
        </div>

        <div className="mt-4 text-[11px] muted text-center">
          Tip: Use a unique password you don’t reuse elsewhere.
        </div>
      </div>
    </main>
  );
}
