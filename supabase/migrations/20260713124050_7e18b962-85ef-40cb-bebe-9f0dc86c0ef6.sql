
REVOKE EXECUTE ON FUNCTION public.has_knowledge_admin_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_status_transitions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.version_knowledge_node() FROM PUBLIC, anon, authenticated;
