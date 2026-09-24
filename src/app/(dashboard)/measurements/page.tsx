import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import MeasurementsClient from "./MeasurementsClient";
import type { Order } from "@/types";

export default async function MeasurementsPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("oms_orders")
    .select(
      "id, order_number, order_date, delivery_date, stitching_measurement_number, vyapar_order_number, status, phone, created_at, party:parties(name, phone), attachments(id, file_url, file_name), order_items(id, item_type, quantity, fabric_details, special_instructions, notes)"
    )
    .not("stitching_measurement_number", "is", null)
    .neq("stitching_measurement_number", "")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading measurement slips...</div>}>
      <MeasurementsClient initialOrders={(orders || []) as unknown as Order[]} />
    </Suspense>
  );
}
