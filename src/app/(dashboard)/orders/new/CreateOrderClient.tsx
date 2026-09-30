"use client";
import SearchableSelect from "@/components/ui/SearchableSelect";
import ImageCropperModal from "@/components/ui/ImageCropperModal";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Party, FabricParty, OrderItemFormData, ItemType, GarmentMeasurements, OrderAttachmentFormData, Order } from "@/types";
import { extractOrderLogs, encodeMeasurementsWithLogs, diffOrderChanges, createInitialOrderLog, type OrderActivityLog } from "@/lib/orderLogs";
import { getAttachmentCategory } from "@/types";
import { ITEM_TYPE_LABELS, parseMeasurements } from "@/types";

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

interface Props {
  parties: Party[];
  fabricParties: FabricParty[];
  editOrderId?: string;
  originalOrder?: Order;
  defaultValues?: Partial<OrderData> & { initialAttachments?: OrderAttachmentFormData[] };
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
  editOrderId,
  originalOrder,
  defaultValues,
}: Props) {
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [fabricParties, setFabricParties] = useState<FabricParty[]>(initialFabricParties);
  const [saving, setSaving] = useState(false);

  // Collapse sections by default as requested by user
  const [expandedItems, setExpandedItems] = useState<number[]>([]);
  const [isMeasurementExpanded, setIsMeasurementExpanded] = useState<boolean>(false);

  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  // Attachments & Reference Images state
  const [attachments, setAttachments] = useState<OrderAttachmentFormData[]>(
    defaultValues?.initialAttachments || []
  );
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [cropperData, setCropperData] = useState<{ src: string; title: string; onComplete: (file: File) => void } | null>(null);
  const [uploadingFabricAttachment, setUploadingFabricAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const fabricAttachmentInputRef = useRef<HTMLInputElement>(null);

  const fabricInputRef = useRef<HTMLInputElement>(null);

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  

    const uploadSingleFileToApi = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
    return data.url;
  };

  const processFileWithCropper = (
    filesArray: File[],
    category: 'reference' | 'fabric',
    itemIndex?: number
  ) => {
    if (filesArray.length === 0) return;

    const file = filesArray[0];
    const remainingFiles = filesArray.slice(1);

    const reader = new FileReader();
    reader.onload = () => {
      const isFabric = category === 'fabric';
      const title = itemIndex !== undefined
        ? "Crop & Optimize Item Fabric Image"
        : isFabric
        ? "Crop & Optimize Fabric / Material Sample"
        : "Crop & Optimize Design Reference Image";

      setCropperData({
        src: reader.result as string,
        title,
        onComplete: async (croppedFile: File) => {
          setCropperData(null);
          if (itemIndex !== undefined) setUploadingIdx(itemIndex);
          else if (isFabric) setUploadingFabricAttachment(true);
          else setUploadingAttachment(true);

          try {
            const url = await uploadSingleFileToApi(croppedFile);

            if (itemIndex !== undefined) {
              updateItem(itemIndex, "fabric_image_url", url);
              toast.success("Item fabric image uploaded to S3!");
            } else {
              const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
              const fileTypeWithCat = `image/jpeg;category=${category}`;

              setAttachments((prev) => [
                ...prev,
                {
                  file_url: url,
                  file_name: cleanName || (isFabric ? `Fabric Sample ${prev.length + 1}` : `Design Ref ${prev.length + 1}`),
                  file_type: fileTypeWithCat,
                  category,
                },
              ]);
              toast.success(`${isFabric ? "Fabric sample" : "Design reference"} uploaded to S3!`);
            }
          } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to upload image to S3");
          } finally {
            setUploadingIdx(null);
            setUploadingFabricAttachment(false);
            setUploadingAttachment(false);

            if (remainingFiles.length > 0) {
              setTimeout(() => {
                processFileWithCropper(remainingFiles, category, itemIndex);
              }, 250);
            }
          }
        },
      });
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = async (idx: number) => {
    const att = attachments[idx];
    if (att?.file_url && att.file_url.includes("amazonaws.com")) {
      try {
        await fetch(`/api/upload?url=${encodeURIComponent(att.file_url)}`, { method: "DELETE" });
      } catch (e) {
        console.error("Failed to delete S3 object:", e);
      }
    }
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Initialize measurements state
  const initialMeasurements = parseMeasurements(defaultValues?.stitching_measurement_number);
  const cleanSlip = (initialMeasurements.slip_number || "").trim().startsWith("{")
    ? ""
    : (initialMeasurements.slip_number || (defaultValues?.stitching_measurement_number && !defaultValues.stitching_measurement_number.trim().startsWith("{") ? defaultValues.stitching_measurement_number : ""));

  const [form, setForm] = useState<OrderData>({
    party_id: defaultValues?.party_id || "",
    phone: defaultValues?.phone || "",
    order_date: defaultValues?.order_date || format(new Date(), "yyyy-MM-dd"),
    delivery_date: defaultValues?.delivery_date || "",
    vyapar_order_number: defaultValues?.vyapar_order_number || "",
    stitching_measurement_number: cleanSlip,
    notes: defaultValues?.notes || "",
    items: defaultValues?.items || [],
  });

  const [measurements, setMeasurements] = useState<GarmentMeasurements>({
    slip_number: cleanSlip,
    // Upper Body
    lambai: initialMeasurements.lambai || "",
    bai: initialMeasurements.bai || "",
    solder: initialMeasurements.solder || "",
    chati: initialMeasurements.chati || "",
    pet: initialMeasurements.pet || "",
    sheet_upper: initialMeasurements.sheet_upper || "",
    cap: initialMeasurements.cap || "",
    coller: initialMeasurements.coller || "",
    // Bottom
    lambai_bottom: initialMeasurements.lambai_bottom || "",
    kamber: initialMeasurements.kamber || "",
    sheet: initialMeasurements.sheet || "",
    jang: initialMeasurements.jang || "",
    moli: initialMeasurements.moli || "",
    kistak: initialMeasurements.kistak || "",
    notes: initialMeasurements.notes || "",
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

  const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = form.notes;

      const before = value.substring(0, start);
      const after = value.substring(end);

      const newValue = before + "\n• " + after;
      updateForm("notes", newValue);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 3;
      }, 0);
    }
  };

  const handleNotesFocus = () => {
    if (!form.notes || form.notes.trim() === "") {
      updateForm("notes", "• ");
    }
  };

  const addBulletPoint = () => {
    if (!form.notes || form.notes.trim() === "") {
      updateForm("notes", "• ");
    } else {
      updateForm("notes", form.notes.trimEnd() + "\n• ");
    }
  };

  const updateMeasurement = (key: keyof GarmentMeasurements, value: string) => {
    setMeasurements((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "slip_number") {
        setForm((f) => ({ ...f, stitching_measurement_number: value }));
      }
      return next;
    });
  };

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
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
    setExpandedItems((prev) => prev.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i)));
  };

  const toggleItem = (idx: number) =>
    setExpandedItems((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );

  const handleImageUpload = async (idx: number, rawFile: File) => {
    processFileWithCropper([rawFile], "fabric", idx);
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
    
    setSaving(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const userName = user?.user_metadata?.full_name || user?.email || "Staff";

      if (editOrderId) {
        // Extract existing logs
        const existingLogs = extractOrderLogs(originalOrder?.stitching_measurement_number || defaultValues?.stitching_measurement_number);
        let updatedLogs = existingLogs;

        if (originalOrder) {
          const changes = diffOrderChanges({
            originalOrder,
            form,
            newMeasurements: measurements,
            newAttachments: attachments,
            parties,
            fabricParties,
          });

          if (changes.length > 0) {
            const editLog: OrderActivityLog = {
              id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              order_id: editOrderId,
              action: "update",
              title: "Order Details Updated",
              title_gu: "ઓર્ડર વિગતો સુધારી",
              description: `${changes.length} field(s) updated`,
              changes,
              created_at: new Date().toISOString(),
              user_name: userName,
            };
            updatedLogs = [editLog, ...existingLogs];

            try {
              await supabase.from("order_activity_logs").insert([{
                order_id: editOrderId,
                action: "update",
                description: editLog.description,
                field_changes: editLog.changes,
                performed_by: user?.id || null,
                performed_by_name: userName,
              }]);
            } catch {}
          }
        }

        const encodedMeasurement = encodeMeasurementsWithLogs(measurements, updatedLogs);

        // Update existing order
        const { error: orderErr } = await supabase
          .from("oms_orders")
          .update({
            party_id: form.party_id,
            phone: form.phone || null,
            order_date: form.order_date,
            delivery_date: form.delivery_date || null,
            vyapar_order_number: form.vyapar_order_number || null,
            stitching_measurement_number: encodedMeasurement,
            notes: form.notes || null,
          })
          .eq("id", editOrderId);
        if (orderErr) throw orderErr;

        // Delete and re-insert items to preserve position and clean update
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
        if (itemsToInsert.length > 0) {
          const { error: itemsErr } = await supabase.from("order_items").insert(itemsToInsert);
          if (itemsErr) throw itemsErr;
        }

        // Save attachments for existing order
        await supabase.from("attachments").delete().eq("order_id", editOrderId);
        if (attachments.length > 0) {
          const attachToInsert = attachments.map((att) => {
            const cat = att.category || getAttachmentCategory(att);
            const fileType = att.file_type?.includes("category=")
              ? att.file_type
              : `${att.file_type || "image/jpeg"};category=${cat}`;
            return {
              order_id: editOrderId,
              file_url: att.file_url,
              file_name: att.file_name || (cat === "reference" ? "Design Reference" : "Fabric Sample"),
              file_type: fileType,
              uploaded_by: user?.id || null,
            };
          });
          const { error: attErr } = await supabase.from("attachments").insert(attachToInsert);
          if (attErr) console.error("Failed to save attachments:", attErr);
        }

        toast.success("Order updated successfully!");
        router.refresh();
        router.push(`/orders/${editOrderId}`);
      } else {
        const selectedParty = parties.find((p) => p.id === form.party_id);
        const initialLog = createInitialOrderLog({
          orderId: "pending",
          partyName: selectedParty?.name || "Customer",
          phone: form.phone,
          orderDate: form.order_date,
          deliveryDate: form.delivery_date,
          vyaparOrderNumber: form.vyapar_order_number,
          measurements,
          items: form.items,
          attachmentsCount: attachments.length,
          notes: form.notes,
          userName,
        });

        const encodedMeasurement = encodeMeasurementsWithLogs(measurements, [initialLog]);

        // Insert new order
        const { data: orderData, error: orderErr } = await supabase
          .from("oms_orders")
          .insert([{
            party_id: form.party_id,
            phone: form.phone || null,
            order_date: form.order_date,
            delivery_date: form.delivery_date || null,
            vyapar_order_number: form.vyapar_order_number || null,
            stitching_measurement_number: encodedMeasurement,
            notes: form.notes || null,
            created_by: user?.id || null,
          }])
          .select()
          .single();
        if (orderErr) throw orderErr;

        try {
          await supabase.from("order_activity_logs").insert([{
            order_id: orderData.id,
            action: "create",
            description: initialLog.description,
            field_changes: initialLog.changes,
            performed_by: user?.id || null,
            performed_by_name: userName,
          }]);
        } catch {}

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
        if (itemsToInsert.length > 0) {
          const { error: itemsErr } = await supabase.from("order_items").insert(itemsToInsert);
          if (itemsErr) throw itemsErr;
        }

        // Save attachments for new order
        if (attachments.length > 0) {
          const attachToInsert = attachments.map((att) => {
            const cat = att.category || getAttachmentCategory(att);
            const fileType = att.file_type?.includes("category=")
              ? att.file_type
              : `${att.file_type || "image/jpeg"};category=${cat}`;
            return {
              order_id: orderData.id,
              file_url: att.file_url,
              file_name: att.file_name || (cat === "reference" ? "Design Reference" : "Fabric Sample"),
              file_type: fileType,
              uploaded_by: user?.id || null,
            };
          });
          const { error: attErr } = await supabase.from("attachments").insert(attachToInsert);
          if (attErr) console.error("Failed to save attachments:", attErr);
        }

        toast.success(`Order ${orderData.order_number} created!`);
        router.refresh();
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
            <label className="block text-sm font-medium mb-1.5">Select Party <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <SearchableSelect
                id="order-party-select"
                options={parties.map((p) => ({
                  value: p.id,
                  label: p.name,
                  subtext: p.phone || undefined,
                }))}
                value={form.party_id}
                onChange={(pId) => {
                  updateForm("party_id", pId);
                  const p = parties.find((party) => party.id === pId);
                  if (p?.phone) updateForm("phone", p.phone);
                }}
                placeholder="-- Select Party --"
                searchPlaceholder="Search party by name or phone..."
                required
              />
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

          {/* Stitching Slip No */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Stitching Slip / Book No.</label>
            <input
              id="order-measurement-no"
              type="text"
              value={measurements.slip_number || ""}
              onChange={(e) => {
                updateMeasurement("slip_number", e.target.value);
                updateForm("stitching_measurement_number", e.target.value);
              }}
              placeholder="M-001 / Slip #"
              className="w-full px-3 py-2.5 rounded-lg border bg-card text-sm outline-none focus:ring-2"
              style={{ borderColor: "hsl(var(--border))" }}
            />
          </div>

          {/* Notes */}
          
        </div>
      </div>

      {/* Measurement Details Section (Collapsible by Default) */}
      <div className="form-section border rounded-xl overflow-hidden bg-card" style={{ borderColor: "hsl(var(--border))" }}>
        <button
          type="button"
          onClick={() => setIsMeasurementExpanded(!isMeasurementExpanded)}
          className="w-full flex items-center justify-between p-4 font-semibold text-base transition-colors hover:bg-muted/40"
          style={{ fontFamily: "Cormorant Garamond, serif" }}
        >
          <div className="flex items-center gap-2 text-primary">
            <span className="text-lg">📏</span>
            <span>Measurement Section (માપણી વિગત)</span>
            {measurements.slip_number && !measurements.slip_number.startsWith("{") && (
              <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 ml-2 truncate max-w-[200px]">
                Slip: {measurements.slip_number}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{isMeasurementExpanded ? "Hide Section ▲" : "Show Measurement Section ▼"}</span>
          </div>
        </button>

        {isMeasurementExpanded && (
          <div className="p-5 border-t space-y-6 bg-card/50" style={{ borderColor: "hsl(var(--border))" }}>

            {/* Upper Body (Kurta / Koti / Blazer / Shirt) */}
            <div>
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span>👔</span> Upper Body Garment (અપર બોડી - Kurta / Koti / Blazer)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">1) Lambai (લંબાઈ)</label>
                  <input
                    type="text"
                    value={measurements.lambai || ""}
                    onChange={(e) => updateMeasurement("lambai", e.target.value)}
                    placeholder="e.g. 40"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">2) Bai (બાઈ)</label>
                  <input
                    type="text"
                    value={measurements.bai || ""}
                    onChange={(e) => updateMeasurement("bai", e.target.value)}
                    placeholder="e.g. 24"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">3) Solder (સોલ્ડર)</label>
                  <input
                    type="text"
                    value={measurements.solder || ""}
                    onChange={(e) => updateMeasurement("solder", e.target.value)}
                    placeholder="e.g. 18"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">4) Chati (છાતી)</label>
                  <input
                    type="text"
                    value={measurements.chati || ""}
                    onChange={(e) => updateMeasurement("chati", e.target.value)}
                    placeholder="e.g. 38"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">5) Pet (પેટ)</label>
                  <input
                    type="text"
                    value={measurements.pet || ""}
                    onChange={(e) => updateMeasurement("pet", e.target.value)}
                    placeholder="e.g. 34"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">6) Sheet (સીટ)</label>
                  <input
                    type="text"
                    value={measurements.sheet_upper || ""}
                    onChange={(e) => updateMeasurement("sheet_upper", e.target.value)}
                    placeholder="e.g. 40"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">7) Cap (કેપ)</label>
                  <input
                    type="text"
                    value={measurements.cap || ""}
                    onChange={(e) => updateMeasurement("cap", e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">8) Coller (કોલર)</label>
                  <input
                    type="text"
                    value={measurements.coller || ""}
                    onChange={(e) => updateMeasurement("coller", e.target.value)}
                    placeholder="e.g. 15.5"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
              </div>
            </div>

            {/* Lower Body (Pant / Pyjama / Bottom) */}
            <div>
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span>👖</span> Bottom Garment (બોટમ - Pant / Pyjama)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">1) Lambai (લંબાઈ)</label>
                  <input
                    type="text"
                    value={measurements.lambai_bottom || ""}
                    onChange={(e) => updateMeasurement("lambai_bottom", e.target.value)}
                    placeholder="e.g. 39"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">2) Kamber (કમર)</label>
                  <input
                    type="text"
                    value={measurements.kamber || ""}
                    onChange={(e) => updateMeasurement("kamber", e.target.value)}
                    placeholder="e.g. 34"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">3) Sheet (સીટ)</label>
                  <input
                    type="text"
                    value={measurements.sheet || ""}
                    onChange={(e) => updateMeasurement("sheet", e.target.value)}
                    placeholder="e.g. 40"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">4) Jang (ઝાંગ)</label>
                  <input
                    type="text"
                    value={measurements.jang || ""}
                    onChange={(e) => updateMeasurement("jang", e.target.value)}
                    placeholder="e.g. 24"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">5) Moli (મોરી)</label>
                  <input
                    type="text"
                    value={measurements.moli || ""}
                    onChange={(e) => updateMeasurement("moli", e.target.value)}
                    placeholder="e.g. 14"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">6) Kistak (કિસ્તક / ગાળો)</label>
                  <input
                    type="text"
                    value={measurements.kistak || ""}
                    onChange={(e) => updateMeasurement("kistak", e.target.value)}
                    placeholder="e.g. 26"
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />
                </div>
              </div>
            </div>


          </div>
        )}
      </div>

      {/* Items Section */}
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
          {form.items.length === 0 && (
            <div className="p-4 rounded-xl border border-dashed text-center text-sm text-muted-foreground bg-muted/20">
              No garments added yet. Click <span className="font-semibold text-primary">+ Add Item</span> to add an item, or save order with measurements only.
            </div>
          )}
          {form.items.map((item, idx) => (
            <div key={idx} className="border rounded-xl overflow-hidden bg-card" style={{ borderColor: "hsl(var(--border))" }}>
              {/* Item Header (Collapsed by Default) */}
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
                  
                </span>
                <div className="flex items-center gap-2">
                  <span
                    onClick={(e) => { e.stopPropagation(); removeItem(idx); }}
                    className="text-red-500 hover:text-red-700 text-lg cursor-pointer px-1"
                    title="Remove item"
                  >
                    ×
                  </span>
                  <span className="text-muted-foreground text-xs">{expandedItems.includes(idx) ? "▲ Collapse" : "▼ Details"}</span>
                </div>
              </button>

              {/* Item Body */}
              {expandedItems.includes(idx) && (
                <div className="px-4 pb-4 pt-1 border-t space-y-4" style={{ borderColor: "hsl(var(--border))" }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Item Type */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Item Type <span className="text-red-500">*</span></label>
                      <SearchableSelect
                        id={`item-type-${idx}`}
                        options={Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => ({
                          value: k,
                          label: v,
                        }))}
                        value={item.item_type}
                        onChange={(val) => updateItem(idx, "item_type", val as ItemType)}
                        placeholder="-- Select Item Type --"
                        searchPlaceholder="Search garment type..."
                        required
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Quantity</label>
                      <input
                        id={`item-qty-${idx}`}
                        type="number"
                        min={1}
                        value={item.quantity === 0 || (item.quantity as unknown) === "" ? "" : item.quantity}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            updateItem(idx, "quantity", "" as unknown as number);
                          } else {
                            const val = parseInt(raw, 10);
                            updateItem(idx, "quantity", isNaN(val) ? ("" as unknown as number) : val);
                          }
                        }}
                        onBlur={() => {
                          if (!item.quantity || Number(item.quantity) < 1) {
                            updateItem(idx, "quantity", 1);
                          }
                        }}
                        className="w-full px-3 py-2.5 rounded-lg border bg-card text-sm outline-none"
                        style={{ borderColor: "hsl(var(--border))" }}
                      />
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
                      <label className="block text-sm font-medium mb-1.5">Special Instructions (Embroidery / Handwork / Fitting)</label>
                      <textarea
                        id={`item-instructions-${idx}`}
                        value={item.special_instructions}
                        onChange={(e) => updateItem(idx, "special_instructions", e.target.value)}
                        placeholder="Embroidery pattern, handwork details, fit preferences..."
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

      
      {/* SECTION 1: Fabric, Color & Material Section */}
      <div className="form-section border rounded-xl overflow-hidden bg-card p-5 space-y-4" style={{ borderColor: "hsl(var(--border))" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "hsl(var(--border))" }}>
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              <span>🧵</span> Fabric, Color & Material Section (ફાબ્રિક, કલર અને મટીરીયલ વિગત)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Store fabric photos, color swatches, material samples and write design specification points
            </p>
          </div>
          <div>
            <button
              type="button"
              disabled={uploadingFabricAttachment}
              onClick={() => fabricAttachmentInputRef.current?.click()}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              <span>🧶</span> {uploadingFabricAttachment ? "Uploading..." : "+ Add Fabric / Material Images"}
            </button>
            <input
              ref={fabricAttachmentInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  processFileWithCropper(Array.from(e.target.files), "fabric");
                  e.target.value = "";
                }
              }}
            />
          </div>
        </div>

        {/* Fabric & Material Uploaded Images List */}
        {attachments.filter((a) => { const c = getAttachmentCategory(a); return c === "fabric" || c === "color" || c === "material"; }).length === 0 ? (
          <div
            onClick={() => fabricAttachmentInputRef.current?.click()}
            className="p-5 rounded-xl border border-dashed text-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <p className="text-2xl mb-1">🧶</p>
            <p className="font-medium text-foreground text-sm">No fabric or material images added yet</p>
            <p className="text-muted-foreground mt-0.5">Click here to upload fabric photos, color swatches, buttons or material samples</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
            {attachments.map((att, idx) => {
              const currentCat = getAttachmentCategory(att);
              if (currentCat !== "fabric" && currentCat !== "color" && currentCat !== "material") return null;
              return (
                <div
                  key={idx}
                  className="relative border rounded-xl p-3 bg-background flex flex-col space-y-2 group shadow-sm"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <div className="relative w-full h-32 rounded-lg overflow-hidden border bg-black/5" style={{ borderColor: "hsl(var(--border))" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={att.file_url} alt={att.file_name || "Attachment"} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-bold shadow-md hover:bg-red-700 transition-colors"
                      title="Remove image"
                    >
                      ×
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Category</label>
                    <select
                      value={att.category || "fabric"}
                      onChange={(e) => {
                        const cat = e.target.value as any;
                        setAttachments((prev) => prev.map((item, i) => (i === idx ? {
                          ...item,
                          category: cat,
                          file_type: `${(item.file_type || "image/jpeg").split(";")[0]};category=${cat}`
                        } : item)));
                      }}
                      className="w-full px-2 py-1.5 rounded-lg border bg-card text-xs outline-none focus:ring-1"
                      style={{ borderColor: "hsl(var(--border))" }}
                    >
                      <option value="fabric">🧵 Fabric Image (ફાબ્રિક)</option>
                      <option value="color">🎨 Color Swatch (કલર)</option>
                      <option value="material">🔩 Material / Accessory (મટીરીયલ)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Image Name / Description</label>
                    <input
                      type="text"
                      value={att.file_name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAttachments((prev) => prev.map((item, i) => (i === idx ? { ...item, file_name: val } : item)));
                      }}
                      placeholder="e.g. Silk Fabric #402, Blue Shade..."
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-card text-xs outline-none focus:ring-1"
                      style={{ borderColor: "hsl(var(--border))" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dedicated Smart Bullet-Point Textarea inside Fabric & Material Section */}
        <div className="pt-3 border-t space-y-2" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-primary">
              Fabric & Material Specification Points (મટીરીયલ અને ડિઝાઈન પોઈન્ટ્સ)
            </label>
            <button
              type="button"
              onClick={addBulletPoint}
              className="text-xs font-semibold px-2.5 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1"
            >
              <span>•</span> + Add Bullet Point
            </button>
          </div>
          <textarea
            id="order-notes"
            value={form.notes}
            onFocus={handleNotesFocus}
            onKeyDown={handleNotesKeyDown}
            onChange={(e) => updateForm("notes", e.target.value)}
            placeholder="• Type a fabric point and press Enter to add next bullet point automatically..."
            rows={4}
            className="w-full px-3.5 py-2.5 rounded-lg border bg-background text-sm outline-none focus:ring-2 leading-relaxed"
            style={{ borderColor: "hsl(var(--border))" }}
          />
          <p className="text-[11px] text-muted-foreground">
            💡 Press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Enter</kbd> to automatically add bullet point (<code className="text-primary">•</code>) for list formatting (<code className="text-xs">&lt;ul&gt; &lt;li&gt;</code>).
          </p>
        </div>
      </div>

      {/* SECTION 2: Multiple Design Reference Images Section */}
      <div className="form-section border rounded-xl overflow-hidden bg-card p-5 space-y-4" style={{ borderColor: "hsl(var(--border))" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "hsl(var(--border))" }}>
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              <span>📸</span> Design & Style Reference Images (ડિઝાઈન રેફરન્સ ઈમેજ)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upload multiple design style photos, customer references, neck cuts, or embroidery photos
            </p>
          </div>
          <div>
            <button
              type="button"
              disabled={uploadingAttachment}
              onClick={() => attachmentInputRef.current?.click()}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
              style={{ background: "hsl(var(--secondary))", color: "hsl(var(--secondary-foreground))" }}
            >
              <span>📷</span> {uploadingAttachment ? "Uploading..." : "+ Add Design References"}
            </button>
            <input
              ref={attachmentInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  processFileWithCropper(Array.from(e.target.files), "reference");
                  e.target.value = "";
                }
              }}
            />
          </div>
        </div>

        {/* Uploaded Design Reference Images List */}
        {attachments.filter((a) => getAttachmentCategory(a) === "reference").length === 0 ? (
          <div
            onClick={() => attachmentInputRef.current?.click()}
            className="p-5 rounded-xl border border-dashed text-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/30 transition-colors"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <p className="text-2xl mb-1">📸</p>
            <p className="font-medium text-foreground text-sm">No design reference images added yet</p>
            <p className="text-muted-foreground mt-0.5">Click here to upload customer reference photos, embroidery patterns, back cut or suit design photos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
            {attachments.map((att, idx) => {
              const currentCat = getAttachmentCategory(att);
              if (currentCat !== "reference") return null;
              return (
                <div
                  key={idx}
                  className="relative border rounded-xl p-3 bg-background flex flex-col space-y-2 group shadow-sm"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <div className="relative w-full h-32 rounded-lg overflow-hidden border bg-black/5" style={{ borderColor: "hsl(var(--border))" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={att.file_url} alt={att.file_name || "Attachment"} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-bold shadow-md hover:bg-red-700 transition-colors"
                      title="Remove image"
                    >
                      ×
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Design Reference Title</label>
                    <input
                      type="text"
                      value={att.file_name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAttachments((prev) => prev.map((item, i) => (i === idx ? { ...item, file_name: val } : item)));
                      }}
                      placeholder="e.g. Front Neck Pattern, Back Cut..."
                      className="w-full px-2.5 py-1.5 rounded-lg border bg-card text-xs outline-none focus:ring-1"
                      style={{ borderColor: "hsl(var(--border))" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
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


    {cropperData && (
        <ImageCropperModal
          imageSrc={cropperData.src}
          title={cropperData.title}
          onCropComplete={cropperData.onComplete}
          onCancel={() => setCropperData(null)}
        />
      )}
    </form>
  );
}
