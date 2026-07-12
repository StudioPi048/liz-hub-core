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
    return await getValidAccessToken(context.userId);
  });

export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("google_oauth_tokens").delete().eq("user_id", context.userId);
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

export const listTodayEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await fetchRangeEvents(context.userId, startOfDay(), endOfDay());
  });

export const listRangeEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    return await fetchRangeEvents(context.userId, data.from, data.to);
  });

async function fetchRangeEvents(userId: string, timeMin: string, timeMax: string) {
  const { getValidAccessToken, fetchCalendarList, fetchEventsForCalendar } =
    await import("./google-calendar.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenResult = await getValidAccessToken(userId);
  if (tokenResult.status !== "connected") {
    return { needsAuth: true as const, status: tokenResult.status, events: [] };
  }
  const token = { accessToken: tokenResult.accessToken };
  const cals = await fetchCalendarList(token.accessToken);

  const { data: prefs } = await supabaseAdmin
    .from("google_calendar_prefs")
    .select("*")
    .eq("user_id", userId);
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
