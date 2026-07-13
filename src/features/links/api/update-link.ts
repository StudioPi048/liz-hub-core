import { supabase } from "@/integrations/supabase/client";
import { UpdateLinkInput } from "../types/link.types";

export async function updateLink(input: UpdateLinkInput): Promise<void> {
  const { id, ...rest } = input;
  const patch: Record<string, unknown> = {};
  if (rest.name !== undefined) patch.name = rest.name;
  if (rest.url !== undefined) patch.url = rest.url;
  if (rest.category_id !== undefined) patch.category_id = rest.category_id || null;
  if (rest.notes !== undefined) patch.notes = rest.notes || null;

  const { error } = await supabase.from("links").update(patch).eq("id", id);

  if (error) {
    console.error("Erro ao atualizar link:", error);
    throw new Error(error.message || "Não foi possível atualizar o link.");
  }
}
