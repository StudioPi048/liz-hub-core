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
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 overflow-y-auto">
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
              maxEventsPerDay={2} // Mais condensado para visão 3 meses
            />
          </div>
        </div>
      ))}
    </div>
  );
}
