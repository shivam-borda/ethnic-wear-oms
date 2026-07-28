"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // New user form state
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("staff");
  const [creatingUser, setCreatingUser] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (prof) {
        const typedProf = prof as Profile;
        setProfile(typedProf);
        setName(typedProf.full_name || "");

        // If admin, load all user profiles
        if (typedProf.role === "admin") {
          const { data: list } = await supabase
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: false });

          setAllProfiles((list || []) as Profile[]);
        }
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name })
      .eq("id", profile.id);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated!");
      setProfile((p) => (p ? { ...p, full_name: name } : p));
    }
    setSaving(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) {
      toast.error("Username and Password are required");
      return;
    }
    setCreatingUser(true);

    try {
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          fullName: newFullName.trim() || newUsername.trim(),
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");

      toast.success(`User "${newUsername.trim()}" created successfully!`);
      setShowAddUserModal(false);
      setNewUsername("");
      setNewPassword("");
      setNewFullName("");
      setNewRole("staff");
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setCreatingUser(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="shimmer h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Profile Section */}
      <div className="form-section">
        <h2 className="form-section-title flex items-center gap-2 mb-4">
          👤 Profile Settings
        </h2>
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium mb-1.5">Username</label>
            <div
              className="px-3 py-2.5 rounded-lg border text-sm text-muted-foreground font-mono"
              style={{
                borderColor: "hsl(var(--border))",
                background: "hsl(var(--muted))",
              }}
            >
              {profile?.username || profile?.full_name?.toLowerCase() || "admin"}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Full Name</label>
            <input
              id="settings-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm outline-none"
              style={{ borderColor: "hsl(var(--border))" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Role</label>
            <div
              className="px-3 py-2.5 rounded-lg border text-sm capitalize font-semibold"
              style={{
                borderColor: "hsl(var(--border))",
                background: "hsl(var(--muted))",
                color: profile?.role === "admin" ? "hsl(var(--primary))" : "inherit",
              }}
            >
              {profile?.role || "staff"}
            </div>
          </div>
          <button
            id="save-settings-btn"
            onClick={handleSaveProfile}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Admin User Management Panel */}
      {profile?.role === "admin" && (
        <div className="form-section">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="form-section-title flex items-center gap-2">
                👥 User Management
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Create & manage staff and admin accounts
              </p>
            </div>
            <button
              id="add-user-btn"
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
              style={{
                background: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
              }}
            >
              + Add User
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "hsl(var(--border))" }}>
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                  style={{ background: "hsl(var(--muted))" }}
                >
                  <th className="px-4 py-3 text-left">Username</th>
                  <th className="px-4 py-3 text-left">Full Name</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {allProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  allProfiles.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                      style={{ borderColor: "hsl(var(--border))" }}
                    >
                      <td className="px-4 py-3 font-semibold font-mono text-xs">
                        {user.username || user.full_name?.toLowerCase() || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {user.full_name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize"
                          style={{
                            background:
                              user.role === "admin"
                                ? "hsl(345,70%,28%,0.15)"
                                : "hsl(35,20%,90%)",
                            color:
                              user.role === "admin"
                                ? "hsl(345,70%,28%)"
                                : "hsl(20,10%,35%)",
                          }}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDate(user.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* App Info */}
      <div className="form-section">
        <h2 className="form-section-title flex items-center gap-2 mb-4">
          ℹ️ Application Info
        </h2>
        <div className="space-y-2 text-sm max-w-lg">
          <div className="flex justify-between py-2 border-b" style={{ borderColor: "hsl(var(--border))" }}>
            <span className="text-muted-foreground">Application</span>
            <span className="font-medium">Aahman OMS</span>
          </div>
          <div className="flex justify-between py-2 border-b" style={{ borderColor: "hsl(var(--border))" }}>
            <span className="text-muted-foreground">Auth Method</span>
            <span className="font-medium text-primary">Username & Password</span>
          </div>
          <div className="flex justify-between py-2 border-b" style={{ borderColor: "hsl(var(--border))" }}>
            <span className="text-muted-foreground">Database</span>
            <span className="font-medium text-green-600">● Connected (aahman_customize)</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Storage</span>
            <span className="font-medium text-green-600">● Supabase Storage</span>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6">
            <h3
              className="text-lg font-semibold mb-4"
              style={{ fontFamily: "Cormorant Garamond, serif" }}
            >
              Add New User Account
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. tailor1"
                  required
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none"
                  style={{ borderColor: "hsl(var(--border))" }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="e.g. 123456"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none"
                  style={{ borderColor: "hsl(var(--border))" }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none"
                  style={{ borderColor: "hsl(var(--border))" }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-lg border text-sm hover:bg-muted"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                  style={{
                    background: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                  }}
                >
                  {creatingUser ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
