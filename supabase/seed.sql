-- Create two dummy centers
INSERT INTO public.centers (id, name, location) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Dharavi Education Center', 'Sector 3, Dharavi, Mumbai'),
  ('c2222222-2222-2222-2222-222222222222', 'Ghatkopar Center', 'LBS Road, Ghatkopar, Mumbai')
ON CONFLICT (id) DO NOTHING;

-- Seed Center Lead user: rajesh.kumar@pratham.org
-- password: password123
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  phone,
  is_super_admin,
  is_sso_user
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'rajesh.kumar@pratham.org',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"Center Lead","assigned_center_id":"c1111111-1111-1111-1111-111111111111"}',
  now(),
  now(),
  null,
  false,
  false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"rajesh.kumar@pratham.org","email_verified":true,"phone_verified":false}',
  'email',
  now(),
  now(),
  now()
) ON CONFLICT (provider, id) DO NOTHING;

-- Seed a dummy Volunteer user: sunita.sharma@pratham.org
-- password: password123
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  phone,
  is_super_admin,
  is_sso_user
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'sunita.sharma@pratham.org',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"Volunteer","assigned_center_id":"c1111111-1111-1111-1111-111111111111"}',
  now(),
  now(),
  null,
  false,
  false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"sunita.sharma@pratham.org","email_verified":true,"phone_verified":false}',
  'email',
  now(),
  now(),
  now()
) ON CONFLICT (provider, id) DO NOTHING;

-- Seed sessions for Center 1 (Dharavi Education Center)
INSERT INTO public.sessions (id, center_id, topic, start_time, end_time, capacity) VALUES
  (
    '11111111-1111-1111-1111-222222222222',
    'c1111111-1111-1111-1111-111111111111',
    'Basic Arithmetic & Counting',
    (now() + interval '2 hours'),
    (now() + interval '3 hours 30 minutes'),
    4
  ),
  (
    '22222222-2222-2222-2222-333333333333',
    'c1111111-1111-1111-1111-111111111111',
    'English Reading - Level 2',
    (now() + interval '4 hours'),
    (now() + interval '5 hours 30 minutes'),
    4
  ),
  (
    '33333333-3333-3333-3333-444444444444',
    'c1111111-1111-1111-1111-111111111111',
    'Basic Digital Literacy',
    (now() + interval '6 hours'),
    (now() + interval '7 hours 30 minutes'),
    6
  )
ON CONFLICT (id) DO NOTHING;

-- Seed session for Center 2 (Ghatkopar Center)
INSERT INTO public.sessions (id, center_id, topic, start_time, end_time, capacity) VALUES
  (
    '44444444-4444-4444-4444-555555555555',
    'c2222222-2222-2222-2222-222222222222',
    'Ghatkopar Science Workshop',
    (now() + interval '1 hours'),
    (now() + interval '3 hours'),
    8
  )
ON CONFLICT (id) DO NOTHING;
