# MAESTRO Workforce V1 — DEV Migration Report

## Foundation

- Repository: `/Users/joseadansanchez/maestro-dev`
- Branch: `workforce-v1-foundation`
- Foundation commit: `b13ea19a22230f1f3843d6f606b2447bc05cac0b`
- Migration: `20260826202402_add_workforce_v1_foundation`

## Verified DEV identity

- Provider: Neon PostgreSQL
- Logical branch/environment: `cash-safe-envelopes-dev`
- Endpoint: `ep-red-lake-ats4n9i7`
- Host: `ep-red-lake-ats4n9i7.c-9.us-east-1.aws.neon.tech`
- Region: `aws-us-east-1`
- Database: `neondb`
- Schema: `public`
- PostgreSQL: 17.11
- Production: **NO**
- Confidence: high. `DATABASE_URL_DEV` is a distinct endpoint from production (`ep-noisy-rain-at5phvb9`), prior project records identify the isolated environment as `cash-safe-envelopes-dev`, and read-only inspection found the expected DEV fixtures and migration history. No production connection was used during this gate.

Credentials and connection strings are intentionally omitted.

## Baseline compatibility

The verified DEV database initially reported exactly these applied migrations:

1. `00000000000000_baseline_current_schema`
2. `20260821214207_add_cash_safe_envelopes`

`prisma migrate status` reported the database schema up to date before migration generation. This matches the structural baseline expected by the foundation commit.

## Migration SQL review

- Tables created: 22.
- Enums created: 16.
- Legacy tables altered: `Branch` only.
- Legacy columns added: nullable `Branch.timezone TEXT`, with no default or backfill.
- Generated indexes: 49, including unique indexes.
- Foreign keys: 53.
- Manual check constraints: 23.
- Manual triggers: zero.
- Destructive operations: zero.
- No `DROP TABLE`, `DROP COLUMN`, `DROP TYPE`, destructive conversion, legacy `SET NOT NULL`, data update, backfill or delete is present.

## Constraints added

The migration includes only local structural invariants that are independent of future workflows:

- valid employment, pay-rate, branch-assignment and availability effective ranges;
- availability day-of-week from 0 through 6;
- valid schedule-period and timesheet date ranges;
- positive shift and shift-revision duration;
- nonnegative shift breaks, work-session minutes, payable/payroll minutes and overtime multipliers;
- positive schedule/timesheet/reconstruction versions and shift revision numbers;
- nonnegative work-session clock-event sequence;
- valid optional work-session time range.

## Constraints deferred

- `ClockEvent` append-only trigger.
- `SchedulePublication` and `SchedulePublicationShift` append-only triggers.
- temporal exclusion for overlapping effective `HOME` branch assignments.
- conditional `PayrollLine` immutability after `PayrollPeriod` finality.
- publication-link consistency between `SchedulePublicationShift.shiftId` and `ShiftRevision.shiftId`.
- database-level validation of IANA timezone names.

These are behavioral, finality or cross-row invariants and should be designed alongside the services that use them.

## Generation incident and recovery

`prisma migrate dev --create-only` generated the migration but continued into an apply phase before returning control. It was interrupted before SQL review. Read-only inspection showed no new tables or `Branch.timezone`, but the first eight new enum types had been created and Prisma had an unfinished migration record.

Recovery was limited to the verified DEV endpoint:

1. confirmed all eight types were new Workforce enums with zero dependencies;
2. removed only those eight partial enum types in one transaction;
3. marked the unfinished attempt rolled back with `prisma migrate resolve --rolled-back`;
4. verified no partial objects remained;
5. reviewed the complete SQL;
6. applied the reviewed migration with `prisma migrate deploy`.

The migration history now contains one rolled-back attempt and one successfully applied attempt for the same migration name. No legacy table or data was changed during recovery.

## Post-migration validation

- `npx prisma migrate status`: PASS; three migrations found and schema up to date.
- `npx prisma validate`: PASS.
- `npx prisma generate`: PASS with Prisma Client 7.9.1.
- `npx tsc --noEmit`: PASS.

## Direct database inspection

- Workforce tables found: 22 of 22.
- All 22 Workforce tables are empty.
- Workforce foreign keys: 53.
- Workforce indexes including primary keys: 71 total, 37 unique.
- Manual check constraints: 23.
- `Branch.timezone`: `text`, nullable, no default.
- Missing expected Workforce tables: zero.

No backfill, fixtures, dual-write, route changes, production operation, deploy, push or legacy data mutation was performed.
