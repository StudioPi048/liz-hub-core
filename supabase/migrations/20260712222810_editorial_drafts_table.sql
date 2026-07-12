CREATE TABLE editorial_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  
  proposed_title TEXT,
  proposed_summary TEXT,
  proposed_content TEXT NOT NULL,
  proposed_metadata JSONB NOT NULL DEFAULT '{}',
  
  previous_content_hash TEXT NOT NULL,
  proposed_content_hash TEXT NOT NULL,
  
  reason TEXT NOT NULL DEFAULT 'repository_source_changed',
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'in_review', 'approved', 'rejected', 'superseded')),
  
  source_uri TEXT,
  
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  reviewed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  
  UNIQUE (knowledge_node_id, proposed_content_hash)
);

-- Trigger for updated_at
CREATE TRIGGER update_editorial_drafts_updated_at
BEFORE UPDATE ON editorial_drafts
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Indices
CREATE INDEX idx_editorial_drafts_node_id ON editorial_drafts(knowledge_node_id);
CREATE INDEX idx_editorial_drafts_status ON editorial_drafts(status);

-- RLS
ALTER TABLE editorial_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and editors can read drafts" ON editorial_drafts
  FOR SELECT USING (has_knowledge_admin_role());

CREATE POLICY "Admins and editors can insert drafts" ON editorial_drafts
  FOR INSERT WITH CHECK (has_knowledge_admin_role());

CREATE POLICY "Admins and editors can update drafts" ON editorial_drafts
  FOR UPDATE USING (has_knowledge_admin_role())
  WITH CHECK (has_knowledge_admin_role());

CREATE POLICY "Admins and editors can delete drafts" ON editorial_drafts
  FOR DELETE USING (has_knowledge_admin_role());
