import { supabase } from "@/integrations/supabase/client";
import { CreateLinkInput } from "../types/link.types";

export async function createLink(input: CreateLinkInput): Promise<void> {
  const { error } = await supabase.from("links").insert({
    name: input.name,
    url: input.url,
    category_id: input.category_id || null,
    notes: input.notes || null,
  });

  if (error) {
    console.error("Erro ao criar link:", error);
    throw new Error(error.message || "Não foi possível criar o link.");
  }
}
