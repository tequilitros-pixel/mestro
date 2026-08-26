# MAESTRO Workforce V1 — Structural DEV Test Report

## Environment and safety

- Repository: `/Users/joseadansanchez/maestro-dev`
- Branch: `workforce-v1-foundation`
- Foundation commit: `b13ea19a22230f1f3843d6f606b2447bc05cac0b`
- Migration: `20260826202402_add_workforce_v1_foundation`
- DEV endpoint: `ep-red-lake-ats4n9i7.c-9.us-east-1.aws.neon.tech`
- Database: `neondb`
- Logical environment: `cash-safe-envelopes-dev`
- Production endpoint was not connected to or modified.

The integration runner refuses any host or database other than the values above and verifies that the foundation migration is applied. All synthetic identifiers use the `WFTEST-` prefix. The integration scenario runs inside one transaction and ends with `ROLLBACK`.

## Test matrix

| Test | Expected | Actual | Result | Notes |
| --- | --- | --- | --- | --- |
| Employee without User | Independent employee and employment | Employee with null `userId` linked to Employment, PayRate and HOME assignment | PASS | No login required |
| User with Employee | Optional one-to-one link | Synthetic User remained independently queryable and linked to Employee | PASS | Legacy auth fields unchanged |
| Availability | Recurrence and exception coexist | Five weekday rules plus one Wednesday exception | PASS | No scheduler logic added |
| Schedule publication v1 | Exact revision retained | Publication v1 references revision 1 | PASS | Relational link, no JSON IDs |
| Schedule publication v2 | New version uses new revision | Publication v2 references revision 2 while v1 remains unchanged | PASS | History preserved |
| Clock idempotency | Duplicate key rejected | PostgreSQL `23505` | PASS | Global unique key enforced |
| Missing punch | Correction supplies effective event without fake observation | One observed CLOCK_IN plus approved ADD_MISSING_EVENT | PASS | No synthetic ClockEvent inserted |
| Void duplicate | Both observations remain; duplicate is administratively voided | Two CLOCK_IN rows remain and correction targets B | PASS | Original evidence preserved |
| Modify time | Original event remains unchanged | Original CLOCK_OUT remains at 01:20-equivalent; correction stores 01:05-equivalent | PASS | No observed-row update |
| Effective stream: missing punch | Approved add appears | Correction-supplied CLOCK_OUT appears | PASS | Pure helper |
| Effective stream: void | Approved void excludes target | Duplicate omitted from effective output | PASS | Observed input array unchanged |
| Effective stream: modify | Approved modify replaces effective time | Original identity retained with corrected effective time | PASS | Pure helper |
| Effective stream: pending | No effect | Observed-only output | PASS | Pure helper |
| Effective stream: rejected | No effect | Observed-only output | PASS | Pure helper |
| WorkSession materialization | Derived values and observed inputs retained | Four input links, 451 worked minutes, 30 break minutes | PASS | Reconstruction version advanced from 1 to 2 |
| Scheduled overnight business date | Shift business date wins | Monday 23:00–Tuesday 03:00 remains Monday | PASS | No `isOvernight` field |
| Unscheduled business date | Local CLOCK_IN date wins | Tuesday 00:30 local materialized as Tuesday | PASS | V1 rule demonstrated |
| Attendance exceptions | Open/blocking/resolved states coexist | LATE resolved; MISSING_PUNCH blocking/open; OVERTIME open | PASS | Shift and WorkSession relations valid |
| Timesheet aggregation | Two sessions feed one date line | 571 worked minutes across two sessions | PASS | WorkSessions are source inputs |
| Timesheet adjustment | Worked time remains stable | Worked 571; adjustment +15; payable 586 | PASS | No worked-time rewrite |
| Multi-branch | Branch breakdown remains recoverable | One line links sessions from two branches | PASS | Breakdown obtained through WorkSession |
| Overtime categories | Structural total is coherent | 480 regular + 106 tier 1 + 0 tier 2 = 586 | PASS | No legal-rule engine tested |
| Payroll snapshot | Later source changes do not alter snapshot | Frozen name, rate and currency remained unchanged | PASS | Employee and PayRate fixtures were modified afterward |
| Retroactive adjustment | Original line remains unchanged | Approved adjustment links original line and later period; gross unchanged | PASS | No historical rewrite |
| HOME overlap limitation | Current DB permits overlap | Second overlapping HOME inserted inside savepoint | PASS | Savepoint rolled back; future exclusion required |
| Publication immutability limitation | Update currently possible | Update succeeded inside savepoint | PASS | Savepoint rolled back; trigger deferred |
| Clock append-only limitation | Update currently possible | Update succeeded inside savepoint | PASS | Savepoint rolled back; trigger deferred |
| Payroll finality limitation | Final line update currently possible | Update succeeded inside savepoint | PASS | Savepoint rolled back; enforcement deferred |
| Invalid pay-rate range | Rejected | PostgreSQL `23514` | PASS | Effective-range checks covered |
| Invalid shift duration | Rejected | PostgreSQL `23514` | PASS | Time-range checks covered |
| Invalid revision number | Rejected | PostgreSQL `23514` | PASS | Version/revision checks covered |
| Invalid event sequence | Rejected | PostgreSQL `23514` | PASS | Sequence checks covered |
| Invalid weekday | Rejected | PostgreSQL `23514` | PASS | Day-of-week check covered |
| Negative session minutes | Rejected | PostgreSQL `23514` | PASS | Nonnegative session checks covered |
| Invalid timesheet range | Rejected | PostgreSQL `23514` | PASS | Period-range checks covered |
| Negative payroll minutes | Rejected | PostgreSQL `23514` | PASS | Nonnegative payroll checks covered |
| Fixture cleanup | No synthetic data remains | Zero `WFTEST-` rows across 22 Workforce tables, PayrollPeriod, User and Branch | PASS | Transaction rollback confirmed independently |

## Check-constraint coverage

The 23 migration checks were tested by category rather than one insert per constraint:

- effective/date ranges;
- shift and session time ranges;
- day of week;
- positive versions and revision numbers;
- nonnegative break, worked, payable, overtime and payroll minutes;
- nonnegative multipliers;
- nonnegative event sequence.

Every exercised invalid category returned PostgreSQL check-violation code `23514`. The migration SQL and direct catalog inspection remain the source of truth for the complete list of 23 installed checks.

## Deferred enforcement confirmed

Savepoint-based tests confirmed that the database currently permits:

- overlapping effective HOME branch assignments;
- updates to SchedulePublication;
- updates to original ClockEvent rows;
- updates to PayrollLine after the period is final.

Every probe was rolled back. These results are expected and must not be interpreted as final design behavior. Cross-row exclusion, append-only triggers and payroll finality remain pending.

## Validation

- Pure effective-stream tests: 5 passed, 0 failed.
- Structural integration results: 28 passed, 0 failed.
- `npx prisma validate`: PASS.
- `npx prisma generate`: PASS with Prisma Client 7.9.1.
- `npx tsc --noEmit`: PASS.
- `npm test`: PASS.
- `npx prisma migrate status`: PASS; database schema up to date.

## Schema changes discovered during testing

None. Structural testing did not require a correction to `prisma/schema.prisma` or a follow-up migration.

No backfill, dual-write, runtime integration, production operation, deployment or push was performed.
