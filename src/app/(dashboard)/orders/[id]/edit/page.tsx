import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CreateOrderClient from "../../new/CreateOrderClient";
import type { Party, FabricParty, Order, OrderItemFormData } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditOrderPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: order },
    { data: parties },
    { data: fabricParties },
  ] = await Promise.all([
    supabase
      .from("oms_orders")
      .select("*, order_items(*), attachments(*)")
      .eq("id", id)
      .single(),
    supabase.from("parties").select("*").order("name"),
    supabase.from("fabric_parties").select("*").order("name"),
  ]);

  if (!order) notFound();

  const typedOrder = order as Order;

  const initialAttachments = (typedOrder.attachments || []).map((att) => ({
    id: att.id,
    file_url: att.file_url,
    file_name: att.file_name || "",
    file_type: att.file_type || "",
  }));

  const items: OrderItemFormData[] = (typedOrder.order_items || [])
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((item) => ({
      item_type: item.item_type,
      fabric_party_id: item.fabric_party_id || "",
      fabric_details: item.fabric_details || "",
      fabric_image_url: item.fabric_image_url || "",
      quantity: item.quantity,
      special_instructions: item.special_instructions || "",
      notes: item.notes || "",
    }));

  return (
    <CreateOrderClient
      parties={(parties || []) as Party[]}
      fabricParties={(fabricParties || []) as FabricParty[]}
      editOrderId={id}
      defaultValues={{
        party_id: typedOrder.party_id || "",
        phone: typedOrder.phone || "",
        order_date: typedOrder.order_date,
        delivery_date: typedOrder.delivery_date || "",
        vyapar_order_number: typedOrder.vyapar_order_number || "",
        stitching_measurement_number: typedOrder.stitching_measurement_number || "",
        notes: typedOrder.notes || "",
        items,
        initialAttachments,
      }}
    />
  );
}
