import type { ItemType } from "@/types";

/**
 * Normalizes an order item by decoding any embedded item_type tags
 * (e.g. [ITEM_TYPE:indo_western], [ITEM_TYPE:jacket], [ITEM_TYPE:jodhpuri])
 * used as a resilient fallback when database check constraints are pending migration.
 */
export function normalizeOrderItem<T extends { item_type: any; notes?: string | null; special_instructions?: string | null }>(item: T): T {
  if (!item) return item;
  let itemType = item.item_type;

  const match = 
    (item.notes || "").match(/\[ITEM_TYPE:(jacket|indo_western|jodhpuri)\]/) ||
    (item.special_instructions || "").match(/\[ITEM_TYPE:(jacket|indo_western|jodhpuri)\]/);

  if (match) {
    itemType = match[1] as ItemType;
    const cleanNotes = (item.notes || "").replace(/\[ITEM_TYPE:(jacket|indo_western|jodhpuri)\]\s*/, "").trim();
    const cleanInstructions = (item.special_instructions || "").replace(/\[ITEM_TYPE:(jacket|indo_western|jodhpuri)\]\s*/, "").trim();
    return {
      ...item,
      item_type: itemType,
      notes: cleanNotes || null,
      special_instructions: cleanInstructions || null,
    };
  }
  return item;
}

/**
 * Normalizes an array of order items.
 */
export function normalizeOrderItems<T extends { item_type: any; notes?: string | null; special_instructions?: string | null }>(items?: T[] | null): T[] {
  if (!items || !Array.isArray(items)) return [];
  return items.map(normalizeOrderItem);
}

/**
 * Normalizes an entire order object.
 */
export function normalizeOrder<T extends { order_items?: any[] }>(order: T): T {
  if (!order) return order;
  return {
    ...order,
    order_items: normalizeOrderItems(order.order_items),
  };
}

/**
 * Safely inserts order items.
 * First tries native insertion. If the database rejects jacket, indo_western, or jodhpuri
 * due to an outdated Postgres CHECK constraint, it transparently applies a tagged fallback
 * so the order creation never fails.
 */
export async function insertOrderItemsSafe(
  supabase: any,
  items: Array<{
    order_id: string;
    item_type: ItemType;
    fabric_party_id: string | null;
    fabric_details: string | null;
    fabric_image_url: string | null;
    quantity: number;
    special_instructions: string | null;
    notes: string | null;
    position: number;
  }>
): Promise<void> {
  if (!items || items.length === 0) return;

  // 1. Try native insertion first
  const { error } = await supabase.from("order_items").insert(items);
  if (!error) return;

  // 2. Check if error is due to check constraint on item_type
  const errStr = `${error.message || ""} ${error.details || ""} ${error.hint || ""}`.toLowerCase();
  const isConstraintErr = 
    errStr.includes("check constraint") || 
    errStr.includes("order_items_item_type_check") ||
    errStr.includes("item_type");

  if (isConstraintErr) {
    const fallbackItems = items.map((item) => {
      if (["jacket", "indo_western", "jodhpuri"].includes(item.item_type)) {
        const tag = `[ITEM_TYPE:${item.item_type}]`;
        const existingNotes = item.notes ? `${tag} ${item.notes}` : tag;
        return {
          ...item,
          item_type: "kurta" as ItemType, // Kurta is universally allowed in all schema versions
          notes: existingNotes,
        };
      }
      return item;
    });

    const { error: fallbackErr } = await supabase.from("order_items").insert(fallbackItems);
    if (fallbackErr) throw fallbackErr;
    return;
  }

  throw error;
}
