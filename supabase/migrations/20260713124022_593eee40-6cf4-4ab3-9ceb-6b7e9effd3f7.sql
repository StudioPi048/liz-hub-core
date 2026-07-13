
CREATE OR REPLACE FUNCTION public.has_knowledge_admin_role()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','editor')) INTO ok;
  RETURN ok;
END; $$;

CREATE TABLE public.knowledge_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('institutional','methodological','educational','bibliographic','commercial','operational','technical','legal','clinical_reference','event','product','person','author','course','book','faq','prompt','page')),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  summary TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','archived')),
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('public','internal','restricted','private')),
  authority_level TEXT NOT NULL DEFAULT 'unverified' CHECK (authority_level IN ('official','validated','reference','working_material','unverified','deprecated')),
  source_type TEXT NOT NULL,
  source_uri TEXT,
  source_id TEXT NOT NULL,
  source_title TEXT,
  author_name TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  language TEXT NOT NULL DEFAULT 'pt-BR',
  metadata JSONB NOT NULL DEFAULT '{}',
  content_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  UNIQUE (source_type, source_id),
  CONSTRAINT check_status_authority CHECK ((authority_level = 'official' AND status = 'approved') OR (authority_level <> 'official'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_nodes TO authenticated;
GRANT ALL ON public.knowledge_nodes TO service_role;
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.knowledge_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('belongs_to','part_of','authored_by','created_by','mentions','references','explains','applies_to','related_to','prerequisite_of','offered_by','used_in','contradicts','supersedes','version_of')),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected')),
  confidence NUMERIC(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  UNIQUE (source_id, target_id, relation_type),
  CHECK (source_id <> target_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_edges TO authenticated;
GRANT ALL ON public.knowledge_edges TO service_role;
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.knowledge_node_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL,
  authority_level TEXT NOT NULL,
  visibility TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  content_hash TEXT NOT NULL,
  source_uri TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (node_id, version)
);
GRANT SELECT, INSERT ON public.knowledge_node_versions TO authenticated;
GRANT ALL ON public.knowledge_node_versions TO service_role;
ALTER TABLE public.knowledge_node_versions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_knowledge_nodes_updated_at BEFORE UPDATE ON public.knowledge_nodes
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_status_transitions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    IF NOT public.has_knowledge_admin_role() THEN RAISE EXCEPTION 'Only admins or editors can approve knowledge nodes'; END IF;
    NEW.approved_by = auth.uid(); NEW.approved_at = now();
  END IF;
  IF NEW.status = 'archived' AND OLD.status <> 'archived' THEN
    IF NOT public.has_knowledge_admin_role() THEN RAISE EXCEPTION 'Only admins or editors can archive knowledge nodes'; END IF;
    NEW.archived_at = now();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER enforce_knowledge_status_transition BEFORE UPDATE ON public.knowledge_nodes
FOR EACH ROW EXECUTE FUNCTION public.enforce_status_transitions();

CREATE OR REPLACE FUNCTION public.version_knowledge_node()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.content_hash <> OLD.content_hash OR NEW.version > OLD.version THEN
    INSERT INTO public.knowledge_node_versions (node_id, version, title, summary, status, authority_level, visibility, content, metadata, content_hash, source_uri, changed_by, change_reason)
    VALUES (OLD.id, OLD.version, OLD.title, OLD.summary, OLD.status, OLD.authority_level, OLD.visibility, OLD.content, OLD.metadata, OLD.content_hash, OLD.source_uri, auth.uid(), 'Auto-versioned due to update');
    IF NEW.version <= OLD.version THEN NEW.version = OLD.version + 1; END IF;
    IF OLD.status = 'approved' AND NEW.content_hash <> OLD.content_hash THEN
      NEW.status = 'draft'; NEW.authority_level = 'unverified'; NEW.approved_by = NULL; NEW.approved_at = NULL;
    END IF;
  END IF;
  NEW.updated_by = auth.uid();
  RETURN NEW;
END; $$;
CREATE TRIGGER trigger_version_knowledge_node BEFORE UPDATE ON public.knowledge_nodes
FOR EACH ROW EXECUTE FUNCTION public.version_knowledge_node();

CREATE INDEX idx_knowledge_nodes_status ON public.knowledge_nodes(status);
CREATE INDEX idx_knowledge_nodes_type ON public.knowledge_nodes(type);
CREATE INDEX idx_knowledge_nodes_authority ON public.knowledge_nodes(authority_level);
CREATE INDEX idx_knowledge_nodes_slug ON public.knowledge_nodes(slug);

CREATE POLICY "kn_select" ON public.knowledge_nodes FOR SELECT TO authenticated USING (public.has_knowledge_admin_role());
CREATE POLICY "kn_insert" ON public.knowledge_nodes FOR INSERT TO authenticated WITH CHECK (public.has_knowledge_admin_role());
CREATE POLICY "kn_update" ON public.knowledge_nodes FOR UPDATE TO authenticated USING (public.has_knowledge_admin_role()) WITH CHECK (public.has_knowledge_admin_role());
CREATE POLICY "kn_delete" ON public.knowledge_nodes FOR DELETE TO authenticated USING (public.has_knowledge_admin_role());
CREATE POLICY "ke_select" ON public.knowledge_edges FOR SELECT TO authenticated USING (public.has_knowledge_admin_role());
CREATE POLICY "ke_insert" ON public.knowledge_edges FOR INSERT TO authenticated WITH CHECK (public.has_knowledge_admin_role());
CREATE POLICY "ke_update" ON public.knowledge_edges FOR UPDATE TO authenticated USING (public.has_knowledge_admin_role()) WITH CHECK (public.has_knowledge_admin_role());
CREATE POLICY "ke_delete" ON public.knowledge_edges FOR DELETE TO authenticated USING (public.has_knowledge_admin_role());
CREATE POLICY "kv_select" ON public.knowledge_node_versions FOR SELECT TO authenticated USING (public.has_knowledge_admin_role());
CREATE POLICY "kv_insert" ON public.knowledge_node_versions FOR INSERT TO authenticated WITH CHECK (public.has_knowledge_admin_role());

-- ASSETS
CREATE TABLE public.knowledge_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_node_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE RESTRICT,
  stable_id TEXT NOT NULL CHECK (btrim(stable_id) <> ''),
  asset_type TEXT NOT NULL CHECK (asset_type IN ('document','image','video','audio','archive','link','dataset','other')),
  asset_category TEXT NOT NULL CHECK (btrim(asset_category) <> ''),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  description TEXT,
  alt_text TEXT,
  storage_provider TEXT NOT NULL CHECK (storage_provider IN ('supabase','google_drive','hotmart','youtube','vimeo','external_url','repository')),
  storage_bucket TEXT,
  storage_path TEXT,
  external_url TEXT,
  original_filename TEXT,
  mime_type TEXT,
  file_extension TEXT,
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  content_hash TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','archived','unavailable')),
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('public','internal','restricted','private')),
  rights_status TEXT NOT NULL DEFAULT 'unknown' CHECK (rights_status IN ('owned','licensed','authorized','public_domain','external_reference','unknown','restricted')),
  rights_holder TEXT,
  usage_notes TEXT,
  license_reference TEXT,
  language TEXT DEFAULT 'pt-BR',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  source_type TEXT NOT NULL CHECK (btrim(source_type) <> ''),
  source_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  UNIQUE (knowledge_node_id, stable_id),
  CHECK (
    (storage_provider = 'supabase' AND storage_bucket IS NOT NULL AND storage_path IS NOT NULL AND external_url IS NULL)
    OR (storage_provider = 'repository' AND source_reference IS NOT NULL AND external_url IS NULL)
    OR (storage_provider NOT IN ('supabase','repository') AND external_url IS NOT NULL AND storage_bucket IS NULL AND storage_path IS NULL)
  ),
  CHECK (NOT (rights_status = 'unknown' AND visibility = 'public')),
  CHECK (NOT (rights_status = 'restricted' AND visibility NOT IN ('restricted','private')))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_assets TO authenticated;
GRANT ALL ON public.knowledge_assets TO service_role;
ALTER TABLE public.knowledge_assets ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX knowledge_assets_one_primary_per_category ON public.knowledge_assets (knowledge_node_id, asset_category) WHERE is_primary = true AND archived_at IS NULL;

CREATE TABLE public.knowledge_asset_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_asset_id UUID NOT NULL REFERENCES public.knowledge_assets(id) ON DELETE CASCADE,
  knowledge_node_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  stable_id TEXT NOT NULL,
  proposed_name TEXT NOT NULL,
  proposed_description TEXT,
  proposed_alt_text TEXT,
  proposed_asset_type TEXT NOT NULL,
  proposed_asset_category TEXT NOT NULL,
  proposed_storage_provider TEXT NOT NULL,
  proposed_storage_bucket TEXT,
  proposed_storage_path TEXT,
  proposed_external_url TEXT,
  proposed_original_filename TEXT,
  proposed_mime_type TEXT,
  proposed_file_extension TEXT,
  proposed_size_bytes BIGINT,
  proposed_content_hash TEXT,
  proposed_visibility TEXT NOT NULL,
  proposed_rights_status TEXT NOT NULL,
  proposed_rights_holder TEXT,
  proposed_usage_notes TEXT,
  proposed_license_reference TEXT,
  proposed_metadata JSONB NOT NULL DEFAULT '{}',
  previous_content_hash TEXT,
  proposed_manifest_hash TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'repository_manifest_changed',
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','in_review','approved','rejected','superseded')),
  source_reference TEXT,
  indexation_run_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE (knowledge_asset_id, proposed_manifest_hash)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_asset_revisions TO authenticated;
GRANT ALL ON public.knowledge_asset_revisions TO service_role;
ALTER TABLE public.knowledge_asset_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_select" ON public.knowledge_assets FOR SELECT TO authenticated USING (public.has_knowledge_admin_role());
CREATE POLICY "assets_insert" ON public.knowledge_assets FOR INSERT TO authenticated WITH CHECK (public.has_knowledge_admin_role());
CREATE POLICY "assets_update" ON public.knowledge_assets FOR UPDATE TO authenticated USING (public.has_knowledge_admin_role()) WITH CHECK (public.has_knowledge_admin_role());
CREATE POLICY "assets_delete" ON public.knowledge_assets FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "asset_rev_select" ON public.knowledge_asset_revisions FOR SELECT TO authenticated USING (public.has_knowledge_admin_role());
CREATE POLICY "asset_rev_insert" ON public.knowledge_asset_revisions FOR INSERT TO authenticated WITH CHECK (public.has_knowledge_admin_role());
CREATE POLICY "asset_rev_update" ON public.knowledge_asset_revisions FOR UPDATE TO authenticated USING (public.has_knowledge_admin_role()) WITH CHECK (public.has_knowledge_admin_role());

-- EDITORIAL DRAFTS
CREATE TABLE public.editorial_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_node_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  proposed_title TEXT,
  proposed_summary TEXT,
  proposed_content TEXT NOT NULL,
  proposed_metadata JSONB NOT NULL DEFAULT '{}',
  previous_content_hash TEXT NOT NULL,
  proposed_content_hash TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'repository_source_changed',
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','in_review','approved','rejected','superseded')),
  source_uri TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  UNIQUE (knowledge_node_id, proposed_content_hash)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.editorial_drafts TO authenticated;
GRANT ALL ON public.editorial_drafts TO service_role;
ALTER TABLE public.editorial_drafts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_editorial_drafts_updated_at BEFORE UPDATE ON public.editorial_drafts
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_editorial_drafts_node_id ON public.editorial_drafts(knowledge_node_id);
CREATE INDEX idx_editorial_drafts_status ON public.editorial_drafts(status);
CREATE POLICY "drafts_select" ON public.editorial_drafts FOR SELECT TO authenticated USING (public.has_knowledge_admin_role());
CREATE POLICY "drafts_insert" ON public.editorial_drafts FOR INSERT TO authenticated WITH CHECK (public.has_knowledge_admin_role());
CREATE POLICY "drafts_update" ON public.editorial_drafts FOR UPDATE TO authenticated USING (public.has_knowledge_admin_role()) WITH CHECK (public.has_knowledge_admin_role());
CREATE POLICY "drafts_delete" ON public.editorial_drafts FOR DELETE TO authenticated USING (public.has_knowledge_admin_role());

-- AGENDA
CREATE TABLE public.agenda_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'agenda' CHECK (source IN ('agenda','google','course','event','appointment','project')),
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
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('draft','pending','confirmed','completed','cancelled','rescheduled')),
  modality TEXT CHECK (modality IN ('online','in_person','hybrid')),
  location TEXT,
  city TEXT,
  country TEXT,
  meeting_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('private','restricted','internal','public')),
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
  CHECK (ends_at > starts_at),
  CHECK (is_recurring = true OR recurrence_rule IS NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_events TO authenticated;
GRANT ALL ON public.agenda_events TO service_role;
ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.agenda_event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_id UUID NULL,
  display_name TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'attendee' CHECK (role IN ('organizer','responsible','attendee','speaker','student')),
  response_status TEXT CHECK (response_status IN ('needs_action','accepted','declined','tentative')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_event_participants TO authenticated;
GRANT ALL ON public.agenda_event_participants TO service_role;
ALTER TABLE public.agenda_event_participants ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX agenda_events_source_record_unique ON public.agenda_events (source, source_record_id) WHERE source_record_id IS NOT NULL;
CREATE UNIQUE INDEX agenda_events_google_unique ON public.agenda_events (external_calendar_id, external_event_id) WHERE source = 'google' AND external_calendar_id IS NOT NULL AND external_event_id IS NOT NULL;
CREATE INDEX idx_agenda_events_starts_at ON public.agenda_events (starts_at);
CREATE INDEX idx_agenda_events_interval ON public.agenda_events (starts_at, ends_at);
CREATE INDEX idx_agenda_events_responsible ON public.agenda_events (responsible_id, starts_at);
CREATE INDEX idx_agenda_events_status ON public.agenda_events (status, starts_at);
CREATE INDEX idx_agenda_events_category ON public.agenda_events (category_slug, starts_at);
CREATE INDEX idx_agenda_events_source ON public.agenda_events (source, starts_at);

CREATE TRIGGER agenda_events_updated_at BEFORE UPDATE ON public.agenda_events
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "events_select" ON public.agenda_events FOR SELECT TO authenticated
USING (deleted_at IS NULL AND (
  visibility = 'public' OR visibility = 'internal' OR
  (visibility = 'restricted' AND (owner_id = auth.uid() OR responsible_id = auth.uid() OR EXISTS (SELECT 1 FROM public.agenda_event_participants WHERE event_id = id AND user_id = auth.uid()) OR public.can_edit(auth.uid()))) OR
  (visibility = 'private' AND (owner_id = auth.uid() OR responsible_id = auth.uid() OR EXISTS (SELECT 1 FROM public.agenda_event_participants WHERE event_id = id AND user_id = auth.uid())))
));
CREATE POLICY "events_insert" ON public.agenda_events FOR INSERT TO authenticated
WITH CHECK (public.can_edit(auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "events_update" ON public.agenda_events FOR UPDATE TO authenticated
USING (public.can_edit(auth.uid()) OR owner_id = auth.uid() OR responsible_id = auth.uid())
WITH CHECK (public.can_edit(auth.uid()) OR owner_id = auth.uid() OR responsible_id = auth.uid());
CREATE POLICY "events_delete" ON public.agenda_events FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "participants_select" ON public.agenda_event_participants FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.agenda_events e WHERE e.id = event_id AND e.deleted_at IS NULL AND (
  e.visibility = 'public' OR e.visibility = 'internal' OR
  (e.visibility = 'restricted' AND (e.owner_id = auth.uid() OR e.responsible_id = auth.uid() OR EXISTS (SELECT 1 FROM public.agenda_event_participants p2 WHERE p2.event_id = e.id AND p2.user_id = auth.uid()) OR public.can_edit(auth.uid()))) OR
  (e.visibility = 'private' AND (e.owner_id = auth.uid() OR e.responsible_id = auth.uid() OR EXISTS (SELECT 1 FROM public.agenda_event_participants p2 WHERE p2.event_id = e.id AND p2.user_id = auth.uid())))
)));
CREATE POLICY "participants_insert" ON public.agenda_event_participants FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.agenda_events e WHERE e.id = event_id AND (public.can_edit(auth.uid()) OR e.owner_id = auth.uid() OR e.responsible_id = auth.uid())));
CREATE POLICY "participants_update" ON public.agenda_event_participants FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.agenda_events e WHERE e.id = event_id AND (public.can_edit(auth.uid()) OR e.owner_id = auth.uid() OR e.responsible_id = auth.uid())) OR user_id = auth.uid())
WITH CHECK (EXISTS (SELECT 1 FROM public.agenda_events e WHERE e.id = event_id AND (public.can_edit(auth.uid()) OR e.owner_id = auth.uid() OR e.responsible_id = auth.uid())) OR user_id = auth.uid());
CREATE POLICY "participants_delete" ON public.agenda_event_participants FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.agenda_events e WHERE e.id = event_id AND (public.can_edit(auth.uid()) OR e.owner_id = auth.uid() OR e.responsible_id = auth.uid())) OR user_id = auth.uid());

-- Admin role for studiopi048@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'studiopi048@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
