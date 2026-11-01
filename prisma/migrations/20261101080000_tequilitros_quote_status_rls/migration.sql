-- Tequilitros quotations are mutable; other AuditEvent records must remain immutable.
-- Only permit changing the existing quote's action and metadata, never its
-- owner, branch, identity, timestamps or other kinds of audit records.
GRANT UPDATE ("action", "metadata") ON TABLE public."AuditEvent" TO maestro_runtime;

-- Existing permissive pos2_branch_isolation policy remains in effect.
-- This restrictive UPDATE-only policy adds an AND condition and never
-- weakens SELECT, INSERT, DELETE or any non-Tequilitros AuditEvent policy.
CREATE POLICY "tequilitros_quote_owner_update_only_20261101"
ON public."AuditEvent" AS RESTRICTIVE FOR UPDATE TO maestro_runtime
USING (
  "entityType" = 'TequilitrosQuote'
  AND "actorId" = NULLIF(current_setting('app.current_user_id', true), '')
)
WITH CHECK (
  "entityType" = 'TequilitrosQuote'
  AND "actorId" = NULLIF(current_setting('app.current_user_id', true), '')
);
