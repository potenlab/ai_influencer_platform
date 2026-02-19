DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  -- Insert admin user into auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    email_change_confirm_status,
    phone,
    phone_change,
    phone_change_token
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@potenlab.dev',
    crypt('Mieg0reng!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    0,
    '',
    '',
    ''
  );

  -- Insert identity for email login
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email', 'admin@potenlab.dev'),
    'email',
    new_user_id::text,
    now(),
    now(),
    now()
  );

  -- Update profile role to admin (handle_new_user trigger already created the profile)
  UPDATE public.profiles SET role = 'admin' WHERE id = new_user_id;
END $$;
