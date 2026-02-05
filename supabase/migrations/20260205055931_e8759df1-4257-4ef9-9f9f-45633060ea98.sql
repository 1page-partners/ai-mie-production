-- Add unique constraint on decision_id for origin_decision_profiles upsert
ALTER TABLE public.origin_decision_profiles 
ADD CONSTRAINT origin_decision_profiles_decision_id_key UNIQUE (decision_id);