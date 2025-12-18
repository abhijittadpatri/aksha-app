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

    if (p1.length < 6) return setErr("Password must be at least 6 characters");
    if (p1 !== p2) return setErr("Passwords do not match");

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: p1 }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(data.error ?? "Failed");

    setOk("Password updated ✅");
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 800);
  }

  return (
    <main className="p-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Set your password</h1>
      <p className="text-sm text-gray-600">
        For security, please set a new password before continuing.
      </p>

      {err && <div className="text-sm text-red-600">{err}</div>}
      {ok && <div className="text-sm text-green-700 border bg-green-50 p-2 rounded">{ok}</div>}

      <div className="border rounded-2xl p-4 space-y-3 bg-white">
        <input
          className="w-full border rounded-lg p-2"
          type="password"
          placeholder="New password"
          value={p1}
          onChange={(e) => setP1(e.target.value)}
        />
        <input
          className="w-full border rounded-lg p-2"
          type="password"
          placeholder="Confirm new password"
          value={p2}
          onChange={(e) => setP2(e.target.value)}
        />
        <button className="w-full bg-black text-white rounded-lg p-2" onClick={submit}>
          Update Password
        </button>
      </div>

      {me?.email && <div className="text-xs text-gray-500">Signed in as {me.email}</div>}
    </main>
  );
}
