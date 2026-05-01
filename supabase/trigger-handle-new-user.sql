-- Creates a matching row in public.users whenever a user is inserted into auth.users.
-- Run this in the Supabase SQL Editor after schema.sql (one-time per project).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  uname_display text;
BEGIN
  uname        := NULLIF(LOWER(TRIM(NEW.raw_user_meta_data ->> 'username')), '');
  uname_display := NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), '');

  BEGIN
    INSERT INTO public.users (id, email, username, name, plan)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      uname,
      uname_display,
      'free'
    );
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO public.users (id, email, name, plan)
      VALUES (NEW.id, COALESCE(NEW.email, ''), uname_display, 'free')
      ON CONFLICT (id) DO NOTHING;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
