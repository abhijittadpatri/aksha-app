"use client";

import { useEffect, useMemo, useState } from "react";
import UserCreateModal, { CreatedPayload } from "@/components/UserCreateModal";
import Modal from "@/components/ui/Modal";

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

function statusBadgeKind(u: any): "ok" | "warn" | "muted" {
  if (u?.isActive === false) return "muted";
  if (u?.mustChangePassword) return "warn";
  return "ok";
}

function StatusBadge({ u }: { u: any }) {
  const kind = statusBadgeKind(u);
  const k = kind === "ok" ? "badge badge-ok" : kind === "warn" ? "badge badge-warn" : "badge";
  return <span className={k}>{statusLabel(u)}</span>;
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

  const bannerClass = (kind: "ok" | "warn" | "err") =>
    cls(
      "card card-pad flex items-start justify-between gap-3",
      kind === "ok" && "border border-[rgba(var(--success),0.30)]",
      kind === "warn" && "border border-[rgba(var(--warning),0.30)]",
      kind === "err" && "border border-[rgba(var(--danger),0.30)]"
    );

  const bannerTextClass = (kind: "ok" | "warn" | "err") =>
    cls(
      "text-sm",
      kind === "ok" && "text-[rgb(var(--fg))]",
      kind === "warn" && "text-[rgb(var(--fg))]",
      kind === "err" && "text-red-400"
    );

  return (
    <main className="p-4 md:p-6">
      <div className="page space-y-4">
        {/* Header */}
        <div className="flex items-start md:items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="h1">Users</h1>
            <p className="subtle">Create users and manage access.</p>
          </div>

          <button className="btn btn-primary w-full md:w-auto" onClick={() => setOpen(true)} type="button">
            + Add User
          </button>
        </div>

        {err && <div className="text-sm text-red-400">{err}</div>}

        {banner && (
          <div className={bannerClass(banner.kind)}>
            <div className={bannerTextClass(banner.kind)}>{banner.text}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setBanner(null)} type="button">
              Dismiss
            </button>
          </div>
        )}

        {/* Invite Message */}
        {inviteText && (
          <div className="card card-pad space-y-3">
            <div className="h2">Invite message</div>

            <pre
              className="text-xs whitespace-pre-wrap rounded-xl p-3 overflow-auto"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgb(var(--fg))",
              }}
            >
              {inviteText}
            </pre>

            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteText);
                  setBanner({ kind: "ok", text: "Invite message copied ✅" });
                }}
                type="button"
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

              <button className="btn btn-ghost" onClick={() => setInviteText("")} type="button">
                Clear
              </button>
            </div>
          </div>
        )}

        {/* ===== Mobile list ===== */}
        <div className="md:hidden space-y-3">
          {users.map((u) => {
            const stores = (u?.stores ?? []).map((s: any) => s?.name).filter(Boolean);
            const storesText = stores.length ? stores.join(", ") : "—";
            const disabled = u?.isActive === false;

            return (
              <div key={u.id} className="panel p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{u.name || "—"}</div>
                    <div className="text-sm muted truncate">{u.email}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="badge">{roleLabel(u.role)}</span>

                    <div className="relative">
                      <button
                        className="btn btn-ghost btn-icon-sm"
                        onClick={() => setMenuOpenFor((prev) => (prev === u.id ? null : u.id))}
                        type="button"
                        aria-label="Actions"
                        title="Actions"
                      >
                        ⋯
                      </button>

                      {menuOpenFor === u.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setMenuOpenFor(null)} />

                          {/* Dark menu */}
                          <div
                            className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-2xl"
                            style={{
                              background: "rgba(var(--panel-2), 1)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
                            }}
                          >
                            <div className="p-1">
                              {!disabled ? (
                                <button
                                  className="btn btn-secondary w-full justify-start"
                                  onClick={() => openResetPassword(u)}
                                  type="button"
                                >
                                  Reset password
                                </button>
                              ) : null}

                              <button
                                className="btn btn-secondary w-full justify-start mt-1"
                                onClick={() => openStatusConfirm(u)}
                                type="button"
                              >
                                {disabled ? "Enable user" : "Disable user"}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-sm">
                  <div className="label mb-1">Stores</div>
                  <div className="break-words" style={{ color: "rgb(var(--fg))" }}>
                    {storesText}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <StatusBadge u={u} />

                  {u.disabledAt && disabled ? (
                    <div className="text-xs muted">Disabled: {new Date(u.disabledAt).toLocaleString()}</div>
                  ) : (
                    <div className="text-xs muted"> </div>
                  )}
                </div>
              </div>
            );
          })}

          {users.length === 0 && <div className="panel p-4 text-sm muted">No users yet.</div>}
        </div>

        {/* ===== Desktop table ===== */}
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
            const storesText = u.stores?.map((s: any) => s.name).join(", ") || "—";

            return (
              <div key={u.id} className="table-row grid-cols-6 p-3 items-center">
                <div className="min-w-0">
                  <div className="truncate font-medium">{u.name || "—"}</div>
                  {u.disabledAt && disabled ? (
                    <div className="text-xs muted truncate">Disabled: {new Date(u.disabledAt).toLocaleString()}</div>
                  ) : (
                    <div className="text-xs muted truncate"> </div>
                  )}
                </div>

                <div className="min-w-0 truncate muted">{u.email}</div>
                <div>
                  <span className="badge">{roleLabel(u.role)}</span>
                </div>
                <div className="min-w-0 truncate muted">{storesText}</div>

                <div>
                  <StatusBadge u={u} />
                </div>

                <div className="flex justify-end">
                  <div className="relative">
                    <button
                      className="btn btn-ghost btn-icon-sm"
                      onClick={() => setMenuOpenFor((prev) => (prev === u.id ? null : u.id))}
                      type="button"
                      aria-label="Actions"
                      title="Actions"
                    >
                      ⋯
                    </button>

                    {menuOpenFor === u.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpenFor(null)} />
                        <div
                          className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-2xl"
                          style={{
                            background: "rgba(var(--panel-2), 1)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
                          }}
                        >
                          <div className="p-1">
                            {!disabled ? (
                              <button
                                className="btn btn-secondary w-full justify-start"
                                onClick={() => openResetPassword(u)}
                                type="button"
                              >
                                Reset password
                              </button>
                            ) : null}

                            <button
                              className="btn btn-secondary w-full justify-start mt-1"
                              onClick={() => openStatusConfirm(u)}
                              type="button"
                            >
                              {disabled ? "Enable user" : "Disable user"}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {users.length === 0 && <div className="p-4 text-sm muted">No users yet.</div>}
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

        {/* Reset Password Modal (new system) */}
        <Modal
          open={rpOpen}
          onClose={() => {
            if (rpSaving) return;
            setRpOpen(false);
            setRpErr(null);
          }}
          title="Reset Password"
          description={`${rpUser?.name ?? "—"} • ${rpUser?.email ?? "—"}`}
          busy={rpSaving}
          footer={
            <div className="flex gap-2">
              <button
                className="btn btn-secondary w-full"
                type="button"
                onClick={() => {
                  if (rpSaving) return;
                  setRpOpen(false);
                  setRpErr(null);
                }}
                disabled={rpSaving}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary w-full"
                onClick={submitResetPassword}
                disabled={rpSaving}
                type="button"
              >
                {rpSaving ? "Saving..." : "Reset Password"}
              </button>
            </div>
          }
        >
          {rpErr && <div className="mb-3 text-sm text-red-400">{rpErr}</div>}

          <div className="space-y-3">
            <div>
              <div className="label mb-1">New temporary password</div>
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
              <div className="label mb-1">Confirm password</div>
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

            <div className="text-xs muted">User will be forced to change password at next login.</div>
          </div>
        </Modal>

        {/* Enable/Disable confirmation modal (new system) */}
        <Modal
          open={stOpen}
          onClose={() => {
            if (stSaving) return;
            setStOpen(false);
            setStErr(null);
          }}
          title={stUser?.isActive === false ? "Enable user?" : "Disable user?"}
          description={`${stUser?.name ?? "—"} • ${stUser?.email ?? "—"}`}
          busy={stSaving}
          footer={
            <div className="flex gap-2">
              <button
                className="btn btn-secondary w-full"
                type="button"
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
                className={cls("btn w-full", stUser?.isActive === false ? "btn-primary" : "btn-danger")}
                onClick={submitStatusChange}
                disabled={stSaving}
                type="button"
              >
                {stSaving ? "Saving..." : stUser?.isActive === false ? "Enable" : "Disable"}
              </button>
            </div>
          }
        >
          {stErr && <div className="mb-3 text-sm text-red-400">{stErr}</div>}

          <div className="space-y-2 text-sm" style={{ color: "rgb(var(--fg-muted))" }}>
            {stUser?.isActive === false ? (
              <>This will allow the user to login and access the app again.</>
            ) : (
              <>
                Disabled users will be blocked from login and API access.
                <div className="text-xs muted mt-1">(You can re-enable them anytime.)</div>
              </>
            )}
          </div>
        </Modal>
      </div>
    </main>
  );
}
