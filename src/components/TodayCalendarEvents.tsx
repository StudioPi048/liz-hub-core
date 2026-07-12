import { useQuery } from "@tanstack/react-query";
import { listTodayEvents } from "@/lib/google-calendar.functions";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";

export function TodayCalendarEvents() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["today-events"],
    queryFn: () => listTodayEvents(),
    retry: false,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  if (error || (data as any)?.needsAuth) {
    return (
      <div className="rounded-lg border-dashed border p-4 text-center">
        <p className="text-sm text-muted-foreground mb-2">Conecte seu Google Calendar para ver seus compromissos.</p>
        <Button asChild size="sm"><Link to="/agenda">Conectar Google Calendar</Link></Button>
      </div>
    );
  }

  const events = (data as any)?.events || [];
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Nenhum compromisso para hoje. 🎉</p>;

  return (
    <ul className="divide-y">
      {events.slice(0, 8).map((ev: any) => (
        <li key={ev.id} className="py-2 flex items-center gap-3">
          <div className="w-2 h-10 rounded-full" style={{ backgroundColor: ev.color || "#7c3aed" }} />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{ev.summary || "(sem título)"}</div>
            <div className="text-xs text-muted-foreground">
              {ev.start ? format(new Date(ev.start), "HH:mm") : ""} · {ev.calendarSummary}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
