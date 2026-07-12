-- Security Definer function to safely check roles without taking user_id from client
CREATE OR REPLACE FUNCTION has_knowledge_admin_role()
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_or_editor BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'editor')
  ) INTO is_admin_or_editor;
  RETURN is_admin_or_editor;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE knowledge_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  type TEXT NOT NULL CHECK (type IN ('institutional', 'methodological', 'educational', 'bibliographic', 'commercial', 'operational', 'technical', 'legal', 'clinical_reference', 'event', 'product', 'person', 'author', 'course', 'book', 'faq', 'prompt', 'page')),
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  summary TEXT,
  content TEXT NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'archived')),
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('public', 'internal', 'restricted', 'private')),
  authority_level TEXT NOT NULL DEFAULT 'unverified' CHECK (authority_level IN ('official', 'validated', 'reference', 'working_material', 'unverified', 'deprecated')),
  
  source_type TEXT NOT NULL,
  source_uri TEXT,
  source_id TEXT NOT NULL,
  source_title TEXT,
  author_name TEXT,
  
  reviewed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  language TEXT NOT NULL DEFAULT 'pt-BR',
  metadata JSONB NOT NULL DEFAULT '{}',
  content_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,

  UNIQUE (source_type, source_id)
);

ALTER TABLE knowledge_nodes ADD CONSTRAINT check_status_authority 
  CHECK (
    (authority_level = 'official' AND status = 'approved') OR
    (authority_level != 'official')
  );

CREATE TABLE knowledge_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  
  relation_type TEXT NOT NULL CHECK (relation_type IN ('belongs_to', 'part_of', 'authored_by', 'created_by', 'mentions', 'references', 'explains', 'applies_to', 'related_to', 'prerequisite_of', 'offered_by', 'used_in', 'contradicts', 'supersedes', 'version_of')),
  
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected')),
  confidence NUMERIC(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  
  UNIQUE (source_id, target_id, relation_type),
  CHECK (source_id <> target_id)
);

CREATE TABLE knowledge_node_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
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
  
  changed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (node_id, version)
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_knowledge_nodes_updated_at
BEFORE UPDATE ON knowledge_nodes
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Trigger for Status Transitions and Approvals
CREATE OR REPLACE FUNCTION enforce_status_transitions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    IF NOT has_knowledge_admin_role() THEN
      RAISE EXCEPTION 'Only admins or editors can approve knowledge nodes';
    END IF;
    NEW.approved_by = auth.uid();
    NEW.approved_at = NOW();
  END IF;

  IF NEW.status = 'archived' AND OLD.status != 'archived' THEN
    IF NOT has_knowledge_admin_role() THEN
      RAISE EXCEPTION 'Only admins or editors can archive knowledge nodes';
    END IF;
    NEW.archived_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_knowledge_status_transition
BEFORE UPDATE ON knowledge_nodes
FOR EACH ROW EXECUTE PROCEDURE enforce_status_transitions();

-- Trigger for Versioning
CREATE OR REPLACE FUNCTION version_knowledge_node()
RETURNS TRIGGER AS $$
BEGIN
  -- If hash changed or explicit new version triggered
  IF NEW.content_hash != OLD.content_hash OR NEW.version > OLD.version THEN
    -- Save old version
    INSERT INTO knowledge_node_versions (
      node_id, version, title, summary, status, authority_level, 
      visibility, content, metadata, content_hash, source_uri, 
      changed_by, change_reason
    ) VALUES (
      OLD.id, OLD.version, OLD.title, OLD.summary, OLD.status, OLD.authority_level,
      OLD.visibility, OLD.content, OLD.metadata, OLD.content_hash, OLD.source_uri,
      auth.uid(), 'Auto-versioned due to update'
    );
    -- Bump version for the new state if not already bumped
    IF NEW.version <= OLD.version THEN
      NEW.version = OLD.version + 1;
    END IF;
    
    -- If it was approved, revert to draft/in_review on content change
    IF OLD.status = 'approved' AND NEW.content_hash != OLD.content_hash THEN
      NEW.status = 'draft';
      NEW.authority_level = 'unverified';
      NEW.approved_by = NULL;
      NEW.approved_at = NULL;
    END IF;
  END IF;
  
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_version_knowledge_node
BEFORE UPDATE ON knowledge_nodes
FOR EACH ROW EXECUTE PROCEDURE version_knowledge_node();

-- Indices for queries
CREATE INDEX idx_knowledge_nodes_status ON knowledge_nodes(status);
CREATE INDEX idx_knowledge_nodes_type ON knowledge_nodes(type);
CREATE INDEX idx_knowledge_nodes_authority ON knowledge_nodes(authority_level);
CREATE INDEX idx_knowledge_nodes_slug ON knowledge_nodes(slug);

-- RLS
ALTER TABLE knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_node_versions ENABLE ROW LEVEL SECURITY;

-- Read policies restricted
CREATE POLICY "Admins and editors can read all nodes" ON knowledge_nodes
  FOR SELECT USING (has_knowledge_admin_role());

CREATE POLICY "Admins and editors can insert nodes" ON knowledge_nodes
  FOR INSERT WITH CHECK (has_knowledge_admin_role());

CREATE POLICY "Admins and editors can update nodes" ON knowledge_nodes
  FOR UPDATE USING (has_knowledge_admin_role())
  WITH CHECK (has_knowledge_admin_role());

CREATE POLICY "Admins and editors can delete nodes" ON knowledge_nodes
  FOR DELETE USING (has_knowledge_admin_role());

-- Edges
CREATE POLICY "Admins and editors can read edges" ON knowledge_edges
  FOR SELECT USING (has_knowledge_admin_role());

CREATE POLICY "Admins and editors can insert edges" ON knowledge_edges
  FOR INSERT WITH CHECK (has_knowledge_admin_role());

CREATE POLICY "Admins and editors can update edges" ON knowledge_edges
  FOR UPDATE USING (has_knowledge_admin_role())
  WITH CHECK (has_knowledge_admin_role());

CREATE POLICY "Admins and editors can delete edges" ON knowledge_edges
  FOR DELETE USING (has_knowledge_admin_role());

-- Versions
CREATE POLICY "Admins and editors can read versions" ON knowledge_node_versions
  FOR SELECT USING (has_knowledge_admin_role());

CREATE POLICY "Admins and editors can insert versions" ON knowledge_node_versions
  FOR INSERT WITH CHECK (has_knowledge_admin_role());
