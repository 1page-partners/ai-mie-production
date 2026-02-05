INSERT INTO public.user_roles (user_id, role) 
VALUES ('bcc0591d-6e3c-4961-bfff-28c1e2042dc0', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;