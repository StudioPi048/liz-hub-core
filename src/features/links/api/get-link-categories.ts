import { supabase } from "@/integrations/supabase/client";
import { LinkCategory } from "../types/link.types";

export async function getLinkCategories(): Promise<LinkCategory[]> {
  const { data, error } = await supabase.from("link_categories").select("*").order("sort_order");

  if (error) {
    console.error("Erro ao buscar categorias de links:", error);
    throw new Error("Não foi possível carregar as categorias.");
  }

  return data || [];
}
