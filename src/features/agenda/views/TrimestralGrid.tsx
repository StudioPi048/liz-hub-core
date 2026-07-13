import React from "react";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MonthGrid } from "./MonthGrid";
import { AgendaEvent } from "../model/agenda-event";

interface TrimestralGridProps {
  currentDate: Date; // A data focal que vai guiar o trimestre (mês 1)
  events: AgendaEvent[];
  onDayClick?: (date: Date) => void;
  onEventClick?: (event: AgendaEvent) => void;
}

export function TrimestralGrid({
  currentDate,
  events,
  onDayClick,
  onEventClick,
}: TrimestralGridProps) {
  const months = [currentDate, addMonths(currentDate, 1), addMonths(currentDate, 2)];

  return (
    <div className="flex flex-col gap-10 overflow-y-auto pb-8">
      {months.map((month, idx) => (
        <div key={idx} className="flex flex-col gap-3 min-w-[300px]">
          <h3 className="font-semibold text-lg capitalize px-1">
            {format(month, "MMMM yyyy", { locale: ptBR })}
          </h3>
          <div className="flex-1">
            <MonthGrid
              currentDate={month}
              events={events}
              onDayClick={onDayClick}
              onEventClick={onEventClick}
              maxEventsPerDay={4} // Espaço vertical de sobra na visão trimestral
            />
          </div>
        </div>
      ))}
    </div>
  );
}
