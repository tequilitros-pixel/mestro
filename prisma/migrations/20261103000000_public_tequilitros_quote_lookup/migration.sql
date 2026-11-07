-- Public customer links need a tightly scoped lookup while AuditEvent remains
-- protected by RLS for every other application query.
CREATE OR REPLACE FUNCTION public.get_public_tequilitros_quote(p_code text)
RETURNS TABLE(metadata jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ae.metadata
  FROM public."AuditEvent" AS ae
  WHERE ae."entityType" = 'TequilitrosQuote'
    AND (
      upper(coalesce(ae."entityId", '')) = upper(trim(p_code))
      OR upper(coalesce(ae.metadata->>'code', '')) = upper(trim(p_code))
      OR upper(coalesce(ae.metadata->>'folio', '')) = upper(trim(p_code))
      OR upper(coalesce(ae.metadata->>'contractFolio', '')) = upper(trim(p_code))
    )
  ORDER BY ae."createdAt" DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_tequilitros_quote(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tequilitros_quote(text) TO maestro_runtime;
