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

function statusPillClass(u: any) {
  const disabled = u?.isActive === false;
  if (disabled) return "bg-gray-100 text-gray-700 border-gray-200";
  if (u?.mustChangePassword) return "bg-yellow-50 text-yellow-900 border-yellow-200";
  return "bg-green-50 text-green-900 border-green-200";
}

function ModalShell({
  title,
  subtitle,
  children,
  onClose,
  busy,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-md rounded-2xl shadow overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold truncate">{title}</div>
              {subtitle ? <div className="text-xs text-gray-500 truncate">{subtitle}</div> : null}
            </div>
            <button
              className="text-sm underline shrink-0"
              onClick={() => {
                if (busy) return;
                onClose();
              }}
            >
              Close
            </button>
          </div>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<any>(undefined);

  // banners (instead of alert)
  const [banner, setBanner] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(
    null
  );

  const [inviteText, setInviteText] = useState<string>("");

  // ===== Row actions menu =====
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

  // ===== Reset Password Modal =====
  const [rpOpen, setRpOpen] = useState(false);
  const [rpUser, setRpUser] = useState<any>(null);
  const [rpPass, setRpPass] = useState("Welcome1");
  const [rpPass2, setRpPass2] = useState("Welcome1");
  const [rpErr, setRpErr] = useState<string | null>(null);
  const [rpSaving, setRpSaving] = useState(false);

  // ===== Confirm Enable/Disable Modal =====
  const [stOpen, setStOpen] = useState(false);
  const [stUser, setStUser] = useState<any>(null);
  const [stSaving, setStSaving] = useState(false);
  const [stErr, setStErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
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
      typeof window !== "undefined" ? window.location.origin : "https://aksha-app.vercel.app";

    return `
Aksha Login Created ✅

Login URL: ${appUrl}/login
Email: ${email}
Temporary Password: ${tempPassword}

Please login and change your password immediately.
`.trim();
  }

  function openResetPassword(u: any) {
    setMenuOpenFor(null);
    setRpErr(null);
    setRpUser(u);
    setRpPass("Welcome1");
    setRpPass2("Welcome1");
    setRpOpen(true);
  }

  async function submitResetPassword() {
    if (!rpUser?.id) return;

    const p1 = String(rpPass ?? "");
    const p2 = String(rpPass2 ?? "");

    if (p1.trim().length < 6) return setRpErr("Password must be at least 6 characters.");
    if (p1 !== p2) return setRpErr("Passwords do not match.");

    setRpSaving(true);
    setRpErr(null);

    try {
      const res = await fetch(`/api/users/${rpUser.id}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempPassword: p1.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRpErr(data.error ?? "Reset failed");
        return;
      }

      setRpOpen(false);
      setRpUser(null);

      setBanner({ kind: "ok", text: "Password reset ✅ User must change password at next login." });
      await load();
    } catch (e: any) {
      setRpErr(e?.message ?? "Reset failed");
    } finally {
      setRpSaving(false);
    }
  }

  function openStatusConfirm(u: any) {
    setMenuOpenFor(null);
    setStErr(null);
    setStUser(u);
    setStOpen(true);
  }

  async function submitStatusChange() {
    if (!stUser?.id) return;

    const currentlyDisabled = stUser?.isActive === false;
    const nextIsActive = currentlyDisabled; // if disabled -> enable; else -> disable

    setStSaving(true);
    setStErr(null);
    try {
      const res = await fetch(`/api/users/${stUser.id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextIsActive }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStErr(data.error ?? "Update failed");
        return;
      }

      setStOpen(false);
      setStUser(null);

      setBanner({
        kind: "ok",
        text: nextIsActive ? "User enabled ✅" : "User disabled ✅",
      });

      await load();
    } catch (e: any) {
      setStErr(e?.message ?? "Update failed");
    } finally {
      setStSaving(false);
    }
  }

  return (
    <main className="p-4 md:p-6 space-y-4">
      <div className="flex items-start md:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-gray-500">Create users and manage access.</p>
        </div>

        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          + Add User
        </button>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      {banner && (
        <div
          className={cls(
            "border rounded-2xl p-3 text-sm flex items-start justify-between gap-3 bg-white",
            banner.kind === "ok" && "border-green-200",
            banner.kind === "warn" && "border-yellow-200",
            banner.kind === "err" && "border-red-200"
          )}
        >
          <div
            className={cls(
              banner.kind === "ok" && "text-green-800",
              banner.kind === "warn" && "text-yellow-900",
              banner.kind === "err" && "text-red-700"
            )}
          >
            {banner.text}
          </div>
          <button className="text-xs underline" onClick={() => setBanner(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Invite Message */}
      {inviteText && (
        <div className="card card-pad space-y-3">
          <div className="font-medium">Invite message</div>

          <pre className="text-xs whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border overflow-auto">
            {inviteText}
          </pre>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-ghost border"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteText);
                setBanner({ kind: "ok", text: "Invite message copied ✅" });
              }}
            >
              Copy Invite Message
            </button>

            <a
              className="btn btn-primary"
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

      {/* ===== Mobile list (cleaner) ===== */}
      <div className="md:hidden space-y-3">
        {users.map((u) => {
          const stores = (u?.stores ?? []).map((s: any) => s?.name).filter(Boolean);
          const storesText = stores.length ? stores.join(", ") : "-";
          const disabled = u?.isActive === false;

          return (
            <div key={u.id} className="card card-pad space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{u.name || "-"}</div>
                  <div className="text-sm text-gray-600 truncate">{u.email}</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="badge">{roleLabel(u.role)}</span>

                  <div className="relative">
                    <button
                      className="btn btn-ghost border"
                      onClick={() => setMenuOpenFor((prev) => (prev === u.id ? null : u.id))}
                    >
                      ⋯
                    </button>

                    {menuOpenFor === u.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setMenuOpenFor(null)}
                        />
                        <div className="absolute right-0 top-11 z-50 w-48 rounded-xl border bg-white shadow p-1">
                          {!disabled ? (
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
                              onClick={() => openResetPassword(u)}
                            >
                              Reset password
                            </button>
                          ) : null}

                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
                            onClick={() => openStatusConfirm(u)}
                          >
                            {disabled ? "Enable user" : "Disable user"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-sm">
                <div className="text-xs text-gray-500 mb-1">Stores</div>
                <div className="text-gray-800 break-words">{storesText}</div>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={cls("text-xs px-2 py-1 rounded-full border", statusPillClass(u))}>
                  {statusLabel(u)}
                </span>

                {u.disabledAt && disabled ? (
                  <div className="text-xs text-gray-500">
                    Disabled: {new Date(u.disabledAt).toLocaleString()}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500"> </div>
                )}
              </div>
            </div>
          );
        })}

        {users.length === 0 && (
          <div className="p-4 text-sm text-gray-500 border rounded-2xl bg-white">No users yet.</div>
        )}
      </div>

      {/* ===== Desktop table (less clutter + actions menu) ===== */}
      <div className="hidden md:block table">
        <div className="table-head grid-cols-6 p-3">
          <div>Name</div>
          <div>Email</div>
          <div>Role</div>
          <div>Stores</div>
          <div>Status</div>
          <div className="text-right">Actions</div>
        </div>

        {users.map((u) => {
          const disabled = u?.isActive === false;
          const storesText = u.stores?.map((s: any) => s.name).join(", ") || "-";

          return (
            <div key={u.id} className="table-row grid-cols-6 p-3 items-center">
              <div className="min-w-0">
                <div className="truncate font-medium">{u.name || "-"}</div>
                {u.disabledAt && disabled ? (
                  <div className="text-xs text-gray-500 truncate">
                    Disabled: {new Date(u.disabledAt).toLocaleString()}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 truncate"> </div>
                )}
              </div>

              <div className="min-w-0 truncate text-gray-700">{u.email}</div>
              <div>
                <span className="badge">{roleLabel(u.role)}</span>
              </div>
              <div className="min-w-0 truncate text-gray-700">{storesText}</div>

              <div>
                <span
                  className={cls(
                    "inline-flex text-[12px] px-2 py-1 rounded-full border",
                    statusPillClass(u)
                  )}
                >
                  {statusLabel(u)}
                </span>
              </div>

              <div className="flex justify-end">
                <div className="relative">
                  <button
                    className="btn btn-ghost border"
                    onClick={() => setMenuOpenFor((prev) => (prev === u.id ? null : u.id))}
                  >
                    ⋯
                  </button>

                  {menuOpenFor === u.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpenFor(null)} />
                      <div className="absolute right-0 top-11 z-50 w-52 rounded-xl border bg-white shadow p-1">
                        {!disabled ? (
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
                            onClick={() => openResetPassword(u)}
                          >
                            Reset password
                          </button>
                        ) : null}

                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
                          onClick={() => openStatusConfirm(u)}
                        >
                          {disabled ? "Enable user" : "Disable user"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {users.length === 0 && <div className="p-4 text-sm text-gray-500">No users yet.</div>}
      </div>

      <UserCreateModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(payload?: CreatedPayload) => {
          setOpen(false);
          load();

          const msg = buildInvite(payload?.email, payload?.tempPassword);
          if (msg) setInviteText(msg);

          setBanner({ kind: "ok", text: "User created ✅" });
        }}
      />

      {/* Reset Password Modal */}
      {rpOpen && (
        <ModalShell
          title="Reset Password"
          subtitle={`${rpUser?.name ?? "-"} • ${rpUser?.email ?? "-"}`}
          onClose={() => {
            if (rpSaving) return;
            setRpOpen(false);
            setRpErr(null);
          }}
          busy={rpSaving}
        >
          {rpErr && <div className="mb-3 text-sm text-red-600">{rpErr}</div>}

          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">New temporary password</div>
              <input
                className="input"
                placeholder="Min 6 chars"
                value={rpPass}
                onChange={(e) => setRpPass(e.target.value)}
                disabled={rpSaving}
                type="password"
                autoComplete="new-password"
              />
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Confirm password</div>
              <input
                className="input"
                placeholder="Repeat password"
                value={rpPass2}
                onChange={(e) => setRpPass2(e.target.value)}
                disabled={rpSaving}
                type="password"
                autoComplete="new-password"
              />
            </div>

            <div className="text-xs text-gray-500">
              User will be forced to change password at next login.
            </div>

            <button className="btn btn-primary w-full" onClick={submitResetPassword} disabled={rpSaving}>
              {rpSaving ? "Saving..." : "Reset Password"}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Enable/Disable confirmation modal */}
      {stOpen && (
        <ModalShell
          title={stUser?.isActive === false ? "Enable user?" : "Disable user?"}
          subtitle={`${stUser?.name ?? "-"} • ${stUser?.email ?? "-"}`}
          onClose={() => {
            if (stSaving) return;
            setStOpen(false);
            setStErr(null);
          }}
          busy={stSaving}
        >
          {stErr && <div className="mb-3 text-sm text-red-600">{stErr}</div>}

          <div className="space-y-3">
            <div className="text-sm text-gray-700">
              {stUser?.isActive === false ? (
                <>This will allow the user to login and access the app again.</>
              ) : (
                <>
                  Disabled users will be blocked from login and API access.
                  <div className="text-xs text-gray-500 mt-1">
                    (You can re-enable them anytime.)
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
                className="btn btn-ghost border flex-1"
                onClick={() => {
                  if (stSaving) return;
                  setStOpen(false);
                  setStErr(null);
                }}
                disabled={stSaving}
              >
                Cancel
              </button>

              <button
                className={cls(
                  "btn flex-1",
                  stUser?.isActive === false ? "btn-primary" : "bg-red-600 text-white hover:opacity-90"
                )}
                onClick={submitStatusChange}
                disabled={stSaving}
              >
                {stSaving
                  ? "Saving..."
                  : stUser?.isActive === false
                  ? "Enable"
                  : "Disable"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </main>
  );
}
