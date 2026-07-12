import { AgendaEventSource, AgendaEventStatus } from "./agenda-event";

export type AgendaFilters = {
  query: string;
  categories: string[];
  responsibleIds: string[];
  sources: AgendaEventSource[];
  statuses: AgendaEventStatus[];
  modalities: string[];
  cities: string[];
  countries: string[];
  calendarIds: string[];
};

export const defaultAgendaFilters: AgendaFilters = {
  query: "",
  categories: [],
  responsibleIds: [],
  sources: [],
  statuses: [],
  modalities: [],
  cities: [],
  countries: [],
  calendarIds: [],
};
