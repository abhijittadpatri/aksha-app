"use client";

import { useState } from "react";

const USERS = [
  { label: "Login as Admin (Chain Owner)", email: "admin@aksha.demo" },
  { label: "Login as Doctor", email: "doctor@aksha.demo" },
  { label: "Login as Billing", email: "billing@aksha.demo" },
];

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function login(email: string) {
    setErr(null);
    setLoading(email);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(null);

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    if (!res.ok) {
      setErr(data.error ?? "Login failed");
      return;
    }

    // Hard navigation so cookie/session is definitely available immediately
    window.location.href = "/dashboard";
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">Aksha Prototype Login</h1>
        <p className="text-sm text-gray-600">
          Prototype mode: choose a seeded user.
        </p>

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

        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </main>
  );
}
