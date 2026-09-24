import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import OrdersClient from "./OrdersClient";
import type { Order } from "@/types";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("oms_orders")
    .select(`*, party:parties(name, phone), order_items(*, item_progress(*))`)
    .order("created_at", { ascending: false });

  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading orders list...</div>}>
      <OrdersClient initialOrders={(orders || []) as Order[]} />
    </Suspense>
  );
}
