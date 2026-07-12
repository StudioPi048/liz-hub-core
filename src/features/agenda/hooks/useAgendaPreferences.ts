import { useState, useEffect } from "react";
import { AgendaFilters, defaultAgendaFilters } from "../model/agenda-filters";

type ViewMode = "today" | "tomorrow" | "week" | "month" | "quarter" | "30d" | "90d" | "timeline";

type AgendaPreferences = {
  view: ViewMode;
  focusDate: string; // ISO string representing the central date being viewed
  filters: AgendaFilters;
  visibleCalendars: string[];
  isSidebarOpen: boolean;
  density: "compact" | "comfortable";
};

const STORAGE_KEY = "liz_agenda_prefs_v1";

const defaultPreferences: AgendaPreferences = {
  view: "today",
  focusDate: new Date().toISOString(),
  filters: defaultAgendaFilters,
  visibleCalendars: [],
  isSidebarOpen: true,
  density: "comfortable",
};

export function useAgendaPreferences() {
  const [prefs, setPrefs] = useState<AgendaPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Fallback merge to ensure all keys exist
        return {
          ...defaultPreferences,
          ...parsed,
          filters: { ...defaultPreferences.filters, ...parsed.filters },
        };
      }
    } catch (e) {
      console.warn("Failed to parse agenda preferences", e);
    }
    return defaultPreferences;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.warn("Failed to save agenda preferences", e);
    }
  }, [prefs]);

  const restoreDefaults = () => setPrefs(defaultPreferences);

  const updatePrefs = (updates: Partial<AgendaPreferences>) => {
    setPrefs((prev) => ({ ...prev, ...updates }));
  };

  const updateFilters = (filterUpdates: Partial<AgendaFilters>) => {
    setPrefs((prev) => ({
      ...prev,
      filters: { ...prev.filters, ...filterUpdates },
    }));
  };

  return {
    prefs,
    updatePrefs,
    updateFilters,
    restoreDefaults,
  };
}
