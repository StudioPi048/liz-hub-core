import { useMemo } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function MiniCalendar({ className }: { className?: string }) {
  const today = new Date();

  const weekDays = useMemo(() => {
    const start = startOfWeek(today, { weekStartsOn: 0 });
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  }, [today]);

  return (
    <div className={cn("bg-white rounded-[14px] p-4 shadow-sm border border-border/30", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Esta Semana</h3>
        <span className="text-xs text-muted-foreground capitalize">
          {format(today, "MMMM yyyy", { locale: ptBR })}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {/* Headers */}
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className="text-[10px] font-medium text-muted-foreground mb-1 uppercase"
          >
            {format(day, "eeeee", { locale: ptBR })}
          </div>
        ))}

        {/* Days */}
        {weekDays.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toISOString()} className="flex justify-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  isToday
                    ? "bg-[var(--accent-lime)] text-[var(--accent-lime-text)]"
                    : "text-foreground hover:bg-muted cursor-pointer",
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
