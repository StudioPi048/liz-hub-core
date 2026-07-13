DO $$
DECLARE v UUID;
BEGIN
  SELECT id INTO v FROM auth.users WHERE email = 'studiopi048@gmail.com';
  IF v IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;