-- Protect cash cuts, envelopes, and their ledgers with the same branch
-- predicate already used by POS2. The application filters remain in place;
-- these policies provide the database-level boundary underneath them.

CREATE OR REPLACE FUNCTION public.pos2_branch_allowed(target_branch text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."User" u
    WHERE u.id = current_setting('app.current_user_id', true)
      AND u.active
      AND (
        (u.role = 'ADMIN' AND current_setting('app.is_admin', true) = 'true')
        OR EXISTS (
          SELECT 1
          FROM public."UserBranch" ub
          WHERE ub."userId" = u.id
            AND ub."branchId" = target_branch
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.pos2_branch_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos2_branch_allowed(text) TO maestro_runtime;
GRANT USAGE ON SCHEMA public TO maestro_runtime;

ALTER TABLE public."CashCut" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CashCut" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_cut_branch_isolation ON public."CashCut";
CREATE POLICY cash_cut_branch_isolation ON public."CashCut"
  TO maestro_runtime
  USING (public.pos2_branch_allowed("branchId"))
  WITH CHECK (public.pos2_branch_allowed("branchId"));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashCut" TO maestro_runtime;

ALTER TABLE public."CashCutDenomination" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CashCutDenomination" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_cut_child_branch_isolation ON public."CashCutDenomination";
CREATE POLICY cash_cut_child_branch_isolation ON public."CashCutDenomination"
  TO maestro_runtime
  USING (EXISTS (
    SELECT 1
    FROM public."CashCut" parent
    WHERE parent.id = "cashCutId"
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public."CashCut" parent
    WHERE parent.id = "cashCutId"
  ));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashCutDenomination" TO maestro_runtime;

ALTER TABLE public."CashSalePayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CashSalePayment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_cut_child_branch_isolation ON public."CashSalePayment";
CREATE POLICY cash_cut_child_branch_isolation ON public."CashSalePayment"
  TO maestro_runtime
  USING (EXISTS (
    SELECT 1
    FROM public."CashCut" parent
    WHERE parent.id = "cashCutId"
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public."CashCut" parent
    WHERE parent.id = "cashCutId"
  ));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashSalePayment" TO maestro_runtime;

ALTER TABLE public."CashOutflow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CashOutflow" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_cut_child_branch_isolation ON public."CashOutflow";
CREATE POLICY cash_cut_child_branch_isolation ON public."CashOutflow"
  TO maestro_runtime
  USING (EXISTS (
    SELECT 1
    FROM public."CashCut" parent
    WHERE parent.id = "cashCutId"
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public."CashCut" parent
    WHERE parent.id = "cashCutId"
  ));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashOutflow" TO maestro_runtime;

ALTER TABLE public."CashInflow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CashInflow" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_cut_child_branch_isolation ON public."CashInflow";
CREATE POLICY cash_cut_child_branch_isolation ON public."CashInflow"
  TO maestro_runtime
  USING (EXISTS (
    SELECT 1
    FROM public."CashCut" parent
    WHERE parent.id = "cashCutId"
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public."CashCut" parent
    WHERE parent.id = "cashCutId"
  ));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashInflow" TO maestro_runtime;

ALTER TABLE public."CashCutEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CashCutEvidence" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_cut_child_branch_isolation ON public."CashCutEvidence";
CREATE POLICY cash_cut_child_branch_isolation ON public."CashCutEvidence"
  TO maestro_runtime
  USING (EXISTS (
    SELECT 1
    FROM public."CashCut" parent
    WHERE parent.id = "cashCutId"
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public."CashCut" parent
    WHERE parent.id = "cashCutId"
  ));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashCutEvidence" TO maestro_runtime;

ALTER TABLE public."CashCutAuditEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CashCutAuditEntry" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_cut_child_branch_isolation ON public."CashCutAuditEntry";
CREATE POLICY cash_cut_child_branch_isolation ON public."CashCutAuditEntry"
  TO maestro_runtime
  USING (EXISTS (
    SELECT 1
    FROM public."CashCut" parent
    WHERE parent.id = "cashCutId"
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public."CashCut" parent
    WHERE parent.id = "cashCutId"
  ));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashCutAuditEntry" TO maestro_runtime;

ALTER TABLE public."CashSafeEnvelope" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CashSafeEnvelope" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_safe_envelope_branch_isolation ON public."CashSafeEnvelope";
CREATE POLICY cash_safe_envelope_branch_isolation ON public."CashSafeEnvelope"
  TO maestro_runtime
  USING (
    public.pos2_branch_allowed("branchId")
    AND EXISTS (
      SELECT 1
      FROM public."CashCut" parent
      WHERE parent.id = "cashCutId"
        AND parent."branchId" = "CashSafeEnvelope"."branchId"
    )
  )
  WITH CHECK (
    public.pos2_branch_allowed("branchId")
    AND EXISTS (
      SELECT 1
      FROM public."CashCut" parent
      WHERE parent.id = "cashCutId"
        AND parent."branchId" = "CashSafeEnvelope"."branchId"
    )
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashSafeEnvelope" TO maestro_runtime;

ALTER TABLE public."CashSafeEnvelopeMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CashSafeEnvelopeMovement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_safe_envelope_child_branch_isolation ON public."CashSafeEnvelopeMovement";
CREATE POLICY cash_safe_envelope_child_branch_isolation ON public."CashSafeEnvelopeMovement"
  TO maestro_runtime
  USING (
    EXISTS (
      SELECT 1
      FROM public."CashSafeEnvelope" envelope
      WHERE envelope.id = "envelopeId"
        AND (
          "cashCutId" IS NULL
          OR EXISTS (
            SELECT 1
            FROM public."CashCut" parent_cut
            WHERE parent_cut.id = "cashCutId"
              AND parent_cut."branchId" = envelope."branchId"
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."CashSafeEnvelope" envelope
      WHERE envelope.id = "envelopeId"
        AND (
          "cashCutId" IS NULL
          OR EXISTS (
            SELECT 1
            FROM public."CashCut" parent_cut
            WHERE parent_cut.id = "cashCutId"
              AND parent_cut."branchId" = envelope."branchId"
          )
        )
    )
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashSafeEnvelopeMovement" TO maestro_runtime;

ALTER TABLE public."CashSafeMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CashSafeMovement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_safe_movement_branch_isolation ON public."CashSafeMovement";
CREATE POLICY cash_safe_movement_branch_isolation ON public."CashSafeMovement"
  TO maestro_runtime
  USING (
    public.pos2_branch_allowed("branchId")
    AND (
      "cashCutId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM public."CashCut" parent
        WHERE parent.id = "cashCutId"
          AND parent."branchId" = "CashSafeMovement"."branchId"
      )
    )
  )
  WITH CHECK (
    public.pos2_branch_allowed("branchId")
    AND (
      "cashCutId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM public."CashCut" parent
        WHERE parent.id = "cashCutId"
          AND parent."branchId" = "CashSafeMovement"."branchId"
      )
    )
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashSafeMovement" TO maestro_runtime;

ALTER TABLE public."CashTransfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CashTransfer" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_transfer_branch_isolation ON public."CashTransfer";
CREATE POLICY cash_transfer_branch_isolation ON public."CashTransfer"
  TO maestro_runtime
  USING (public.pos2_branch_allowed("branchId"))
  WITH CHECK (public.pos2_branch_allowed("branchId"));
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashTransfer" TO maestro_runtime;
