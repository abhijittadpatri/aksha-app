"use client";

import { useEffect, useMemo, useState } from "react";
import UserCreateModal, { CreatedPayload } from "@/components/UserCreateModal";

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function roleLabel(role: any) {
  const r = String(role ?? "").toUpperCase();
  if (r === "SHOP_OWNER") return "SHOP_OWNER";
  if (r === "ADMIN") return "ADMIN";
  if (r === "DOCTOR") return "DOCTOR";
  if (r === "BILLING") return "BILLING";
  return r || "-";
}

function statusLabel(u: any) {
  if (u?.isActive === false) return "Disabled";
  if (u?.mustChangePassword) return "Must change password";
  return "Active";
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<any>(undefined);

  const [inviteText, setInviteText] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          // account disabled
          if (typeof window !== "undefined") window.location.href = "/login";
          return;
        }
        setMe(data.user ?? null);
      } catch {
        setMe(null);
      }
    })();
  }, []);

  const canManageUsers = useMemo(() => {
    const r = String(me?.role ?? "").toUpperCase();
    return r === "ADMIN" || r === "SHOP_OWNER";
  }, [me?.role]);

  if (me === null) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }
  if (me && !canManageUsers) {
    if (typeof window !== "undefined") window.location.href = "/dashboard";
    return null;
  }

  async function load() {
    setErr(null);
    try {
      const res = await fetch("/api/users", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Failed to load users");
        setUsers([]);
        return;
      }
      setUsers(data.users || []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load users");
      setUsers([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

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

  async function resetPassword(userId: string) {
    const temp = prompt("Enter a temporary password (min 6 chars):", "Welcome1");
    if (!temp) return;

    const res = await fetch(`/api/users/${userId}/reset-password`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempPassword: temp }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? "Reset failed");
      return;
    }

    alert("Password reset ✅ User must change password at next login.");
    load();
  }

  async function setUserActive(userId: string, isActive: boolean) {
    const ok = confirm(
      isActive
        ? "Enable this user?"
        : "Disable this user?\n\nDisabled users will be blocked from login and API access."
    );
    if (!ok) return;

    setErr(null);
    try {
      const res = await fetch(`/api/users/${userId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Update failed");
        return;
      }
      load();
    } catch (e: any) {
      alert(e?.message ?? "Update failed");
    }
  }

  return (
    <main className="p-4 md:p-6 space-y-4">
      <div className="flex items-start md:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-gray-500">Create users and manage access.</p>
        </div>

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

          <pre className="text-xs whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border overflow-auto">
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

            <button className="text-sm underline" onClick={() => setInviteText("")}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {users.map((u) => {
          const stores = (u?.stores ?? []).map((s: any) => s?.name).filter(Boolean);
          const storesText = stores.length ? stores.join(", ") : "-";
          const disabled = u?.isActive === false;

          return (
            <div key={u.id} className="border rounded-2xl bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{u.name || "-"}</div>
                  <div className="text-sm text-gray-600 truncate">{u.email}</div>
                </div>

                <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 shrink-0">
                  {roleLabel(u.role)}
                </span>
              </div>

              <div className="text-sm">
                <div className="text-xs text-gray-500 mb-1">Stores</div>
                <div className="text-gray-800 break-words">{storesText}</div>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span
                  className={cls(
                    "text-xs px-2 py-1 rounded-full",
                    disabled
                      ? "bg-gray-100 text-gray-700"
                      : u.mustChangePassword
                      ? "bg-yellow-50 text-yellow-800"
                      : "bg-green-50 text-green-800"
                  )}
                >
                  {statusLabel(u)}
                </span>

                <div className="flex items-center gap-3">
                  {!disabled ? (
                    <button className="text-sm underline" onClick={() => resetPassword(u.id)}>
                      Reset Password
                    </button>
                  ) : null}

                  <button
                    className="text-sm underline"
                    onClick={() => setUserActive(u.id, disabled)}
                  >
                    {disabled ? "Enable" : "Disable"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {users.length === 0 && (
          <div className="p-4 text-sm text-gray-500 border rounded-2xl bg-white">
            No users yet.
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block border rounded-xl overflow-hidden bg-white">
        <div className="grid grid-cols-7 bg-gray-50 text-sm font-medium p-3">
          <div>Name</div>
          <div>Email</div>
          <div>Role</div>
          <div>Stores</div>
          <div>Status</div>
          <div className="col-span-2">Actions</div>
        </div>

        {users.map((u) => {
          const disabled = u?.isActive === false;
          return (
            <div key={u.id} className="grid grid-cols-7 p-3 text-sm border-t items-center">
              <div className="min-w-0 truncate">{u.name || "-"}</div>
              <div className="min-w-0 truncate">{u.email}</div>
              <div>{roleLabel(u.role)}</div>
              <div className="min-w-0 truncate">
                {u.stores?.map((s: any) => s.name).join(", ") || "-"}
              </div>

              <div className="text-xs text-gray-600">{statusLabel(u)}</div>

              <div className="flex items-center gap-3">
                {!disabled ? (
                  <button className="text-sm underline" onClick={() => resetPassword(u.id)}>
                    Reset Password
                  </button>
                ) : null}

                <button
                  className="text-sm underline"
                  onClick={() => setUserActive(u.id, disabled)}
                >
                  {disabled ? "Enable" : "Disable"}
                </button>
              </div>

              <div className="text-xs text-gray-500">
                {u.disabledAt && disabled ? `Disabled: ${new Date(u.disabledAt).toLocaleString()}` : ""}
              </div>
            </div>
          );
        })}

        {users.length === 0 && (
          <div className="p-4 text-sm text-gray-500">No users yet.</div>
        )}
      </div>

      <UserCreateModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(payload?: CreatedPayload) => {
          setOpen(false);
          load();

          const msg = buildInvite(payload?.email, payload?.tempPassword);
          if (msg) setInviteText(msg);
        }}
      />
    </main>
  );
}
