import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getGoogleAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { requireGoogleEnv, signState, buildGoogleAuthUrl } =
      await import("./google-calendar.server");
    const { clientId, stateSecret } = requireGoogleEnv();
    const state = signState(context.userId, data.origin, stateSecret);
    return { url: buildGoogleAuthUrl(data.origin, state, clientId) };
  });

export const getGoogleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getValidAccessToken } = await import("./google-calendar.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = roles?.some(r => r.role === "admin") || false;
    
    const tokenResult = await getValidAccessToken(context.userId);
    return { ...tokenResult, isAdmin };
  });

export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // System-wide: any authenticated user (ideally admin) disconnecting removes the integration
    await supabaseAdmin.from("google_oauth_tokens").delete().neq("user_id", "");
    return { ok: true };
  });

export const listCalendars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getValidAccessToken, fetchCalendarList } = await import("./google-calendar.server");
    const tokenResult = await getValidAccessToken(context.userId);
    if (tokenResult.status !== "connected") {
      return { needsAuth: true as const, status: tokenResult.status, calendars: [] };
    }
    const token = { accessToken: tokenResult.accessToken };
    const items = await fetchCalendarList(token.accessToken);
    return {
      needsAuth: false as const,
      calendars: items.map((c) => ({
        id: c.id,
        summary: c.summary,
        primary: !!c.primary,
        backgroundColor: c.backgroundColor,
        accessRole: c.accessRole,
      })),
    };
  });

export const getAgendaEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: events, error } = await (supabaseAdmin as any)
      .from("agenda_events")
      .select("*")
      .gte("starts_at", data.from)
      .lte("ends_at", data.to)
      .order("starts_at", { ascending: true });

    if (error) throw error;

    // Adapt to frontend AgendaEvent model
    const adapted = (events || []).map((e: any) => ({
        id: e.id,
        source: e.source,
        title: e.title,
        description: e.description,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        allDay: e.all_day,
        timezone: e.timezone,
        calendarId: e.external_calendar_id,
        calendarName: null,
        location: e.location,
        isEditable: false,
        isExternal: e.source === 'google',
        visibility: e.visibility,
        isBlocking: e.is_blocking,
        isRecurring: e.is_recurring,
        status: e.status,
    }));

    return { events: adapted };
  });

export const listTodayEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: events, error } = await (supabaseAdmin as any)
      .from("agenda_events")
      .select("*")
      .gte("starts_at", startOfDay())
      .lte("ends_at", endOfDay())
      .order("starts_at", { ascending: true });
    
    if (error) throw error;
    
    const adapted = (events || []).map((e: any) => ({
        id: e.id,
        source: e.source,
        title: e.title,
        description: e.description,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        allDay: e.all_day,
        timezone: e.timezone,
        calendarId: e.external_calendar_id,
        calendarName: null,
        location: e.location,
        isEditable: false,
        isExternal: e.source === 'google',
        visibility: e.visibility,
        isBlocking: e.is_blocking,
        isRecurring: e.is_recurring,
        status: e.status,
    }));
    return { events: adapted };
  });

export const syncGoogleCalendarToDatabase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    // Only allow admin
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = roles?.some(r => r.role === "admin");
    if (!isAdmin) throw new Error("Apenas administradores podem sincronizar a agenda do sistema.");

    // Fetch from google
    const result = await fetchRangeEvents(context.userId, data.from, data.to);
    if (result.needsAuth) throw new Error("A integração do sistema com Google Calendar está desconectada ou expirada.");

    // Upsert into Supabase
    const eventsToUpsert = result.events.map(ev => ({
      source: "google",
      external_calendar_id: ev.calendarId,
      external_event_id: ev.id,
      title: ev.summary || "(Sem Título)",
      description: ev.description || null,
      starts_at: ev.start,
      ends_at: ev.end,
      all_day: ev.allDay,
      location: ev.location || null,
      color_key: ev.color,
      status: "confirmed"
    }));

    for (const ev of eventsToUpsert) {
      const { data: existing } = await (supabaseAdmin as any)
        .from("agenda_events")
        .select("id")
        .eq("external_calendar_id", ev.external_calendar_id)
        .eq("external_event_id", ev.external_event_id)
        .maybeSingle();

      if (existing) {
        await (supabaseAdmin as any).from("agenda_events").update(ev).eq("id", existing.id);
      } else {
        await (supabaseAdmin as any).from("agenda_events").insert(ev);
      }
    }

    return { ok: true, synced: eventsToUpsert.length };
  });

async function fetchRangeEvents(userId: string, timeMin: string, timeMax: string) {
  const { getValidAccessToken, fetchCalendarList, fetchEventsForCalendar } =
    await import("./google-calendar.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenResult = await getValidAccessToken();
  if (tokenResult.status !== "connected") {
    return { needsAuth: true as const, status: tokenResult.status, events: [] };
  }
  const token = { accessToken: tokenResult.accessToken };
  const cals = await fetchCalendarList(token.accessToken);

  // System-wide: Use the preferences of the user who connected the account
  const { data: prefs } = await supabaseAdmin
    .from("google_calendar_prefs")
    .select("*")
    .eq("user_id", tokenResult.ownerUserId);
  const prefsById = new Map((prefs || []).map((p) => [p.calendar_id, p]));

  const results: any[] = [];
  await Promise.all(
    cals.map(async (c: any) => {
      const pref = prefsById.get(c.id);
      if (pref && pref.is_visible === false) return;
      const items = await fetchEventsForCalendar(token.accessToken, c.id, timeMin, timeMax);
      for (const ev of items) {
        results.push({
          id: ev.id,
          summary: ev.summary,
          description: ev.description,
          location: ev.location,
          start: ev.start?.dateTime || ev.start?.date,
          end: ev.end?.dateTime || ev.end?.date,
          allDay: !ev.start?.dateTime,
          htmlLink: ev.htmlLink,
          calendarId: c.id,
          calendarSummary: c.summary,
          color: pref?.color || c.backgroundColor,
          sector: pref?.sector,
        });
      }
    }),
  );
  results.sort((a, b) => (a.start > b.start ? 1 : -1));
  return { needsAuth: false as const, events: results };
}

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function endOfDay() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
