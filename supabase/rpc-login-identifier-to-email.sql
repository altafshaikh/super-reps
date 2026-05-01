-- Resolve email for password sign-in when the user types a username (RLS blocks direct SELECT).
-- Run in Supabase SQL Editor after schema.sql / existing users table.

CREATE OR REPLACE FUNCTION public.login_identifier_to_email(p_identifier text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email
  FROM public.users u
  WHERE lower(btrim(u.email)) = lower(btrim(p_identifier))
     OR (u.username IS NOT NULL AND lower(u.username) = lower(btrim(p_identifier)))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.login_identifier_to_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_identifier_to_email(text) TO anon;
GRANT EXECUTE ON FUNCTION public.login_identifier_to_email(text) TO authenticated;
