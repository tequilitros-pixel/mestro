# Workforce: hardening before production

Date: 2026-09-06. Repository: `/Users/joseadansanchez/maestro-dev`.
Branch: `codex/recover-workforce-3a566e2`; starting commit: `d966b16`.

## Release gate

**READY FOR PRODUCTION MIGRATION: NO.** Local hardening and DEV enforcement tests pass, but the production application connection has not been certified as a non-BYPASS runtime connection. The prior recovery found owner connection configuration; the presence of a separate runtime role alone is insufficient. This change deliberately rejects privileged runtime connections. Switching/confirming production credentials and checking the deployed application are separate, approval-required operations. No production configuration, migration, push or deployment was performed.

This is a scoped certification of Branch/template/geofence/clock/attendance isolation, not a claim that every legacy or Payroll table in the whole application has RLS. The centralized context wrapper also affects authenticated consumers outside Workforce; production rollout must include their smoke checks. Browser GPS remains client-supplied sensor data, not hardware-backed presence attestation.

## Permissions root cause

The administrative layout already required ADMIN, but navigation metadata classified only `/administration/workforce/branches` as admin-only. `/administration/workforce` consequently appeared to be a delegable route missing from the permission catalog. Fixed the parent prefix and made `requireModuleAccess` honor admin-only metadata even if stale module grants exist. The test was not weakened. Kiosk is explicitly ADMIN-hosted in both page and action.

## Role and connection separation

DEV `maestro_runtime` was created with NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION. A separate runtime pool connects with PostgreSQL startup `role=maestro_runtime`; tests assert **current_user**, not merely the existence of the role. Its transport login is the existing DEV owner with membership, but the effective test queries cannot bypass RLS. The owner/migration pool is separate and only creates synthetic fixtures/applies DEV migrations. No passwords were changed or stored.

Production should use its dedicated runtime login, with owner credentials reserved for migrations. `setRlsContext` rejects an effective SUPERUSER/BYPASSRLS role, verifies the active User and actual ADMIN role, then sets transaction-local identity. No SECURITY DEFINER function or bypass was introduced. PostgreSQL custom settings are trusted server context, not an authentication mechanism for arbitrary SQL clients; never expose a raw SQL endpoint or database credential to browsers.

`prisma` now wraps single queries, raw queries, callback transactions and lazy batch transactions with the same-connection context. Auth session lookup uses `rawPrisma` to avoid recursive authentication; protected branch membership reads explicitly use `withRlsContext`. `withDatabaseActor` is server-only and used after PIN authentication in kiosk and for DEV service tests. Lazy operations capture identity before leaving its async context. Batch rollback and pooled-context isolation were tested. Existing owner-only maintenance scripts must use an explicit separate migration client, not the runtime export.

## RLS matrix

All 24 tables below have ENABLE + FORCE RLS in DEV. `workforce_read`/`workforce_admin` means scoped employee SELECT plus genuine ADMIN writes; other policy names indicate the narrower command set. No-context reads return no protected rows. Historical branch association is deliberately retained for historical reads, including inactive branches; authorization for **new clock activity** still checks a currently effective assignment or a nearby published shift.

| Table | Policies | Runtime read / employee scope | Runtime write / ADMIN |
|---|---|---|---|
| Branch | read, admin, branch_lock | Assigned/historically associated branch | ADMIN; employee can row-lock but WITH CHECK forbids updates |
| Geofence | read, admin | Through visible Branch | ADMIN |
| UserBranch | read, admin | Own user | ADMIN |
| Employee | read, admin | Own user | ADMIN |
| Employment | read, admin | Own Employee | ADMIN |
| BranchAssignment | read, admin | Own Employment | ADMIN, active target |
| ScheduleTemplate | read, admin | Associated branch; unscoped legacy templates ADMIN-only | ADMIN |
| ScheduleTemplateShift | read, admin | Visible template and block branch | ADMIN |
| BranchScheduleTemplate | read, admin | Associated branch | ADMIN |
| ScheduledShift | read, admin | Own user (legacy) | ADMIN |
| SchedulePeriod | read, admin | Associated branch | ADMIN |
| Shift | read, admin | Own published/cancelled shifts | ADMIN |
| ShiftRevision | read, admin | Own published/cancelled revisions | ADMIN |
| SchedulePublication | read, admin | Visible period | ADMIN |
| SchedulePublicationShift | read, admin | Visible shift | ADMIN |
| StaffingRequirement | read, admin | Associated branch | ADMIN |
| WorkforcePolicyVersion | read, admin | Active authenticated users; company-wide settings | ADMIN |
| WorkforceSettings | read, admin | ADMIN-only compatibility shell | ADMIN |
| ClockEvent | read, insert | Own Employment / ADMIN | INSERT own/admin + active branch + actor identity; no UPDATE/DELETE |
| ClockGeolocationEvidence | read, insert, review | Own event / ADMIN | INSERT validates canonical event/branch/exception links; review ADMIN; no DELETE |
| AttendanceException | read, insert, update | Own Employment / ADMIN | Own derived exceptions; geo resolution ADMIN only; no DELETE |
| WorkSession | scope | Own Employment / ADMIN | Own scoped reconstruction / ADMIN |
| WorkSessionClockEvent | scope | Own session / ADMIN | Own matching session/event reconstruction / ADMIN |
| ClockCorrection | read, request, review | Own Employment / ADMIN | Own PENDING request; approval/rejection ADMIN; no DELETE |

Actual names use the `workforce_` prefix. Migration files contain the exact expressions, grants and triggers. Existing POS RLS policies were not rewritten. Runtime access to `_prisma_migrations` and `WorkforceMigrationRecord` is revoked.

## Branch lifecycle

New assignment/home changes, template application, shift scheduling and clock activity check active Branch. `FOR SHARE` holds the branch against concurrent deactivation within the operation. A separate UPDATE USING policy permits an employee to acquire that lock; its WITH CHECK still requires ADMIN, and the runtime test proves the employee cannot update even their own branch.

Database triggers additionally reject new activity on BranchAssignment, Shift, ClockEvent, templates/blocks, legacy ScheduledShift, SchedulePeriod and StaffingRequirement. Historical assignment closure, cancellation and template deactivation are permitted. No history was deleted. Exact idempotent clock replay remains valid after deactivation, but reuse with another branch/source/type fails. Geofence enabling in the administrative action checks active Branch.

## Geolocation and GPS trust

Only the server computes INSIDE/OUTSIDE from stored branch geometry and submitted coordinates. Client result fields are ignored; client failure accepts only PERMISSION_DENIED/UNAVAILABLE. Missing/nonfinite/negative accuracy is UNAVAILABLE; accuracy above the existing versioned `maximumGpsAccuracyMeters` setting is LOW_ACCURACY. Default is 100m; existing settings validation enforces 10–1000m. An enabled branch with missing geometry is UNAVAILABLE, not NOT_REQUIRED.

All inconclusive/outside results obey BLOCK or ALLOW_WITH_EXCEPTION. Allowed exceptions always create AttendanceException plus immutable evidence, even when mandatory review is disabled. Evidence contains distance, accuracy and server check time, never employee latitude/longitude. No continuous tracking was added. Coordinates and accuracy can still be spoofed at the device; this does not claim fraud-proof attestation or freshness attestation.

## Kiosk

The actual host must be ADMIN with a valid server-read session; the employee independently supplies their existing PIN. Employee identity becomes the authenticated clock principal after that check. `ClockEvent.employmentId` is the subject, `actorUserId` is the employee, `kioskHostUserId`/`kioskSessionId` are immutable host-session snapshots and `branchId` is the validated work context. KIOSK records without a genuine active ADMIN host session are rejected. This is a session-hosted online kiosk, not a newly introduced device enrollment feature. Historical events retain null provenance rather than fabricating it.

## Geographic exception lifecycle

Geographic exceptions never auto-resolve from schedule/session reconciliation. The reconciler excludes OUTSIDE_GEOFENCE by type, including previously created derivationVersion=1 records. New geographic evidence uses derivationVersion=2. Rejected location reviews leave the exception open; explicit ADMIN approval/resolution can close it. Review actions validate decision enums and use pending/open status guards against conflicting decisions. Generic ADMIN resolution synchronizes pending/not-required evidence review metadata. A database trigger prevents changing original evidence fields; only review metadata can change. Timesheet signals are refreshed after exception creation/resolution.

## Migration decision

**A: retain both rescue migrations unchanged**, followed by additive hardening:

1. `20260904090000_workforce_branches_templates_geofence`
2. `20260905090000_canonical_workforce_geolocation`
3. `20260906090000_workforce_security_hardening`
4. `20260906100000_workforce_attendance_rls`

The original two already have tracked successful DEV checksums; squashing would obscure that history. No resolve/reset or checksum rewrite was used. The two hardening migrations were applied successfully to DEV only, each explicitly transactional. Prisma now models the already-existing legacy `UserBranch.assignmentType` and `ScheduledShift.breakMinutes` columns. The schema formatter's alignment changes are mechanical. Legacy structures remain compatibility-only, with no new dual-write path.

## POS2 divergence: IRRELEVANT WITH EVIDENCE to this targeted migration

DEV contains nine additional phase3a–phase3i records absent from this canonical branch. This is real **branch-history divergence**, not proof that DEV is identical to production. Read-only `git show` from Documents commit `3a566e22c7ce6d7be627267004721902210c6e3b` produced all nine SQL files; every SHA-256 matched DEV's successful `_prisma_migrations` entry:

| Migration suffix | SHA-256 |
|---|---|
| 20260830090000 phase3a foundations | 23b0675a3be6bf97e4703ba37b7db7f5c875a6a5d3a6ab562fd059f990be0363 |
| 20260830150000 phase3b cash | 00605f8865cc4f020071eae61354704f7c51f12c8ca3ba098112ca304556eb2d |
| 20260830190000 phase3c catalog | 2ffa98411646878d73e600594469dba3707846b888ee971a6da7bdf00e155e2e |
| 20260831110000 phase3d pricing | 851dd4d4616ecfe5064309e16c4b80e3e7b69b9a0d95351b376a8078363643a5 |
| 20260831180000 phase3e orders | 3a1e14a68c4f1e322e62aba38f7aa63ce196a17660815e35efd277e97a243530 |
| 20260831220000 phase3f inventory | 91e4061570c8ddbcb157cd9bb6961db0613863d25779d046cb21aead9cb2f7cc |
| 20260831233000 phase3g sales/payments | b3b5ae9e73a2b148240fd79071223fd24e5988f8549c57163be87c1c401ea004 |
| 20260901090000 phase3h compensation | c7960480af6c9ceec4a4155141b98c047d38f6613b3f50c8da916c490e84a8ed |
| 20260901150000 phase3i adjustments | aaeb6e0e7f3b085748af0d945929c737138f0a2f4f48c2630fbc65161b2963e4 |

Their CREATE/ALTER TABLE targets concern POS, cash sessions, inventory, pricing/orders/payments/returns and adjustments, not the Workforce hardening tables. New hardening SQL references no POS2 table/type/function. No POS2 migration was copied, rolled back or altered. All shared local migration checksums also match DEV. This supports **targeted additive deploy**, not a destructive schema synchronization. A whole-database `migrate dev/reset` or drift-generated production patch against this mixed DEV database is **UNSAFE** without separate reconciliation. `migrate status` alone is not a schema-drift certification.

## Validation and reproducibility

Run from the canonical repository. The DEV helper checks the exact DEV hostname/database and never falls back to the production DATABASE_URL in Documents. It never prints credentials. `setup` is a DEV mutation; do not substitute a production hostname.

```sh
node scripts/workforce/hardening-dev.mjs command npx prisma format
node scripts/workforce/hardening-dev.mjs command npx prisma validate
node scripts/workforce/hardening-dev.mjs command npx prisma generate
node scripts/workforce/hardening-dev.mjs command npx prisma migrate status
node scripts/workforce/hardening-dev.mjs integration
npx tsc --noEmit --incremental false
npm run test:workforce
npm test
node scripts/workforce/hardening-dev.mjs command build
```

- Prisma format/validate/generate: PASS. DEV status: 17 local migrations, no pending; 9 extra POS2 historical records explained above.
- Full suite: **234/234 PASS** (231 existing + 3 new geofence tests), no skipped tests.
- Workforce suite: **204/204 PASS**.
- Runtime/service integration: **17/17 PASS**, separate from unit totals. No-context reads, genuine role/no bypass, owner rejection, admin/employee scope, cross-branch denial, fake-role denial, own-branch write denial, atomic batch rollback, drafts-only template apply, server geofence, legacy geographic exception survival, employee review denial, genuine kiosk host/subject, inactive service denial, history/replay, explicit manager resolution, immutable evidence and no pool context leak.
- TypeScript and focused ESLint: PASS.
- Production-style local build: PASS with process-local dummy Resend key, following the existing Timesheet certification method. No shared secret/configuration changed; no email was sent.

DEV integration intentionally preserves its synthetic history (successful run prefix `hardening_ee48f631`) and disables only each run's synthetic users afterward. Earlier failed runs also retained their fixture history; no production/user history was removed. No test fixture or role creation was performed in production.

## Remaining release work requiring approval

Confirm/configure the **actual production application** connection as the non-BYPASS runtime role, keep migration credentials separate, then approve the coordinated migration/release and authenticated route smoke checks. The prior owner configuration must not be used with this build. Do not treat passing tests or this document as deployment authorization.

No push. No deploy. No production migration.
