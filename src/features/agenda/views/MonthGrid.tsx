import React from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { AgendaEvent } from "../model/agenda-event";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MonthGridProps {
  currentDate: Date;
  events: AgendaEvent[];
  onDayClick?: (date: Date) => void;
  onEventClick?: (event: AgendaEvent) => void;
  maxEventsPerDay?: number;
}

export function MonthGrid({
  currentDate,
  events,
  onDayClick,
  onEventClick,
  maxEventsPerDay = 3,
}: MonthGridProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Domingo
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const eventsByDay = (day: Date) => {
    return events.filter((e) => isSameDay(new Date(e.startsAt), day));
  };

  return (
    <div className="flex flex-col w-full border rounded-lg overflow-hidden bg-background">
      {/* HEADER DIAS DA SEMANA */}
      <div className="grid grid-cols-7 border-b bg-muted/20">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* GRADE DE DIAS */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isDayToday = isToday(day);
          const dayEvents = eventsByDay(day);
          const overflow = dayEvents.length > maxEventsPerDay;
          const displayEvents = dayEvents.slice(0, maxEventsPerDay);

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick?.(day)}
              className={cn(
                "min-h-[120px] p-1 border-r border-b relative group hover:bg-muted/10 transition-colors cursor-pointer flex flex-col gap-1",
                !isCurrentMonth && "bg-muted/5 opacity-50",
                idx % 7 === 6 && "border-r-0",
              )}
            >
              <div className="flex justify-between items-center px-1 pt-1">
                <span
                  className={cn(
                    "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isDayToday ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{dayEvents.length} ev</span>
                )}
              </div>

              <div className="flex flex-col gap-1 mt-1 flex-1 overflow-hidden">
                {displayEvents.map((ev) => {
                  const isConflict = ev.conflictWarnings && ev.conflictWarnings.length > 0;
                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(ev);
                      }}
                      className={cn(
                        "px-1.5 py-0.5 text-xs rounded truncate border-l-2 text-left cursor-pointer transition-colors",
                        ev.allDay
                          ? "bg-primary/10 border-l-primary text-primary"
                          : "bg-transparent border-l-muted-foreground text-foreground hover:bg-muted",
                        isConflict &&
                          "border-l-destructive bg-destructive/10 text-destructive font-medium",
                      )}
                      title={ev.title}
                    >
                      {!ev.allDay && (
                        <span className="font-medium mr-1">
                          {format(new Date(ev.startsAt), "HH:mm")}
                        </span>
                      )}
                      {ev.title}
                    </div>
                  );
                })}
                {overflow && (
                  <div className="text-[10px] font-medium text-muted-foreground px-1.5 hover:text-foreground">
                    +{dayEvents.length - maxEventsPerDay} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
