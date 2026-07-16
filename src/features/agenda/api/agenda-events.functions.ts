import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// CRUD para compromissos criados dentro do LIZ HUB (`agenda_events.source = "agenda"`).
//
// Eventos sincronizados do Google (`source = "google"`) permanecem somente-leitura
// aqui de propósito: editá-los localmente criaria divergência com a fonte externa.
// Para editar um evento do Google, o usuário deve fazê-lo no próprio Google Calendar
// e então sincronizar novamente (botão "Sincronizar" já existente na Agenda).
//
// Cancelamento é sempre lógico (soft-cancel): marcamos `status = "cancelled"` e
// preenchemos `cancelled_at` / `cancelled_by` / `cancellation_reason`. Nenhuma
// linha é excluída fisicamente.

const eventInputSchema = z.object({
  title: z.string().min(1, "Informe um título."),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  startsAt: z.string(),
  endsAt: z.string(),
  allDay: z.boolean().default(false),
  status: z.enum(["draft", "pending", "confirmed", "completed", "cancelled", "rescheduled"]),
  modality: z.enum(["online", "in_person", "hybrid"]).nullable().optional(),
  location: z.string().nullable().optional(),
  meetingUrl: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
});

// Compromissos vinculados a um cliente específico (crm_contacts.id), usados no
// dossiê do cliente. O vínculo é feito via `agenda_events.source_record_id`
// quando `source = "agenda"` — ver createAgendaEvent/updateAgendaEvent acima.
export const getAgendaEventsForClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: events, error } = await supabaseAdmin
      .from("agenda_events")
      .select(
        "id, title, starts_at, ends_at, all_day, status, location, meeting_url, modality, notes",
      )
      .eq("source", "agenda")
      .eq("source_record_id", data.clientId)
      .order("starts_at", { ascending: false });

    if (error) throw new Error("Não foi possível carregar os compromissos deste cliente.");
    return events ?? [];
  });

export const createAgendaEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => eventInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error, data: row } = await supabaseAdmin
      .from("agenda_events")
      .insert({
        title: data.title,
        description: data.description || null,
        notes: data.notes || null,
        starts_at: data.startsAt,
        ends_at: data.endsAt,
        all_day: data.allDay,
        status: data.status,
        modality: data.modality || null,
        location: data.location || null,
        meeting_url: data.meetingUrl || null,
        city: data.city || null,
        country: data.country || null,
        source: "agenda",
        source_record_id: data.clientId || null,
        owner_id: context.userId,
        created_by: context.userId,
        visibility: "internal",
      })
      .select("id")
      .single();

    if (error) throw new Error("Não foi possível criar o compromisso. Tente novamente.");
    return { id: row.id };
  });

export const updateAgendaEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => eventInputSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("agenda_events")
      .select("source")
      .eq("id", data.id)
      .maybeSingle();

    if (fetchError || !existing) throw new Error("Compromisso não encontrado.");
    if (existing.source !== "agenda") {
      throw new Error(
        "Este compromisso vem do Google Calendar e só pode ser editado por lá. Edite no Google e sincronize novamente.",
      );
    }

    const { error } = await supabaseAdmin
      .from("agenda_events")
      .update({
        title: data.title,
        description: data.description || null,
        notes: data.notes || null,
        starts_at: data.startsAt,
        ends_at: data.endsAt,
        all_day: data.allDay,
        status: data.status,
        modality: data.modality || null,
        location: data.location || null,
        meeting_url: data.meetingUrl || null,
        city: data.city || null,
        country: data.country || null,
        source_record_id: data.clientId || null,
        updated_by: context.userId,
      })
      .eq("id", data.id);

    if (error) throw new Error("Não foi possível salvar as alterações. Tente novamente.");
    return { ok: true };
  });

export const cancelAgendaEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), reason: z.string().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("agenda_events")
      .select("source")
      .eq("id", data.id)
      .maybeSingle();

    if (fetchError || !existing) throw new Error("Compromisso não encontrado.");
    if (existing.source !== "agenda") {
      throw new Error(
        "Este compromisso vem do Google Calendar. Cancele-o por lá e sincronize novamente.",
      );
    }

    const { error } = await supabaseAdmin
      .from("agenda_events")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: context.userId,
        cancellation_reason: data.reason || null,
      })
      .eq("id", data.id);

    if (error) throw new Error("Não foi possível cancelar o compromisso. Tente novamente.");
    return { ok: true };
  });
