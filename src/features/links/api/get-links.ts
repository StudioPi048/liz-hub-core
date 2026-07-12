import { supabase } from "@/integrations/supabase/client";
import { LinkWithCategory } from "../types/link.types";

export async function getLinks(): Promise<LinkWithCategory[]> {
  const { data, error } = await supabase
    .from("links")
    .select("*, link_categories(name, color)")
    .order("name");

  if (error) {
    console.error("Erro ao buscar links:", error);
    throw new Error("Não foi possível carregar os links.");
  }

  return (data as LinkWithCategory[]) || [];
}
