DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'lizinstituto@gmail.com' LIMIT 1;

  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'lizinstituto@gmail.com',
      crypt('Liz123456', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name": "Instituto LIZ"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    ) RETURNING id INTO v_user_id;
  END IF;

  -- Remove roles não-admin e garante role admin (user_roles tem UNIQUE(user_id, role))
  DELETE FROM public.user_roles WHERE user_id = v_user_id AND role <> 'admin';
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;