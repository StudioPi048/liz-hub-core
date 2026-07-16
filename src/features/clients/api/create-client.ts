import { supabase } from "@/integrations/supabase/client";
import { CreateClientInput } from "../types/client.types";

export async function createClient(input: CreateClientInput) {
  const { error } = await supabase.from("crm_contacts").insert(input);

  if (error) {
    console.error("Erro ao criar cliente:", error);
    throw new Error("Não foi possível criar o dossiê. Verifique os dados e tente novamente.");
  }
}
