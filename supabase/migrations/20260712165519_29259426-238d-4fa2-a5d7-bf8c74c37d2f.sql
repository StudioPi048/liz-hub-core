
DROP POLICY IF EXISTS "crm read" ON public.crm_contacts;
CREATE POLICY "crm read own or editor" ON public.crm_contacts
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.can_edit(auth.uid()));

DROP POLICY IF EXISTS "profiles read all authed" ON public.profiles;
CREATE POLICY "profiles read own" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
