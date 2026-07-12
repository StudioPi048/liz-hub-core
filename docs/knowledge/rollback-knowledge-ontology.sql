-- docs/knowledge/rollback-knowledge-ontology.sql
-- Run this manually if you need to revert the Knowledge Engine ontology migration.

-- Drop Triggers
DROP TRIGGER IF EXISTS update_knowledge_nodes_updated_at ON knowledge_nodes;
DROP TRIGGER IF EXISTS enforce_knowledge_status_transition ON knowledge_nodes;
DROP TRIGGER IF EXISTS trigger_version_knowledge_node ON knowledge_nodes;

-- Drop Functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS enforce_status_transitions();
DROP FUNCTION IF EXISTS version_knowledge_node();
DROP FUNCTION IF EXISTS has_knowledge_admin_role();

-- Drop Policies
DROP POLICY IF EXISTS "Admins and editors can read all nodes" ON knowledge_nodes;
DROP POLICY IF EXISTS "Admins and editors can insert nodes" ON knowledge_nodes;
DROP POLICY IF EXISTS "Admins and editors can update nodes" ON knowledge_nodes;
DROP POLICY IF EXISTS "Admins and editors can delete nodes" ON knowledge_nodes;

DROP POLICY IF EXISTS "All users can read edges" ON knowledge_edges;
DROP POLICY IF EXISTS "Admins and editors can insert edges" ON knowledge_edges;
DROP POLICY IF EXISTS "Admins and editors can update edges" ON knowledge_edges;
DROP POLICY IF EXISTS "Admins and editors can delete edges" ON knowledge_edges;

DROP POLICY IF EXISTS "All users can read versions" ON knowledge_node_versions;
DROP POLICY IF EXISTS "Admins and editors can insert versions" ON knowledge_node_versions;

-- Drop Tables (in correct order to respect foreign keys)
DROP TABLE IF EXISTS knowledge_node_versions CASCADE;
DROP TABLE IF EXISTS knowledge_edges CASCADE;
DROP TABLE IF EXISTS knowledge_nodes CASCADE;
