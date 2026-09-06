# POS2 Phase 3L — Certification and Pilot Readiness

## Decision

The Phase 3L certification mechanism is **PASS** in disposable DEV PostgreSQL. A real pilot is **NO-GO pending branch-specific evidence**. No empty or synthetic database is accepted as proof that a real branch is reconciled.

## Hard gates

The read-only `npm run certify:pos2 -- --migration-clean` command reports:

- migration drift declared only after an explicit Prisma status/diff check;
- idempotency receipts left `IN_PROGRESS` for more than five minutes;
- failed or stale-processing outbox events;
- Inventory V2 balances that differ from the append-only ledger;
- Sale totals that differ from captured payments;
- Sales whose source Order is not finalized;
- duplicate active CashSessions per Register.

Financial/data inconsistencies are blockers. Outbox backlog and duplicate-session diagnostics are warnings or blockers according to `readiness.ts`. The command exits non-zero for a blocker and prints structured JSON suitable for retained pilot evidence.

The command deliberately ignores `DATABASE_URL`. It requires a separately supplied `POS2_CERTIFICATION_DATABASE_URL`, reducing the chance of accidental execution against the wrong environment.

## Rollout controls

Server-side rollout configuration:

- `POS2_ROLLOUT_MODE=DISABLED`: kill switch; all POS2 terminal requests are denied.
- `POS2_ROLLOUT_MODE=PILOT`: only listed branches, and optionally listed Registers, appear in `/pos2`.
- `POS2_ROLLOUT_MODE=ALL`: all otherwise authorized contexts are enabled.
- `POS2_PILOT_BRANCH_IDS`: comma-separated immutable branch IDs.
- `POS2_PILOT_REGISTER_IDS`: optional comma-separated immutable Register IDs.

Production defaults to `DISABLED`; non-production defaults to `ALL`. The gate is evaluated server-side. API terminal authentication also enforces the branch kill switch, so hiding the UI is not the security boundary.

## Pilot GO checklist

A named branch/Register can receive GO only when all items have retained evidence:

1. Backup and restore rehearsal completed for the target environment.
2. Prisma migration status and schema diff are clean.
3. Certification command reports PASS against a recent copy of the target dataset.
4. Capability negative tests cover cashier, manager and cross-branch access.
5. Terminal enrollment and revocation are rehearsed on the pilot device.
6. Opening, sale, mixed payment, lost response, return/refund and close are rehearsed.
7. Peak-load test covers the expected number of terminals and catalog size.
8. Outbox/receipt/ledger checks are assigned to an operator with an escalation path.
9. V1 remains available and the pilot Register is the only enabled Register.
10. Rollback owner can set `POS2_ROLLOUT_MODE=DISABLED` without a code deployment.

Items 1, 3 (real data), 4 (full role matrix), 6 (pilot device), 7, 8 and 10 (environment control rehearsal) remain external operational evidence and therefore keep the real pilot at NO-GO.

## Rollback semantics

Rollback disables new POS2 entry and terminal commands. It does not delete or rewrite accepted Sales, Payments, CashMovements, InventoryMovements, AuditEvents or OperationReceipts. Pending local drafts remain on their originating device for review. Operators must finish or explicitly resolve any `PAYMENT_PENDING` Order before returning that Register to an alternate workflow. Never replay an accepted payment through V1.

## Validation evidence

- Eleven migrations reconstructed on PostgreSQL 16 from an empty database.
- Prisma migration status: up to date.
- Pure rollout/readiness tests: 4/4 PASS.
- PostgreSQL certification/gate integration: 4/4 PASS (detect drift, enforce Register allowlist/kill switch, clean up, re-certify).
- Inventory load fixture: 13/13 PASS with 5,000 balances and 50,000 append-only movements; representative reads completed in 119 ms locally.
- Certification over that loaded dataset: PASS with zero findings in approximately 1.0 s end-to-end.
- Read-only certification after cleanup: PASS with zero findings.

All databases used for this evidence are disposable DEV resources. This is reconciler/load evidence, not a physical multi-terminal peak test. Production was not queried or modified.
