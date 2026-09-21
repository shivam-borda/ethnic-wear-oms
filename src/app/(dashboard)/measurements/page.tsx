import { createClient } from "@/lib/supabase/server";
import MeasurementsClient from "./MeasurementsClient";
import type { Order } from "@/types";

export default async function MeasurementsPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("oms_orders")
    .select("*, party:parties(*), attachments(*), order_items(*, fabric_party:fabric_parties(*))")
    .order("created_at", { ascending: false });

  return <MeasurementsClient initialOrders={(orders || []) as Order[]} />;
}
