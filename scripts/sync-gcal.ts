import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function refresh(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`refresh: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number; scope: string }>;
}

const { data: row } = await supabase.from("google_oauth_tokens").select("*").limit(1).maybeSingle();
if (!row) throw new Error("Sem token Google.");

let accessToken = row.access_token;
const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
if (!accessToken || expiresAt < Date.now() + 60_000) {
  const r = await refresh(row.refresh_token);
  accessToken = r.access_token;
  await supabase.from("google_oauth_tokens").update({
    access_token: r.access_token,
    token_expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString(),
    scope: r.scope,
  }).eq("user_id", row.user_id);
  console.log("token refreshed");
}

const now = new Date();
const from = now.toISOString();
const to = new Date(now.getTime() + 42 * 24 * 3600 * 1000).toISOString();

const calsRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const cals = (await calsRes.json()).items || [];
console.log(`${cals.length} calendários`);

const { data: prefs } = await supabase.from("google_calendar_prefs").select("*").eq("user_id", row.user_id);
const prefsById = new Map((prefs || []).map((p: any) => [p.calendar_id, p]));

let total = 0;
for (const c of cals) {
  const pref = prefsById.get(c.id);
  if (pref && pref.is_visible === false) continue;
  const params = new URLSearchParams({ timeMin: from, timeMax: to, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.id)}/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) { console.warn(`skip ${c.summary}: ${r.status}`); continue; }
  const items = (await r.json()).items || [];
  for (const ev of items) {
    const start = ev.start?.dateTime || ev.start?.date;
    const end = ev.end?.dateTime || ev.end?.date;
    if (!start || !end) continue;
    const { error } = await supabase.from("agenda_events").upsert({
      source: "google",
      external_calendar_id: c.id,
      external_event_id: ev.id,
      title: ev.summary || "(Sem Título)",
      description: ev.description || null,
      starts_at: start,
      ends_at: end,
      all_day: !ev.start?.dateTime,
      location: ev.location || null,
      color_key: (pref as any)?.color || c.backgroundColor || null,
      status: "confirmed",
    }, { onConflict: "external_calendar_id,external_event_id" });
    if (error) console.error(ev.summary, error.message);
    else total++;
  }
  console.log(`  ${c.summary}: ${items.length}`);
}
console.log(`\nTotal upserts: ${total}`);
