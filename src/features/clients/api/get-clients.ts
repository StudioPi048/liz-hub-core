import { supabase } from "@/integrations/supabase/client";
import { Client } from "../types/client.types";

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("crm_contacts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar clientes:", error);
    throw new Error("Não foi possível carregar os dossiês de clientes.");
  }

  return data || [];
}
