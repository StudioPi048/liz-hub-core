import { Tables } from "@/integrations/supabase/types";

export type LinkCategory = Tables<"link_categories">;

// A custom type is needed because we fetch the joined `link_categories` data
export type LinkWithCategory = Tables<"links"> & {
  link_categories: Pick<LinkCategory, "name" | "color"> | null;
};

export type CreateLinkInput = {
  name: string;
  url: string;
  category_id?: string | null;
  notes?: string | null;
};
