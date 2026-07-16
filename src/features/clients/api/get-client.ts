import { supabase } from "@/integrations/supabase/client";
import { Client } from "../types/client.types";

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from("crm_contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar dossiê do cliente:", error);
    throw new Error("Não foi possível carregar este dossiê.");
  }

  return data;
}
