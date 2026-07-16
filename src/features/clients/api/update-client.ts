import { supabase } from "@/integrations/supabase/client";
import { UpdateClientInput } from "../types/client.types";

export async function updateClient({ id, ...changes }: UpdateClientInput) {
  const { error } = await supabase.from("crm_contacts").update(changes).eq("id", id);

  if (error) {
    console.error("Erro ao atualizar cliente:", error);
    throw new Error("Não foi possível salvar as alterações deste dossiê.");
  }
}
