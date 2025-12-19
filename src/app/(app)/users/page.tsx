"use client";

import { useEffect, useState } from "react";
import UserCreateModal from "@/components/UserCreateModal";
import { useRouter } from "next/navigation";

type CreatedPayload =
  | {
      email?: string;
      tempPassword?: string;
    }
  | null
  | undefined;

export default function UsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<any>(undefined);

  // Invite message
  const [inviteText, setInviteText] = useState<string>("");

  // ---- Load current user ----
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        setMe(data.user ?? null);
      } catch {
        setMe(null);
      }
    })();
  }, []);

  // ---- Auth / role guard ----
  useEffect(() => {
    if (me === undefined) return; // still loading

    if (me === null) {
      router.replace("/login");
      return;
    }

    const role = String(me.role || "").toUpperCase();
    if (role !== "ADMIN" && role !== "OWNER" && role !== "SHOP_OWNER") {
      router.replace("/dashboard");
    }
  }, [me, router]);

  // ---- Load users ----
  async function load() {
    setErr(null);
    try {
      const res = await fetch("/api/users", { credentials: "include" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErr(data.error ?? "Failed to load users");
        return;
      }

      setUsers(data.users || []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load users");
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ---- Invite message builder ----
  function buildInvite(email?: string, tempPassword?: string) {
    if (!email || !tempPassword) return "";

    const appUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://aksha-app.vercel.app";

    return `
Aksha Login Created ✅

Login URL: ${appUrl}/login
Email: ${email}
Temporary Password: ${tempPassword}

Please login and change your password immediately.
`.trim();
  }

  if (me === undefined) {
    return (
      <main className="p-6">
        <div className="text-sm text-gray-500">Loading…</div>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Users</h1>
        <button
          className="bg-black text-white px-3 py-2 rounded-lg text-sm"
          onClick={() => setOpen(true)}
        >
          + Add User
        </button>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      {/* Invite Message */}
      {inviteText && (
        <div className="border rounded-2xl p-4 bg-white space-y-3">
          <div className="font-medium">Invite message</div>

          <pre className="text-xs whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border">
            {inviteText}
          </pre>

          <div className="flex flex-wrap gap-2">
            <button
              className="border px-3 py-2 rounded-lg text-sm"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteText);
                alert("Invite message copied ✅");
              }}
            >
              Copy Invite Message
            </button>

            <a
              className="bg-black text-white px-3 py-2 rounded-lg text-sm"
              href={`https://wa.me/?text=${encodeURIComponent(inviteText)}`}
              target="_blank"
              rel="noreferrer"
            >
              Send on WhatsApp
            </a>

            <button
              className="text-sm underline"
              onClick={() => setInviteText("")}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="border rounded-xl overflow-hidden">
        <div className="grid grid-cols-6 bg-gray-50 text-sm font-medium p-3">
          <div>Name</div>
          <div>Email</div>
          <div>Role</div>
          <div>Stores</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {users.map((u) => (
          <div key={u.id} className="grid grid-cols-6 p-3 text-sm border-t">
            <div>{u.name || "-"}</div>
            <div>{u.email}</div>
            <div>{u.role}</div>
            <div>{u.stores?.map((s: any) => s.name).join(", ") || "-"}</div>
            <div className="text-xs text-gray-600">
              {u.mustChangePassword ? "Must change password" : "Active"}
            </div>

            <div>
              <button
                className="text-sm underline"
                onClick={async () => {
                  const temp = prompt(
                    "Enter a temporary password (min 6 chars):",
                    "Welcome1"
                  );
                  if (!temp) return;

                  const res = await fetch(
                    `/api/users/${u.id}/reset-password`,
                    {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ tempPassword: temp }),
                    }
                  );

                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    alert(data.error ?? "Reset failed");
                    return;
                  }

                  alert(
                    "Password reset ✅ User must change password at next login."
                  );
                  load();
                }}
              >
                Reset Password
              </button>
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <div className="p-4 text-sm text-gray-500">No users yet.</div>
        )}
      </div>

      <UserCreateModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(payload: CreatedPayload) => {
          setOpen(false);
          load();

          const msg = buildInvite(
            payload?.email,
            payload?.tempPassword
          );

          if (msg) setInviteText(msg);
        }}
      />
    </main>
  );
}
