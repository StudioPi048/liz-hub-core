import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createAgendaEvent,
  updateAgendaEvent,
  cancelAgendaEvent,
} from "../api/agenda-events.functions";

type AgendaEventStatus =
  "draft" | "pending" | "confirmed" | "completed" | "cancelled" | "rescheduled";
type AgendaEventModality = "online" | "in_person" | "hybrid";

export type AgendaEventFormInput = {
  title: string;
  description?: string | null;
  notes?: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  status: AgendaEventStatus;
  modality?: AgendaEventModality | null;
  location?: string | null;
  meetingUrl?: string | null;
  city?: string | null;
  country?: string | null;
  clientId?: string | null;
};

// Ambas as telas que consomem a agenda local (Agenda e Dashboard) usam chaves
// de query que começam com "events" / "dashboard-events" — invalidamos pelo
// prefixo para que as duas fiquem sempre consistentes após qualquer mutação.
function invalidateAgendaQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "events" });
  qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "dashboard-events" });
}

export function useCreateAgendaEvent() {
  const qc = useQueryClient();
  const fn = useServerFn(createAgendaEvent);
  return useMutation({
    mutationFn: (data: AgendaEventFormInput) => fn({ data }),
    onSuccess: () => invalidateAgendaQueries(qc),
  });
}

export function useUpdateAgendaEvent() {
  const qc = useQueryClient();
  const fn = useServerFn(updateAgendaEvent);
  return useMutation({
    mutationFn: (data: AgendaEventFormInput & { id: string }) => fn({ data }),
    onSuccess: () => invalidateAgendaQueries(qc),
  });
}

export function useCancelAgendaEvent() {
  const qc = useQueryClient();
  const fn = useServerFn(cancelAgendaEvent);
  return useMutation({
    mutationFn: (data: { id: string; reason?: string | null }) => fn({ data }),
    onSuccess: () => invalidateAgendaQueries(qc),
  });
}
