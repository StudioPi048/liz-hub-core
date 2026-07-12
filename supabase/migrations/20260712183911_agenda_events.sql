CREATE TABLE public.agenda_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source TEXT NOT NULL DEFAULT 'agenda'
    CHECK (
      source IN (
        'agenda', 'google', 'course', 'event', 'appointment', 'project'
      )
    ),

  source_record_id TEXT,
  external_calendar_id TEXT,
  external_event_id TEXT,

  title TEXT NOT NULL,
  description TEXT,
  notes TEXT,

  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',

  category_slug TEXT,
  responsible_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (
      status IN (
        'draft', 'pending', 'confirmed', 'completed', 'cancelled', 'rescheduled'
      )
    ),

  modality TEXT CHECK (modality IN ('online', 'in_person', 'hybrid')),

  location TEXT,
  city TEXT,
  country TEXT,
  meeting_url TEXT,

  visibility TEXT NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('private', 'restricted', 'internal', 'public')),

  color_key TEXT,
  is_blocking BOOLEAN NOT NULL DEFAULT true,

  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule TEXT,
  recurrence_timezone TEXT,
  recurrence_parent_id UUID REFERENCES public.agenda_events(id) ON DELETE CASCADE,

  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancellation_reason TEXT,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Restrições Temporais e Recorrência
  CHECK (ends_at > starts_at),
  CHECK (is_recurring = true OR recurrence_rule IS NULL),
  CHECK (
    all_day = false 
    OR (
      date_trunc('day', starts_at AT TIME ZONE timezone) = (starts_at AT TIME ZONE timezone) AND
      date_trunc('day', ends_at AT TIME ZONE timezone) = (ends_at AT TIME ZONE timezone)
    )
  )
);

CREATE TABLE public.agenda_event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,

  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_id UUID NULL,
  display_name TEXT,
  email TEXT,

  role TEXT NOT NULL DEFAULT 'attendee'
    CHECK (role IN ('organizer', 'responsible', 'attendee', 'speaker', 'student')),

  response_status TEXT
    CHECK (response_status IN ('needs_action', 'accepted', 'declined', 'tentative')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX agenda_events_source_record_unique
  ON public.agenda_events (source, source_record_id) WHERE source_record_id IS NOT NULL;

CREATE UNIQUE INDEX agenda_events_google_unique
  ON public.agenda_events (external_calendar_id, external_event_id)
  WHERE source = 'google' AND external_calendar_id IS NOT NULL AND external_event_id IS NOT NULL;

CREATE INDEX idx_agenda_events_starts_at ON public.agenda_events (starts_at);
CREATE INDEX idx_agenda_events_interval ON public.agenda_events (starts_at, ends_at);
CREATE INDEX idx_agenda_events_responsible ON public.agenda_events (responsible_id, starts_at);
CREATE INDEX idx_agenda_events_status ON public.agenda_events (status, starts_at);
CREATE INDEX idx_agenda_events_category ON public.agenda_events (category_slug, starts_at);
CREATE INDEX idx_agenda_events_source ON public.agenda_events (source, starts_at);

-- Triggers for updated_at
CREATE TRIGGER agenda_events_updated_at BEFORE UPDATE ON public.agenda_events FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_event_participants ENABLE ROW LEVEL SECURITY;

-- EVENT POLICIES
CREATE POLICY "events_select" ON public.agenda_events FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    visibility = 'public' OR 
    visibility = 'internal' OR
    (visibility = 'restricted' AND (owner_id = auth.uid() OR responsible_id = auth.uid() OR EXISTS (SELECT 1 FROM public.agenda_event_participants WHERE event_id = id AND user_id = auth.uid()) OR public.can_edit(auth.uid()))) OR
    (visibility = 'private' AND (owner_id = auth.uid() OR responsible_id = auth.uid() OR EXISTS (SELECT 1 FROM public.agenda_event_participants WHERE event_id = id AND user_id = auth.uid())))
  )
);

CREATE POLICY "events_insert" ON public.agenda_events FOR INSERT TO authenticated
WITH CHECK (public.can_edit(auth.uid()) OR owner_id = auth.uid());

CREATE POLICY "events_update" ON public.agenda_events FOR UPDATE TO authenticated
USING (public.can_edit(auth.uid()) OR owner_id = auth.uid() OR responsible_id = auth.uid())
WITH CHECK (public.can_edit(auth.uid()) OR owner_id = auth.uid() OR responsible_id = auth.uid());

CREATE POLICY "events_delete" ON public.agenda_events FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- PARTICIPANTS POLICIES
CREATE POLICY "participants_select" ON public.agenda_event_participants FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agenda_events e
    WHERE e.id = event_id AND e.deleted_at IS NULL AND (
      e.visibility = 'public' OR 
      e.visibility = 'internal' OR
      (e.visibility = 'restricted' AND (e.owner_id = auth.uid() OR e.responsible_id = auth.uid() OR EXISTS (SELECT 1 FROM public.agenda_event_participants p2 WHERE p2.event_id = e.id AND p2.user_id = auth.uid()) OR public.can_edit(auth.uid()))) OR
      (e.visibility = 'private' AND (e.owner_id = auth.uid() OR e.responsible_id = auth.uid() OR EXISTS (SELECT 1 FROM public.agenda_event_participants p2 WHERE p2.event_id = e.id AND p2.user_id = auth.uid())))
    )
  )
);

CREATE POLICY "participants_insert" ON public.agenda_event_participants FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agenda_events e
    WHERE e.id = event_id AND (public.can_edit(auth.uid()) OR e.owner_id = auth.uid() OR e.responsible_id = auth.uid())
  )
);

CREATE POLICY "participants_update" ON public.agenda_event_participants FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agenda_events e
    WHERE e.id = event_id AND (public.can_edit(auth.uid()) OR e.owner_id = auth.uid() OR e.responsible_id = auth.uid())
  ) OR user_id = auth.uid() -- participant can update their own response
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agenda_events e
    WHERE e.id = event_id AND (public.can_edit(auth.uid()) OR e.owner_id = auth.uid() OR e.responsible_id = auth.uid())
  ) OR user_id = auth.uid()
);

CREATE POLICY "participants_delete" ON public.agenda_event_participants FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agenda_events e
    WHERE e.id = event_id AND (public.can_edit(auth.uid()) OR e.owner_id = auth.uid() OR e.responsible_id = auth.uid())
  ) OR user_id = auth.uid() -- participant can remove themselves
);
