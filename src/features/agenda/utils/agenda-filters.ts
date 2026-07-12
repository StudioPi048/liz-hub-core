import { AgendaEvent } from "../model/agenda-event";
import { AgendaFilters } from "../model/agenda-filters";

/**
 * Filtra eventos baseando-se nas regras:
 * - OR dentro do mesmo array
 * - AND entre os arrays de critérios
 */
export function filterAgendaEvents(events: AgendaEvent[], filters: AgendaFilters): AgendaEvent[] {
  return events.filter((ev) => {
    // Busca Textual
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const matchQuery =
        ev.title?.toLowerCase().includes(q) ||
        ev.description?.toLowerCase().includes(q) ||
        ev.location?.toLowerCase().includes(q) ||
        ev.responsibleName?.toLowerCase().includes(q);

      if (!matchQuery) return false;
    }

    // Categorias
    if (filters.categories.length > 0) {
      if (!ev.categorySlug || !filters.categories.includes(ev.categorySlug)) {
        return false;
      }
    }

    // Responsáveis
    if (filters.responsibleIds.length > 0) {
      if (!ev.responsibleId || !filters.responsibleIds.includes(ev.responsibleId)) {
        return false;
      }
    }

    // Origem
    if (filters.sources.length > 0) {
      if (!filters.sources.includes(ev.source)) {
        return false;
      }
    }

    // Status
    if (filters.statuses.length > 0) {
      if (!ev.status || !filters.statuses.includes(ev.status)) {
        return false;
      }
    }

    // Modalidade
    if (filters.modalities.length > 0) {
      if (!ev.modality || !filters.modalities.includes(ev.modality)) {
        return false;
      }
    }

    // Cidades
    if (filters.cities.length > 0) {
      if (!ev.city || !filters.cities.includes(ev.city)) {
        return false;
      }
    }

    // Países
    if (filters.countries.length > 0) {
      if (!ev.country || !filters.countries.includes(ev.country)) {
        return false;
      }
    }

    // Calendários (External / Google)
    if (filters.calendarIds.length > 0) {
      if (!ev.calendarId || !filters.calendarIds.includes(ev.calendarId)) {
        return false;
      }
    }

    return true;
  });
}
