-- Change kunpei@k9-base.com role from admin to user
DELETE FROM public.user_roles 
WHERE user_id = 'bcc0591d-6e3c-4961-bfff-28c1e2042dc0' AND role = 'admin';

INSERT INTO public.user_roles (user_id, role)
VALUES ('bcc0591d-6e3c-4961-bfff-28c1e2042dc0', 'user')
ON CONFLICT (user_id, role) DO NOTHING;