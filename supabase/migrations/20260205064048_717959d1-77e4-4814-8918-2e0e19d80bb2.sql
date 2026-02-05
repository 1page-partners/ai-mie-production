INSERT INTO public.user_roles (user_id, role) 
VALUES ('e66c239d-33b7-4bd9-85bc-48257434edea', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;