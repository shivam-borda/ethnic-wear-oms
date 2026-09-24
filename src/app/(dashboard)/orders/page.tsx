import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import OrdersClient from "./OrdersClient";
import type { Order } from "@/types";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("oms_orders")
    .select(
      "id, order_number, vyapar_order_number, order_date, delivery_date, status, phone, stitching_measurement_number, created_at, party:parties(name, phone), order_items(id, item_type, quantity, item_progress(stitching_status, work_status))"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersClient initialOrders={(orders || []) as unknown as Order[]} />
    </Suspense>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 flex-1 bg-muted rounded-lg" />
        <div className="h-10 w-44 bg-muted rounded-lg" />
        <div className="h-10 w-44 bg-muted rounded-lg" />
        <div className="h-10 w-32 bg-muted rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 bg-card rounded-xl border p-5 space-y-4 shadow-sm" />
        ))}
      </div>
    </div>
  );
}
