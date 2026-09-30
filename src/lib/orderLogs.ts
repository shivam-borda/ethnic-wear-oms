import type { GarmentMeasurements, Order, OrderItemFormData, OrderAttachmentFormData, Party, FabricParty } from "@/types";
import { parseMeasurements, ITEM_TYPE_LABELS } from "@/types";

export interface FieldChange {
  field: string;
  label_gu?: string;
  old_value: string | null;
  new_value: string | null;
}

export type OrderActionType = 
  | "create" 
  | "update" 
  | "status_change" 
  | "stage_change" 
  | "delete" 
  | "other";

export interface OrderActivityLog {
  id: string;
  order_id: string;
  action: OrderActionType;
  title: string;
  title_gu?: string;
  description?: string;
  changes?: FieldChange[];
  created_at: string; // ISO date string
  user_name?: string | null;
}

const UPPER_MEASUREMENT_LABELS: Record<string, { en: string; gu: string }> = {
  lambai: { en: "Upper Lambai (Length)", gu: "લંબાઈ" },
  bai: { en: "Bai (Sleeve)", gu: "બાઈ" },
  solder: { en: "Solder (Shoulder)", gu: "સોલ્ડર" },
  chati: { en: "Chati (Chest)", gu: "છાતી" },
  pet: { en: "Pet (Stomach)", gu: "પેટ" },
  sheet_upper: { en: "Upper Sheet (Hips)", gu: "સીટ" },
  cap: { en: "Cuff", gu: "કફ" },
  coller: { en: "Coller (Collar/Neck)", gu: "કોલર" },
};

const BOTTOM_MEASUREMENT_LABELS: Record<string, { en: string; gu: string }> = {
  lambai_bottom: { en: "Bottom Lambai (Length)", gu: "બોટમ લંબાઈ" },
  kamber: { en: "Kamber (Waist)", gu: "કમર" },
  sheet: { en: "Bottom Sheet (Hips)", gu: "બોટમ સીટ" },
  jang: { en: "Jang (Thigh)", gu: "ઝાંગ" },
  moli: { en: "Moli (Bottom Opening)", gu: "મોરી" },
  kistak: { en: "Kistak (Inseam/Crotch)", gu: "કિસ્તક" },
  notes: { en: "Measurement Notes", gu: "માપણી નોંધ" },
};

/**
 * Extracts embedded activity logs from the stitching_measurement_number string.
 */
export function extractOrderLogs(raw?: string | null): OrderActivityLog[] {
  if (!raw) return [];
  try {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed);
      if (parsed && Array.isArray(parsed._activity_logs)) {
        return parsed._activity_logs;
      }
    }
  } catch {}
  return [];
}

/**
 * Combines measurements with activity logs into a JSON payload for stitching_measurement_number.
 */
export function encodeMeasurementsWithLogs(
  measurements: GarmentMeasurements,
  logs: OrderActivityLog[]
): string {
  const payload = {
    ...measurements,
    _activity_logs: logs,
  };
  return JSON.stringify(payload);
}

/**
 * Compares the original order with the updated form submission and produces a detailed list of field changes.
 */
export function diffOrderChanges(params: {
  originalOrder: Order;
  form: {
    party_id: string;
    phone: string;
    order_date: string;
    delivery_date: string;
    vyapar_order_number: string;
    notes: string;
    items: OrderItemFormData[];
  };
  newMeasurements: GarmentMeasurements;
  newAttachments: OrderAttachmentFormData[];
  parties: Party[];
  fabricParties: FabricParty[];
}): FieldChange[] {
  const { originalOrder, form, newMeasurements, newAttachments, parties, fabricParties } = params;
  const changes: FieldChange[] = [];

  // 1. Party / Customer Name
  const prevPartyName = parties.find((p) => p.id === originalOrder.party_id)?.name || originalOrder.party?.name || "None";
  const newPartyName = parties.find((p) => p.id === form.party_id)?.name || "None";
  if (originalOrder.party_id !== form.party_id && prevPartyName !== newPartyName) {
    changes.push({
      field: "Customer / Party",
      label_gu: "પાર્ટીનું નામ",
      old_value: prevPartyName,
      new_value: newPartyName,
    });
  }

  // 2. Phone
  const prevPhone = (originalOrder.phone || "").trim();
  const newPhone = (form.phone || "").trim();
  if (prevPhone !== newPhone) {
    changes.push({
      field: "Phone Number",
      label_gu: "મોબાઇલ નંબર",
      old_value: prevPhone || "—",
      new_value: newPhone || "—",
    });
  }

  // 3. Order Date
  const prevOrderDate = (originalOrder.order_date || "").trim();
  const newOrderDate = (form.order_date || "").trim();
  if (prevOrderDate !== newOrderDate) {
    changes.push({
      field: "Order Date",
      label_gu: "ઓર્ડર તારીખ",
      old_value: prevOrderDate || "—",
      new_value: newOrderDate || "—",
    });
  }

  // 4. Delivery Date
  const prevDeliveryDate = (originalOrder.delivery_date || "").trim();
  const newDeliveryDate = (form.delivery_date || "").trim();
  if (prevDeliveryDate !== newDeliveryDate) {
    changes.push({
      field: "Delivery Date",
      label_gu: "ડિલિવરી તારીખ",
      old_value: prevDeliveryDate || "Not Set",
      new_value: newDeliveryDate || "Not Set",
    });
  }

  // 5. Vyapar Order Number
  const prevVyapar = (originalOrder.vyapar_order_number || "").trim();
  const newVyapar = (form.vyapar_order_number || "").trim();
  if (prevVyapar !== newVyapar) {
    changes.push({
      field: "Vyapar Order Number",
      label_gu: "વેપાર ઓર્ડર નંબર",
      old_value: prevVyapar || "—",
      new_value: newVyapar || "—",
    });
  }

  // 6. Measurements & Slip Number
  const prevMeasurements = parseMeasurements(originalOrder.stitching_measurement_number);

  // Slip Number
  const prevSlip = (prevMeasurements.slip_number || "").trim();
  const newSlip = (newMeasurements.slip_number || "").trim();
  if (prevSlip !== newSlip) {
    changes.push({
      field: "Slip Number",
      label_gu: "સ્લિપ નંબર",
      old_value: prevSlip || "—",
      new_value: newSlip || "—",
    });
  }

  // Upper Body Measurements
  for (const [key, meta] of Object.entries(UPPER_MEASUREMENT_LABELS)) {
    const prevVal = ((prevMeasurements as Record<string, string | undefined>)[key] || "").trim();
    const newVal = ((newMeasurements as Record<string, string | undefined>)[key] || "").trim();
    if (prevVal !== newVal) {
      changes.push({
        field: meta.en,
        label_gu: meta.gu,
        old_value: prevVal || "—",
        new_value: newVal || "—",
      });
    }
  }

  // Bottom Measurements
  for (const [key, meta] of Object.entries(BOTTOM_MEASUREMENT_LABELS)) {
    const prevVal = ((prevMeasurements as Record<string, string | undefined>)[key] || "").trim();
    const newVal = ((newMeasurements as Record<string, string | undefined>)[key] || "").trim();
    if (prevVal !== newVal) {
      changes.push({
        field: meta.en,
        label_gu: meta.gu,
        old_value: prevVal || "—",
        new_value: newVal || "—",
      });
    }
  }

  // 7. General Notes
  const prevNotes = (originalOrder.notes || "").trim();
  const newNotes = (form.notes || "").trim();
  if (prevNotes !== newNotes) {
    changes.push({
      field: "General Notes",
      label_gu: "સામાન્ય નોંધ",
      old_value: prevNotes || "—",
      new_value: newNotes || "—",
    });
  }

  // 8. Items Comparison
  const oldItems = originalOrder.order_items || [];
  const newItems = form.items || [];

  if (oldItems.length !== newItems.length) {
    changes.push({
      field: "Item Count",
      label_gu: "કુલ આઇટમ્સ સંખ્યા",
      old_value: `${oldItems.length} item(s)`,
      new_value: `${newItems.length} item(s)`,
    });
  }

  // Compare item by item
  const maxItems = Math.max(oldItems.length, newItems.length);
  for (let i = 0; i < maxItems; i++) {
    const oldItm = oldItems[i];
    const newItm = newItems[i];

    if (!oldItm && newItm) {
      const typeLabel = ITEM_TYPE_LABELS[newItm.item_type] || newItm.item_type;
      const fpName = fabricParties.find((fp) => fp.id === newItm.fabric_party_id)?.name || "";
      changes.push({
        field: `Added Item #${i + 1}`,
        label_gu: `ઉમેરેલ આઇટમ #${i + 1}`,
        old_value: null,
        new_value: `${typeLabel} (Qty: ${newItm.quantity}${fpName ? `, Fabric: ${fpName}` : ""})`,
      });
    } else if (oldItm && !newItm) {
      const typeLabel = ITEM_TYPE_LABELS[oldItm.item_type] || oldItm.item_type;
      changes.push({
        field: `Removed Item #${i + 1}`,
        label_gu: `દૂર કરેલ આઇટમ #${i + 1}`,
        old_value: `${typeLabel} (Qty: ${oldItm.quantity})`,
        new_value: null,
      });
    } else if (oldItm && newItm) {
      const itemTitle = ITEM_TYPE_LABELS[newItm.item_type] || newItm.item_type;

      // Item Type
      if (oldItm.item_type !== newItm.item_type) {
        changes.push({
          field: `Item #${i + 1} Type`,
          label_gu: `આઇટમ #${i + 1} પ્રકાર`,
          old_value: ITEM_TYPE_LABELS[oldItm.item_type] || oldItm.item_type,
          new_value: ITEM_TYPE_LABELS[newItm.item_type] || newItm.item_type,
        });
      }

      // Quantity
      if (Number(oldItm.quantity) !== Number(newItm.quantity)) {
        changes.push({
          field: `Item #${i + 1} (${itemTitle}) Quantity`,
          label_gu: `આઇટમ #${i + 1} (${itemTitle}) જથ્થો`,
          old_value: String(oldItm.quantity),
          new_value: String(newItm.quantity),
        });
      }

      // Fabric Party
      if ((oldItm.fabric_party_id || "") !== (newItm.fabric_party_id || "")) {
        const oldFp = fabricParties.find((fp) => fp.id === oldItm.fabric_party_id)?.name || oldItm.fabric_party?.name || "None";
        const newFp = fabricParties.find((fp) => fp.id === newItm.fabric_party_id)?.name || "None";
        changes.push({
          field: `Item #${i + 1} (${itemTitle}) Fabric Supplier`,
          label_gu: `આઇટમ #${i + 1} (${itemTitle}) કાપડ પાર્ટી`,
          old_value: oldFp,
          new_value: newFp,
        });
      }

      // Fabric Details
      if ((oldItm.fabric_details || "").trim() !== (newItm.fabric_details || "").trim()) {
        changes.push({
          field: `Item #${i + 1} (${itemTitle}) Fabric Details`,
          label_gu: `આઇટમ #${i + 1} (${itemTitle}) કાપડ વિગત`,
          old_value: oldItm.fabric_details || "—",
          new_value: newItm.fabric_details || "—",
        });
      }

      // Special Instructions
      if ((oldItm.special_instructions || "").trim() !== (newItm.special_instructions || "").trim()) {
        changes.push({
          field: `Item #${i + 1} (${itemTitle}) Special Instructions`,
          label_gu: `આઇટમ #${i + 1} (${itemTitle}) ખાસ સૂચના`,
          old_value: oldItm.special_instructions || "—",
          new_value: newItm.special_instructions || "—",
        });
      }

      // Item Notes
      if ((oldItm.notes || "").trim() !== (newItm.notes || "").trim()) {
        changes.push({
          field: `Item #${i + 1} (${itemTitle}) Notes`,
          label_gu: `આઇટમ #${i + 1} (${itemTitle}) નોંધ`,
          old_value: oldItm.notes || "—",
          new_value: newItm.notes || "—",
        });
      }
    }
  }

  // 9. Attachments
  const oldAttCount = originalOrder.attachments?.length || 0;
  const newAttCount = newAttachments.length;
  if (oldAttCount !== newAttCount) {
    changes.push({
      field: "Attachments / Photos",
      label_gu: "ફોટા / સેમ્પલ",
      old_value: `${oldAttCount} file(s)`,
      new_value: `${newAttCount} file(s)`,
    });
  }

  return changes;
}

/**
 * Creates the initial creation log entry for a new order.
 */
export function createInitialOrderLog(params: {
  orderId: string;
  partyName: string;
  phone: string;
  orderDate: string;
  deliveryDate?: string | null;
  vyaparOrderNumber?: string | null;
  measurements: GarmentMeasurements;
  items: OrderItemFormData[];
  attachmentsCount: number;
  notes?: string | null;
  userName?: string | null;
}): OrderActivityLog {
  const {
    orderId,
    partyName,
    phone,
    orderDate,
    deliveryDate,
    vyaparOrderNumber,
    measurements,
    items,
    attachmentsCount,
    notes,
    userName,
  } = params;

  const initialFields: FieldChange[] = [
    { field: "Customer / Party", label_gu: "પાર્ટીનું નામ", old_value: null, new_value: partyName },
    { field: "Phone Number", label_gu: "મોબાઇલ નંબર", old_value: null, new_value: phone || "—" },
    { field: "Order Date", label_gu: "ઓર્ડર તારીખ", old_value: null, new_value: orderDate },
  ];

  if (deliveryDate) {
    initialFields.push({ field: "Delivery Date", label_gu: "ડિલિવરી તારીખ", old_value: null, new_value: deliveryDate });
  }
  if (vyaparOrderNumber) {
    initialFields.push({ field: "Vyapar Order Number", label_gu: "વેપાર ઓર્ડર નંબર", old_value: null, new_value: vyaparOrderNumber });
  }
  if (measurements.slip_number) {
    initialFields.push({ field: "Slip Number", label_gu: "સ્લિપ નંબર", old_value: null, new_value: measurements.slip_number });
  }

  // Upper Body Measurements summary
  const upperParts: string[] = [];
  for (const [k, meta] of Object.entries(UPPER_MEASUREMENT_LABELS)) {
    const val = (measurements as Record<string, string | undefined>)[k];
    if (val && val.trim()) upperParts.push(`${meta.gu}: ${val}`);
  }
  if (upperParts.length > 0) {
    initialFields.push({
      field: "Upper Body Measurements",
      label_gu: "ઉપરના કપડાનું માપ",
      old_value: null,
      new_value: upperParts.join(", "),
    });
  }

  // Bottom Measurements summary
  const bottomParts: string[] = [];
  for (const [k, meta] of Object.entries(BOTTOM_MEASUREMENT_LABELS)) {
    const val = (measurements as Record<string, string | undefined>)[k];
    if (val && val.trim()) bottomParts.push(`${meta.gu}: ${val}`);
  }
  if (bottomParts.length > 0) {
    initialFields.push({
      field: "Bottom Garment Measurements",
      label_gu: "બોટમનું માપ",
      old_value: null,
      new_value: bottomParts.join(", "),
    });
  }

  // Items summary
  const itemDescriptions = items.map((itm) => `${ITEM_TYPE_LABELS[itm.item_type] || itm.item_type} (Qty: ${itm.quantity})`);
  initialFields.push({
    field: "Ordered Items",
    label_gu: "ઓર્ડર આઇટમ્સ",
    old_value: null,
    new_value: itemDescriptions.join(", ") || `${items.length} items`,
  });

  if (attachmentsCount > 0) {
    initialFields.push({
      field: "Initial Attachments",
      label_gu: "ફોટા / સેમ્પલ",
      old_value: null,
      new_value: `${attachmentsCount} file(s)`,
    });
  }

  if (notes) {
    initialFields.push({ field: "Notes", label_gu: "ઓર્ડર નોંધ", old_value: null, new_value: notes });
  }

  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    order_id: orderId,
    action: "create",
    title: "Order Created",
    title_gu: "ઓર્ડર બનાવ્યો",
    description: `Order created with ${items.length} item(s)`,
    changes: initialFields,
    created_at: new Date().toISOString(),
    user_name: userName || "Staff",
  };
}

/**
 * Format a full readable date and time: e.g. "30 Sep 2026, 02:45:12 PM"
 */
export function formatLogDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

/**
 * Format a human-readable relative time (e.g. "2 mins ago", "Just now", "Yesterday")
 */
export function formatRelativeTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 10) return "Just now";
    if (diffSec < 60) return `${diffSec} seconds ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? "s" : ""} ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 30) return `${diffDay} days ago`;
    return formatLogDateTime(isoString);
  } catch {
    return "";
  }
}

/**
 * Records an order deletion log to browser localStorage audit trail.
 */
export function recordOrderDeletion(order: Order, userName?: string): void {
  try {
    const key = "oms_deleted_orders_audit";
    const existing = localStorage.getItem(key);
    const logs = existing ? JSON.parse(existing) : [];

    const deletionRecord = {
      order_id: order.id,
      order_number: order.order_number,
      party_name: order.party?.name || "Unknown",
      phone: order.phone || "",
      order_date: order.order_date,
      delivery_date: order.delivery_date,
      items_count: order.order_items?.length || 0,
      deleted_at: new Date().toISOString(),
      deleted_by: userName || "Staff",
      all_previous_logs: extractOrderLogs(order.stitching_measurement_number),
    };

    logs.unshift(deletionRecord);
    localStorage.setItem(key, JSON.stringify(logs.slice(0, 100)));
  } catch (e) {
    console.error("Failed to record order deletion in local audit trail", e);
  }
}
