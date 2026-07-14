CREATE OR REPLACE FUNCTION public.has_knowledge_admin_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_or_editor BOOLEAN;
  jwt_role TEXT;
BEGIN
  jwt_role := current_setting('request.jwt.claim.role', true);
  IF jwt_role = 'service_role' THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'editor')
  ) INTO is_admin_or_editor;

  RETURN COALESCE(is_admin_or_editor, false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_knowledge_admin_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_knowledge_admin_role() TO service_role;