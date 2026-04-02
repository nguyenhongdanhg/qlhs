ALTER TABLE public.duty_leaders DROP CONSTRAINT IF EXISTS duty_leaders_school_id_duty_date_key;

ALTER TABLE public.duty_leaders
ADD CONSTRAINT duty_leaders_school_id_duty_date_user_id_key
UNIQUE (school_id, duty_date, user_id);