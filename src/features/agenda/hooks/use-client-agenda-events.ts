import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgendaEventsForClient } from "../api/agenda-events.functions";

export function useClientAgendaEvents(clientId: string) {
  const fn = useServerFn(getAgendaEventsForClient);
  return useQuery({
    queryKey: ["events", "by-client", clientId],
    queryFn: () => fn({ data: { clientId } }),
    enabled: Boolean(clientId),
  });
}
