"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Party, FabricParty, ItemType, OrderItemFormData } from "@/types";
import { ITEM_TYPE_LABELS } from "@/types";
import { format } from "date-fns";

interface Props {
  parties: Party[];
  fabricParties: FabricParty[];
  defaultValues?: Partial<OrderData>;
  editOrderId?: string;
}

interface OrderData {
  party_id: string;
  phone: string;
  order_date: string;
  delivery_date: string;
  vyapar_order_number: string;
  stitching_measurement_number: string;
  notes: string;
  items: OrderItemFormData[];
}

const defaultItem = (): OrderItemFormData => ({
  item_type: "kurta",
  fabric_party_id: "",
  fabric_details: "",
  fabric_image_url: "",
  quantity: 1,
  special_instructions: "",
  notes: "",
});

export default function CreateOrderClient({
  parties: initialParties,
  fabricParties: initialFabricParties,
  defaultValues,
  editOrderId,
}: Props) {
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [fabricParties, setFabricParties] = useState<FabricParty[]>(initialFabricParties);
  const [saving, setSaving] = useState(false);
  const [expandedItems, setExpandedItems] = useState<number[]>([0]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const [form, setForm] = useState<OrderData>({
    party_id: defaultValues?.party_id || "",
    phone: defaultValues?.phone || "",
    order_date: defaultValues?.order_date || format(new Date(), "yyyy-MM-dd"),
    delivery_date: defaultValues?.delivery_date || "",
    vyapar_order_number: defaultValues?.vyapar_order_number || "",
    stitching_measurement_number: defaultValues?.stitching_measurement_number || "",
    notes: defaultValues?.notes || "",
    items: defaultValues?.items || [defaultItem()],
  });

  // New party modal
  const [showNewParty, setShowNewParty] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyPhone, setNewPartyPhone] = useState("");
  const [showNewFabricParty, setShowNewFabricParty] = useState(false);
  const [newFabricName, setNewFabricName] = useState("");
  const [newFabricItemIdx, setNewFabricItemIdx] = useState(0);

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const updateForm = (key: keyof OrderData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateItem = (idx: number, key: keyof OrderItemFormData, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === idx ? { ...item, [key]: value } : item
      ),
    }));
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, defaultItem()] }));
    setExpandedItems((prev) => [...prev, form.items.length]);
  };

  const removeItem = (idx: number) => {
    if (form.items.length === 1) { toast.error("At least one item is required"); return; }
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
    setExpandedItems((prev) => prev.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i)));
  };

  const toggleItem = (idx: number) =>
    setExpandedItems((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );

  const handleImageUpload = async (idx: number, file: File) => {
    setUploadingIdx(idx);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `fabric-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("fabric-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("fabric-images").getPublicUrl(path);
      updateItem(idx, "fabric_image_url", urlData.publicUrl);
      toast.success("Image uploaded!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingIdx(null);
    }
  };

  const addNewParty = async () => {
    if (!newPartyName.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("parties")
      .insert([{ name: newPartyName.trim(), phone: newPartyPhone.trim() }])
      .select()
      .single();
    if (error) { toast.error("Failed to add party"); return; }
    setParties((prev) => [...prev, data as Party]);
    updateForm("party_id", data.id);
    if (newPartyPhone) updateForm("phone", newPartyPhone);
    setShowNewParty(false);
    setNewPartyName("");
    setNewPartyPhone("");
    toast.success("Party added!");
  };

  const addNewFabricParty = async () => {
    if (!newFabricName.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("fabric_parties")
      .insert([{ name: newFabricName.trim() }])
      .select()
      .single();
    if (error) { toast.error("Failed to add fabric party"); return; }
    setFabricParties((prev) => [...prev, data as FabricParty]);
    updateItem(newFabricItemIdx, "fabric_party_id", data.id);
    setShowNewFabricParty(false);
    setNewFabricName("");
    toast.success("Fabric party added!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.party_id) { toast.error("Please select a party"); return; }
    if (form.items.length === 0) { toast.error("Add at least one item"); return; }
    setSaving(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (editOrderId) {
        // Update existing order
        const { error: orderErr } = await supabase
          .from("oms_orders")
          .update({
            party_id: form.party_id,
            phone: form.phone || null,
            order_date: form.order_date,
            delivery_date: form.delivery_date || null,
            vyapar_order_number: form.vyapar_order_number || null,
            stitching_measurement_number: form.stitching_measurement_number || null,
            notes: form.notes || null,
          })
          .eq("id", editOrderId);
        if (orderErr) throw orderErr;

        // Delete and re-insert items
        await supabase.from("order_items").delete().eq("order_id", editOrderId);
        const itemsToInsert = form.items.map((item, i) => ({
          order_id: editOrderId,
          item_type: item.item_type,
          fabric_party_id: item.fabric_party_id || null,
          fabric_details: item.fabric_details || null,
          fabric_image_url: item.fabric_image_url || null,
          quantity: item.quantity,
          special_instructions: item.special_instructions || null,
          notes: item.notes || null,
          position: i,
        }));
        const { error: itemsErr } = await supabase.from("order_items").insert(itemsToInsert);
        if (itemsErr) throw itemsErr;

        toast.success("Order updated successfully!");
        router.push(`/orders/${editOrderId}`);
      } else {
        // Insert new order
        const { data: orderData, error: orderErr } = await supabase
          .from("oms_orders")
          .insert([{
            party_id: form.party_id,
            phone: form.phone || null,
            order_date: form.order_date,
            delivery_date: form.delivery_date || null,
            vyapar_order_number: form.vyapar_order_number || null,
            stitching_measurement_number: form.stitching_measurement_number || null,
            notes: form.notes || null,
            created_by: user?.id || null,
          }])
          .select()
          .single();
        if (orderErr) throw orderErr;

        const itemsToInsert = form.items.map((item, i) => ({
          order_id: orderData.id,
          item_type: item.item_type,
          fabric_party_id: item.fabric_party_id || null,
          fabric_details: item.fabric_details || null,
          fabric_image_url: item.fabric_image_url || null,
          quantity: item.quantity,
          special_instructions: item.special_instructions || null,
          notes: item.notes || null,
          position: i,
        }));
        const { error: itemsErr } = await supabase.from("order_items").insert(itemsToInsert);
        if (itemsErr) throw itemsErr;

        toast.success(`Order ${orderData.order_number} created!`);
        router.push(`/orders/${orderData.id}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">

      {/* Order Info */}
      <div className="form-section">
        <h2 className="form-section-title flex items-center gap-2">
          <span>📋</span> Order Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Party */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1.5">
              Party Name <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                id="order-party"
                value={form.party_id}
                onChange={(e) => {
                  updateForm("party_id", e.target.value);
                  const p = parties.find((p) => p.id === e.target.value);
                  if (p?.phone) updateForm("phone", p.phone);
                }}
                required
                className="flex-1 px-3 py-2.5 rounded-lg border bg-card text-sm outline-none focus:ring-2"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <option value="">Select a party...</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewParty(true)}
                className="px-3 py-2.5 rounded-lg border text-sm hover:bg-muted transition-colors whitespace-nowrap"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                + New
              </button>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Phone Number</label>
            <input
              id="order-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => updateForm("phone", e.target.value)}
              placeholder="9876543210"
              className="w-full px-3 py-2.5 rounded-lg border bg-card text-sm outline-none focus:ring-2"
              style={{ borderColor: "hsl(var(--border))" }}
            />
          </div>

          {/* Order Date */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Order Date <span className="text-red-500">*</span></label>
            <input
              id="order-date"
              type="date"
              value={form.order_date}
              onChange={(e) => updateForm("order_date", e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border bg-card text-sm outline-none focus:ring-2"
              style={{ borderColor: "hsl(var(--border))" }}
            />
          </div>

          {/* Delivery Date */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Delivery Date</label>
            <input
              id="order-delivery-date"
              type="date"
              value={form.delivery_date}
              onChange={(e) => updateForm("delivery_date", e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border bg-card text-sm outline-none focus:ring-2"
              style={{ borderColor: "hsl(var(--border))" }}
            />
          </div>

          {/* Vyapar No */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Vyapar Order No.</label>
            <input
              id="order-vyapar-no"
              type="text"
              value={form.vyapar_order_number}
              onChange={(e) => updateForm("vyapar_order_number", e.target.value)}
              placeholder="VYP-12345"
              className="w-full px-3 py-2.5 rounded-lg border bg-card text-sm outline-none focus:ring-2"
              style={{ borderColor: "hsl(var(--border))" }}
            />
          </div>

          {/* Measurement No */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Stitching Measurement No.</label>
            <input
              id="order-measurement-no"
              type="text"
              value={form.stitching_measurement_number}
              onChange={(e) => updateForm("stitching_measurement_number", e.target.value)}
              placeholder="M-001"
              className="w-full px-3 py-2.5 rounded-lg border bg-card text-sm outline-none focus:ring-2"
              style={{ borderColor: "hsl(var(--border))" }}
            />
          </div>

          {/* Notes */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1.5">Additional Notes</label>
            <textarea
              id="order-notes"
              value={form.notes}
              onChange={(e) => updateForm("notes", e.target.value)}
              placeholder="Any special notes for this order..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border bg-card text-sm outline-none focus:ring-2 resize-none"
              style={{ borderColor: "hsl(var(--border))" }}
            />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="form-section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="form-section-title flex items-center gap-2">
            <span>👗</span> Items ({form.items.length})
          </h2>
          <button
            type="button"
            id="add-item-btn"
            onClick={addItem}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ background: "hsl(var(--secondary))", color: "hsl(var(--secondary-foreground))" }}
          >
            + Add Item
          </button>
        </div>

        <div className="space-y-3">
          {form.items.map((item, idx) => (
            <div key={idx} className="border rounded-xl overflow-hidden" style={{ borderColor: "hsl(var(--border))" }}>
              {/* Item Header */}
              <button
                type="button"
                onClick={() => toggleItem(idx)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "hsl(var(--primary))" }}>
                    {idx + 1}
                  </span>
                  <span>{ITEM_TYPE_LABELS[item.item_type]} — Qty: {item.quantity}</span>
                  {item.fabric_image_url && <span className="text-green-600 text-xs">📸 Image</span>}
                </span>
                <div className="flex items-center gap-2">
                  {form.items.length > 1 && (
                    <span
                      onClick={(e) => { e.stopPropagation(); removeItem(idx); }}
                      className="text-red-500 hover:text-red-700 text-lg cursor-pointer"
                      title="Remove item"
                    >
                      ×
                    </span>
                  )}
                  <span className="text-muted-foreground">{expandedItems.includes(idx) ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Item Body */}
              {expandedItems.includes(idx) && (
                <div className="px-4 pb-4 pt-1 border-t space-y-4" style={{ borderColor: "hsl(var(--border))" }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Item Type */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Item Type <span className="text-red-500">*</span></label>
                      <select
                        id={`item-type-${idx}`}
                        value={item.item_type}
                        onChange={(e) => updateItem(idx, "item_type", e.target.value as ItemType)}
                        className="w-full px-3 py-2.5 rounded-lg border bg-card text-sm outline-none"
                        style={{ borderColor: "hsl(var(--border))" }}
                      >
                        {Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Quantity</label>
                      <input
                        id={`item-qty-${idx}`}
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2.5 rounded-lg border bg-card text-sm outline-none"
                        style={{ borderColor: "hsl(var(--border))" }}
                      />
                    </div>

                    {/* Fabric Party */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Fabric Party</label>
                      <div className="flex gap-2">
                        <select
                          id={`item-fabric-party-${idx}`}
                          value={item.fabric_party_id}
                          onChange={(e) => updateItem(idx, "fabric_party_id", e.target.value)}
                          className="flex-1 px-3 py-2.5 rounded-lg border bg-card text-sm outline-none"
                          style={{ borderColor: "hsl(var(--border))" }}
                        >
                          <option value="">Select fabric party...</option>
                          {fabricParties.map((fp) => (
                            <option key={fp.id} value={fp.id}>{fp.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => { setNewFabricItemIdx(idx); setShowNewFabricParty(true); }}
                          className="px-3 py-2.5 rounded-lg border text-sm hover:bg-muted transition-colors"
                          style={{ borderColor: "hsl(var(--border))" }}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Fabric Image */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Fabric Image</label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[idx]?.click()}
                          disabled={uploadingIdx === idx}
                          className="px-3 py-2.5 rounded-lg border text-sm hover:bg-muted transition-colors disabled:opacity-60"
                          style={{ borderColor: "hsl(var(--border))" }}
                        >
                          {uploadingIdx === idx ? "Uploading..." : "📸 Upload Image"}
                        </button>
                        <input
                          ref={(el) => { fileInputRefs.current[idx] = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(idx, file);
                          }}
                        />
                        {item.fabric_image_url && (
                          <div className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.fabric_image_url}
                              alt="Fabric"
                              className="w-12 h-12 object-cover rounded-lg border"
                              style={{ borderColor: "hsl(var(--border))" }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Fabric Details */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Fabric Details</label>
                      <textarea
                        id={`item-fabric-details-${idx}`}
                        value={item.fabric_details}
                        onChange={(e) => updateItem(idx, "fabric_details", e.target.value)}
                        placeholder="Fabric type, colour, design details..."
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-lg border bg-card text-sm outline-none resize-none"
                        style={{ borderColor: "hsl(var(--border))" }}
                      />
                    </div>

                    {/* Special Instructions */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Special Instructions</label>
                      <textarea
                        id={`item-instructions-${idx}`}
                        value={item.special_instructions}
                        onChange={(e) => updateItem(idx, "special_instructions", e.target.value)}
                        placeholder="Embroidery pattern, fit preferences, measurements..."
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-lg border bg-card text-sm outline-none resize-none"
                        style={{ borderColor: "hsl(var(--border))" }}
                      />
                    </div>

                    {/* Notes */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-1.5">Item Notes</label>
                      <textarea
                        id={`item-notes-${idx}`}
                        value={item.notes}
                        onChange={(e) => updateItem(idx, "notes", e.target.value)}
                        placeholder="Additional notes for this item..."
                        rows={1}
                        className="w-full px-3 py-2.5 rounded-lg border bg-card text-sm outline-none resize-none"
                        style={{ borderColor: "hsl(var(--border))" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          Cancel
        </button>
        <button
          id="save-order-btn"
          type="submit"
          disabled={saving}
          className="px-8 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
        >
          {saving ? "Saving..." : editOrderId ? "Update Order" : "Create Order"}
        </button>
      </div>

      {/* New Party Modal */}
      {showNewParty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "Cormorant Garamond, serif" }}>Add New Party</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  placeholder="Party name"
                  className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm outline-none"
                  style={{ borderColor: "hsl(var(--border))" }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={newPartyPhone}
                  onChange={(e) => setNewPartyPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm outline-none"
                  style={{ borderColor: "hsl(var(--border))" }}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNewParty(false)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted" style={{ borderColor: "hsl(var(--border))" }}>Cancel</button>
                <button type="button" onClick={addNewParty} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>Add Party</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Fabric Party Modal */}
      {showNewFabricParty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ fontFamily: "Cormorant Garamond, serif" }}>Add New Fabric Party</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newFabricName}
                  onChange={(e) => setNewFabricName(e.target.value)}
                  placeholder="Fabric party name"
                  className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm outline-none"
                  style={{ borderColor: "hsl(var(--border))" }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowNewFabricParty(false)} className="px-4 py-2 rounded-lg border text-sm hover:bg-muted" style={{ borderColor: "hsl(var(--border))" }}>Cancel</button>
                <button type="button" onClick={addNewFabricParty} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>Add</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
