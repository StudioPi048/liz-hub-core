import { supabase } from "@/integrations/supabase/client";

export async function deleteClient(id: string) {
  const { error } = await supabase.from("crm_contacts").delete().eq("id", id);

  if (error) {
    console.error("Erro ao remover cliente:", error);
    throw new Error("Não foi possível remover este dossiê.");
  }
}
