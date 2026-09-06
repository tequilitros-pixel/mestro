# POS2 Phase 3L — Pilot and Rollback Runbook

## Before activation

1. Record branch ID, Register ID, Terminal ID, operator and maintenance window.
2. Verify backup/restore evidence and migration status in the approved non-production rehearsal environment.
3. Run `POS2_CERTIFICATION_DATABASE_URL='<approved-url>' npm run certify:pos2 -- --migration-clean` and retain the JSON output.
4. Confirm no blocker and obtain business/security sign-off.
5. Configure `PILOT` with exactly one branch and Register. Do not use names or wildcards.
6. Enroll the physical terminal and test revocation before accepting a sale.

## Pilot monitoring

At opening, mid-shift and close, retain a certification report. Investigate any failed outbox event, stale receipt, payment mismatch, orphan Sale or inventory mismatch before continuing. Unknown payment outcomes must be resolved by replaying the same operation ID, never by initiating a second payment.

The local certification benchmark passed on 5,000 balances and 50,000 movements. Establish a separate alert threshold from the target environment's baseline; do not treat the local timing as a production SLA.

## Kill switch

Set `POS2_ROLLOUT_MODE=DISABLED` in the controlled runtime configuration and apply the platform's normal configuration activation. Confirm `/pos2` exposes no pilot context and an authenticated terminal request is denied. This stops new commands; it does not reverse completed facts.

## After disabling

1. Record the exact disable time.
2. Inventory open and `PAYMENT_PENDING` Orders, local offline drafts and stale receipts.
3. Reconcile Sale totals to captured payments, cash movements and inventory ledger.
4. Resolve accepted operations in POS2; do not recreate them in V1.
5. Export AuditEvent/OperationReceipt identifiers for the incident record.
6. Re-enable only after the original blocker is understood and certification returns PASS.
