import { createClient } from "@/lib/supabase/server";
import CreateOrderClient from "./CreateOrderClient";
import type { Party, FabricParty } from "@/types";

export default async function CreateOrderPage() {
  const supabase = await createClient();
  const [{ data: parties }, { data: fabricParties }] = await Promise.all([
    supabase.from("parties").select("*").order("name"),
    supabase.from("fabric_parties").select("*").order("name"),
  ]);

  return (
    <CreateOrderClient
      parties={(parties || []) as Party[]}
      fabricParties={(fabricParties || []) as FabricParty[]}
    />
  );
}
