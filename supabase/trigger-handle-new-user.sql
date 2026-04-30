-- Creates a matching row in public.users whenever a user is inserted into auth.users.
-- Run this in the Supabase SQL Editor after schema.sql (one-time per project).
--
-- Fixes: (1) email-confirmation signups where the client never gets a session to upsert,
-- (2) races where the first client upsert runs before PostgREST sees the new JWT.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
BEGIN
  uname := NULLIF(LOWER(TRIM(NEW.raw_user_meta_data ->> 'username')), '');

  BEGIN
    INSERT INTO public.users (id, email, username, plan)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      uname,
      'free'
    );
  EXCEPTION
    WHEN unique_violation THEN
      INSERT INTO public.users (id, email, plan)
      VALUES (NEW.id, COALESCE(NEW.email, ''), 'free')
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
