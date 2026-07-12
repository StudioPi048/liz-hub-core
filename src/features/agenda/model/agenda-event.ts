export type AgendaEventSource =
  "agenda" | "google" | "course" | "event" | "appointment" | "project";

export type AgendaEventStatus =
  "draft" | "pending" | "confirmed" | "completed" | "cancelled" | "rescheduled";

export type AgendaEventVisibility = "private" | "restricted" | "internal" | "public";

export type AgendaConflictWarning = {
  type: "overlap" | "duplicate" | "same_responsible";
  severity: "high" | "medium";
  message: string;
};

export type AgendaEvent = {
  id: string;
  source: AgendaEventSource;
  sourceRecordId?: string | null;
  externalId?: string | null;

  title: string;
  description?: string | null;
  notes?: string | null;

  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timezone: string;

  categorySlug?: string | null;
  responsibleId?: string | null;
  responsibleName?: string | null;
  ownerId?: string | null;

  status: AgendaEventStatus;
  modality?: "online" | "in_person" | "hybrid" | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  meetingUrl?: string | null;

  calendarId?: string | null;
  calendarName?: string | null;

  isEditable: boolean;
  isExternal: boolean;
  visibility: AgendaEventVisibility;
  isBlocking: boolean;

  isRecurring: boolean;
  recurrenceRule?: string | null;

  colorKey?: string | null;

  conflictWarnings?: AgendaConflictWarning[];
};
