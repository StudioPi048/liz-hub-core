import React from "react";
import {
  format,
  isToday,
  isTomorrow,
  isThisWeek,
  isSameMonth,
  addMonths,
  addWeeks,
  isSameWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { AgendaEvent } from "../model/agenda-event";
import { cn } from "@/lib/utils";
import { ExternalLink, MapPin, Video, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const isNextWeek = (date: Date) => isSameWeek(date, addWeeks(new Date(), 1));

interface TimelineViewProps {
  events: AgendaEvent[];
  onEventClick?: (event: AgendaEvent) => void;
  showStrategicHighlights?: boolean;
}

export function TimelineView({ events, onEventClick, showStrategicHighlights }: TimelineViewProps) {
  // Sort events chronologically
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  // Group events by semantic timeframes
  const groups = new Map<string, AgendaEvent[]>();

  const addGroup = (groupName: string, ev: AgendaEvent) => {
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName)!.push(ev);
  };

  const now = new Date();

  sortedEvents.forEach((ev) => {
    const d = new Date(ev.startsAt);
    if (isToday(d)) addGroup("Hoje", ev);
    else if (isTomorrow(d)) addGroup("Amanhã", ev);
    else if (isThisWeek(d)) addGroup("Esta Semana", ev);
    else if (isNextWeek(d)) addGroup("Próxima Semana", ev);
    else if (isSameMonth(d, now)) addGroup("Este Mês", ev);
    else if (isSameMonth(d, addMonths(now, 1)))
      addGroup(`Próximo Mês (${format(addMonths(now, 1), "MMMM", { locale: ptBR })})`, ev);
    else addGroup(format(d, "MMMM yyyy", { locale: ptBR }), ev);
  });

  if (sortedEvents.length === 0) {
    return (
      <div className="flex justify-center p-8 text-muted-foreground">
        Nenhum evento neste período.
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4">
      {[...groups.entries()].map(([groupName, groupEvents]) => (
        <div key={groupName} className="relative">
          <div className="sticky top-0 bg-background/95 backdrop-blur z-10 py-2 border-b mb-4 flex items-center gap-2">
            <h3 className="font-semibold text-lg capitalize">{groupName}</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {groupEvents.length}
            </span>
          </div>

          <div className="space-y-3">
            {groupEvents.map((ev) => {
              const isStrategic =
                showStrategicHighlights &&
                (ev.categorySlug === "curso" ||
                  ev.categorySlug === "viagem" ||
                  ev.categorySlug === "congresso");
              const isConflict = ev.conflictWarnings && ev.conflictWarnings.length > 0;
              const isOnline =
                ev.modality === "online" ||
                ev.location?.toLowerCase().includes("zoom") ||
                ev.location?.toLowerCase().includes("meet");

              return (
                <div
                  key={ev.id}
                  onClick={() => onEventClick?.(ev)}
                  className={cn(
                    "group flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-all cursor-pointer shadow-sm hover:shadow",
                    isStrategic && "border-primary/40 bg-primary/5",
                    isConflict && "border-destructive/40 bg-destructive/5",
                  )}
                >
                  <div className="w-full sm:w-32 shrink-0 flex flex-row sm:flex-col items-baseline sm:items-end justify-between sm:justify-start gap-2 sm:gap-0">
                    <span className="font-medium text-sm text-muted-foreground capitalize">
                      {format(new Date(ev.startsAt), "dd MMM", { locale: ptBR })}
                    </span>
                    <span className="font-semibold text-foreground">
                      {ev.allDay ? "O Dia Todo" : format(new Date(ev.startsAt), "HH:mm")}
                    </span>
                  </div>

                  <div
                    className="hidden sm:block w-1 rounded-full h-12"
                    style={{ backgroundColor: ev.colorKey || "hsl(var(--primary))" }}
                  />

                  <div className="flex-1 min-w-0 w-full space-y-1">
                    <div className="flex items-start justify-between gap-4">
                      <h4 className="font-semibold text-base leading-tight">{ev.title}</h4>
                      {isConflict && (
                        <Badge
                          variant="destructive"
                          className="shrink-0 flex items-center gap-1 text-[10px]"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Conflito
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground mt-2">
                      {ev.responsibleName && (
                        <div className="font-medium text-foreground/80">{ev.responsibleName}</div>
                      )}

                      {ev.location && (
                        <div className="flex items-center gap-1 max-w-[200px] truncate">
                          {isOnline ? (
                            <Video className="h-3 w-3 shrink-0" />
                          ) : (
                            <MapPin className="h-3 w-3 shrink-0" />
                          )}
                          <span className="truncate">{ev.location}</span>
                        </div>
                      )}

                      {ev.source === "google" && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-background">
                          {ev.calendarName || "Google"}
                        </Badge>
                      )}

                      {ev.status && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-4 px-1.5 capitalize font-normal"
                        >
                          {ev.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
