REVOKE ALL ON FUNCTION public.promote_classes(uuid, integer[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.promote_classes(uuid, integer[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.promote_classes(uuid, integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_classes(uuid, integer[]) TO service_role;