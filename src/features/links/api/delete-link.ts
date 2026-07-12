import { supabase } from "@/integrations/supabase/client";

export async function deleteLink(id: string): Promise<void> {
  const { error } = await supabase.from("links").delete().eq("id", id);

  if (error) {
    console.error("Erro ao deletar link:", error);
    throw new Error(error.message || "Não foi possível remover o link.");
  }
}
