import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import MeasurementsClient from "./MeasurementsClient";
import type { Order } from "@/types";

export const dynamic = "force-dynamic";

export default async function MeasurementsPage() {
  const supabase = await createClient();

  // Optimized query: Select only required fields for measurement cards & fast page load
  const { data: orders } = await supabase
    .from("oms_orders")
    .select(
      "id, order_number, order_date, delivery_date, stitching_measurement_number, vyapar_order_number, status, phone, created_at, party:parties(name, phone), order_items(id, item_type)"
    )
    .not("stitching_measurement_number", "is", null)
    .neq("stitching_measurement_number", "")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <Suspense fallback={<MeasurementsSkeleton />}>
      <MeasurementsClient initialOrders={(orders || []) as unknown as Order[]} />
    </Suspense>
  );
}

function MeasurementsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="h-8 w-64 bg-muted rounded-lg" />
          <div className="h-4 w-80 bg-muted rounded-lg mt-2" />
        </div>
        <div className="h-10 w-48 bg-muted rounded-lg" />
      </div>
      <div className="h-11 w-full bg-muted rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 bg-card rounded-xl border p-5 space-y-4 shadow-sm" />
        ))}
      </div>
    </div>
  );
}
