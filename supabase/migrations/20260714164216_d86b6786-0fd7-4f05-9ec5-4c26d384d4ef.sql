REVOKE EXECUTE ON FUNCTION public.has_knowledge_admin_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_knowledge_admin_role() TO service_role;