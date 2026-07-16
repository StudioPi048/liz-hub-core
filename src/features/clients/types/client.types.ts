import { Tables } from "@/integrations/supabase/types";

export type Client = Tables<"crm_contacts">;

export const CLIENT_STATUSES = ["novo", "em contato", "convertido", "perdido"] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export type CreateClientInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  origin?: string | null;
  interest?: string | null;
  status?: string;
  notes?: string | null;
};

export type UpdateClientInput = {
  id: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  origin?: string | null;
  interest?: string | null;
  status?: string;
  notes?: string | null;
};
