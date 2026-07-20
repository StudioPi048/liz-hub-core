import React, { useMemo } from "react";
import { AgendaFilters, defaultAgendaFilters } from "../model/agenda-filters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FilterX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AgendaEvent, AgendaEventSource, AgendaEventStatus } from "../model/agenda-event";
import { EVENT_STATUS_LABEL, EVENT_ORIGIN_LABEL } from "../model/labels";
// Assume Select/Combobox components exist, or use standard HTML selects for simplicity in this iteration

interface AgendaFiltersBarProps {
  filters: AgendaFilters;
  onChange: (updates: Partial<AgendaFilters>) => void;
  onClear: () => void;
  availableEvents: AgendaEvent[]; // To derive options
}

export function AgendaFiltersBar({
  filters,
  onChange,
  onClear,
  availableEvents,
}: AgendaFiltersBarProps) {
  // Derive options from current dataset
  const categories = useMemo(
    () =>
      Array.from(new Set(availableEvents.map((e) => e.categorySlug).filter(Boolean))) as string[],
    [availableEvents],
  );
  const responsibles = useMemo(
    () =>
      Array.from(
        new Set(availableEvents.map((e) => e.responsibleName || e.responsibleId).filter(Boolean)),
      ) as string[],
    [availableEvents],
  );
  const statuses = useMemo(
    () => Array.from(new Set(availableEvents.map((e) => e.status).filter(Boolean))) as string[],
    [availableEvents],
  );
  const sources = useMemo(
    () => Array.from(new Set(availableEvents.map((e) => e.source).filter(Boolean))) as string[],
    [availableEvents],
  );

  const toggleArrayItem = <T extends string>(array: T[], item: T): T[] => {
    return array.includes(item) ? array.filter((i) => i !== item) : [...array, item];
  };

  const hasActiveFilters =
    filters.query !== "" ||
    filters.categories.length > 0 ||
    filters.responsibleIds.length > 0 ||
    filters.sources.length > 0 ||
    filters.statuses.length > 0;

  return (
    <div className="flex flex-col gap-3 p-3 bg-card border-b shadow-sm z-10">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="pl-9 h-9"
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
          />
        </div>

        {/* Basic native selects for demonstration, can be upgraded to Combobox later */}
        <select
          className="h-9 px-3 rounded-md border bg-transparent text-sm"
          value=""
          onChange={(e) => {
            if (e.target.value)
              onChange({ categories: toggleArrayItem(filters.categories, e.target.value) });
          }}
        >
          <option value="" disabled>
            Categoria
          </option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="h-9 px-3 rounded-md border bg-transparent text-sm"
          value=""
          onChange={(e) => {
            if (e.target.value)
              onChange({ responsibleIds: toggleArrayItem(filters.responsibleIds, e.target.value) });
          }}
        >
          <option value="" disabled>
            Responsável
          </option>
          {responsibles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select
          className="h-9 px-3 rounded-md border bg-transparent text-sm"
          value=""
          onChange={(e) => {
            if (e.target.value)
              onChange({
                statuses: toggleArrayItem(filters.statuses, e.target.value as AgendaEventStatus),
              });
          }}
        >
          <option value="" disabled>
            Status
          </option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {EVENT_STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </select>

        <select
          className="h-9 px-3 rounded-md border bg-transparent text-sm"
          value=""
          onChange={(e) => {
            if (e.target.value)
              onChange({
                sources: toggleArrayItem(filters.sources, e.target.value as AgendaEventSource),
              });
          }}
        >
          <option value="" disabled>
            Origem
          </option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {EVENT_ORIGIN_LABEL[s] ?? s}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-9 text-muted-foreground">
            <FilterX className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        )}
      </div>

      {/* Active Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {filters.categories.map((c) => (
            <Badge
              key={`cat-${c}`}
              variant="secondary"
              className="flex items-center gap-1 font-normal"
            >
              {c}{" "}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onChange({ categories: toggleArrayItem(filters.categories, c) })}
              />
            </Badge>
          ))}
          {filters.responsibleIds.map((r) => (
            <Badge
              key={`resp-${r}`}
              variant="secondary"
              className="flex items-center gap-1 font-normal"
            >
              {r}{" "}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  onChange({ responsibleIds: toggleArrayItem(filters.responsibleIds, r) })
                }
              />
            </Badge>
          ))}
          {filters.statuses.map((s) => (
            <Badge
              key={`stat-${s}`}
              variant="secondary"
              className="flex items-center gap-1 font-normal"
            >
              {EVENT_STATUS_LABEL[s] ?? s}{" "}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onChange({ statuses: toggleArrayItem(filters.statuses, s) })}
              />
            </Badge>
          ))}
          {filters.sources.map((s) => (
            <Badge
              key={`src-${s}`}
              variant="secondary"
              className="flex items-center gap-1 font-normal"
            >
              {EVENT_ORIGIN_LABEL[s] ?? s}{" "}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onChange({ sources: toggleArrayItem(filters.sources, s) })}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
