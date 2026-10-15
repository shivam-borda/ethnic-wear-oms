import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import OrderDetailClient from "./OrderDetailClient";
import type { Order } from "@/types";
import type { OrderActivityLog } from "@/lib/orderLogs";
import { normalizeOrder } from "@/lib/orderItems";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("oms_orders")
    .select(`
      *,
      party:parties(*),
      attachments(*),
      order_items(
        *,
        fabric_party:fabric_parties(*),
        item_progress(*),
        progress_history:item_progress_history(*, profile:profiles(full_name, role))
      )
    `)
    .eq("id", id)
    .single();

  if (!order) notFound();

  let activityLogs: OrderActivityLog[] = [];
  try {
    const { data: logs } = await supabase
      .from("order_activity_logs")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: false });
    if (logs && Array.isArray(logs)) {
      activityLogs = logs;
    }
  } catch {}

  // Normalize items and sort by position
  const normalizedOrder = normalizeOrder(order);
  const sortedOrder = {
    ...normalizedOrder,
    order_items: [...(normalizedOrder.order_items || [])].sort(
      (a, b) => (a.position || 0) - (b.position || 0)
    ),
  };

  return <OrderDetailClient order={sortedOrder as Order} additionalLogs={activityLogs} />;
}
