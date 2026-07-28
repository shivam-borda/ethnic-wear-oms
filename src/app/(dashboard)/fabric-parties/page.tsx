"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FabricParty } from "@/types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function FabricPartiesPage() {
  const [parties, setParties] = useState<FabricParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editParty, setEditParty] = useState<FabricParty | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("fabric_parties").select("*").order("name").then(({ data }) => {
      setParties((data || []) as FabricParty[]);
      setLoading(false);
    });
  }, []);

  const openAdd = () => {
    setEditParty(null);
    setForm({ name: "", phone: "", address: "", notes: "" });
    setShowModal(true);
  };

  const openEdit = (party: FabricParty) => {
    setEditParty(party);
    setForm({ name: party.name, phone: party.phone || "", address: party.address || "", notes: party.notes || "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const supabase = createClient();
    try {
      if (editParty) {
        const { data, error } = await supabase
          .from("fabric_parties")
          .update({ name: form.name, phone: form.phone || null, address: form.address || null, notes: form.notes || null })
          .eq("id", editParty.id).select().single();
        if (error) throw error;
        setParties((prev) => prev.map((p) => p.id === editParty.id ? data as FabricParty : p));
        toast.success("Fabric party updated!");
      } else {
        const { data, error } = await supabase
          .from("fabric_parties")
          .insert([{ name: form.name, phone: form.phone || null, address: form.address || null, notes: form.notes || null }])
          .select().single();
        if (error) throw error;
        setParties((prev) => [...prev, data as FabricParty].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Fabric party added!");
      }
      setShowModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (party: FabricParty) => {
    if (!confirm(`Delete fabric party "${party.name}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("fabric_parties").delete().eq("id", party.id);
    if (error) { toast.error("Failed to delete"); return; }
    setParties((prev) => prev.filter((p) => p.id !== party.id));
    toast.success("Fabric party deleted");
  };

  const filtered = parties.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
          <input
            id="fabric-parties-search"
            type="text"
            placeholder="Search fabric parties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border bg-card text-sm outline-none"
            style={{ borderColor: "hsl(var(--border))" }}
          />
        </div>
        <button
          id="add-fabric-party-btn"
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
        >
          + Add Fabric Party
        </button>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
          <span className="text-sm text-muted-foreground">{filtered.length} fabric parties</span>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3].map((i) => <div key={i} className="shimmer h-12 rounded-lg" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium text-muted-foreground uppercase tracking-wide" style={{ background: "hsl(var(--muted))" }}>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Address</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                  <th className="px-4 py-3 text-left">Added</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {search ? "No fabric parties match your search." : "No fabric parties yet."}
                  </td></tr>
                ) : filtered.map((party) => (
                  <tr key={party.id} className="border-b last:border-0 hover:bg-muted/30" style={{ borderColor: "hsl(var(--border))" }}>
                    <td className="px-4 py-3 font-medium">{party.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{party.phone || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate">{party.address || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{party.notes || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(party.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(party)} className="text-xs px-2 py-1 rounded border hover:bg-muted" style={{ borderColor: "hsl(var(--border))" }}>✏️ Edit</button>
                        <button onClick={() => handleDelete(party)} className="text-xs px-2 py-1 rounded border hover:bg-red-50 text-red-500" style={{ borderColor: "hsl(var(--border))" }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              {editParty ? "Edit Fabric Party" : "Add Fabric Party"}
            </h3>
            <div className="space-y-3">
              {[
                { key: "name", label: "Name *", placeholder: "Fabric party name" },
                { key: "phone", label: "Phone", placeholder: "9876543210" },
                { key: "address", label: "Address", placeholder: "City, State" },
                { key: "notes", label: "Notes", placeholder: "Fabric speciality, terms, etc." },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1.5">{label}</label>
                  <input
                    type="text"
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm outline-none"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted" style={{ borderColor: "hsl(var(--border))" }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60" style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
                  {saving ? "Saving..." : editParty ? "Update" : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
