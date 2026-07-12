ALTER TABLE knowledge_edges ADD CONSTRAINT knowledge_edges_unique_rel UNIQUE (source_id, target_id, relation_type);
