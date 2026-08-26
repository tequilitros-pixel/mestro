# MAESTRO Workforce V1 — Schema Report

## Scope

Repository baseline: `9006d37ee143a9e6dafb16ea91577789d545c50f` on `workforce-v1-foundation`.

Phase 1A adds schema and documentation only. It does not create or apply a migration, connect to a database, backfill records, enable dual-write, or change legacy runtime behavior.

## Models added

- Identity: `Employee`, `Employment`, `PayRate`, `BranchAssignment`.
- Availability: `AvailabilityRule`, `AvailabilityException`.
- Scheduling: `SchedulePeriod`, `Shift`, `ShiftRevision`, `SchedulePublication`, `SchedulePublicationShift`.
- Clock/session/attendance: `ClockEvent`, `ClockCorrection`, `WorkSession`, `WorkSessionClockEvent`, `AttendanceException`.
- Timesheet: `Timesheet`, `TimesheetLine`, `TimesheetLineWorkSession`, `TimesheetAdjustment`.
- Payroll: `PayrollLine`, `WorkforcePayrollAdjustment`.

## Existing models extended

- `User`: optional inverse employee relationship and actor-history relations only; legacy `role` is unchanged.
- `Branch`: nullable IANA `timezone` plus inverse Workforce relations. Nullable avoids inventing a timezone during a future migration/backfill.
- `PayrollPeriod`: inverse relations for new payroll lines and retroactive adjustments. Existing weekly grain and status lifecycle are reused unchanged.

Legacy `TimeClockEntry`, `ScheduledShift`, `ScheduleWeek`, `SalaryRate`, `PayrollEntry`, `PayrollAdjustment`, availability models and authorization behavior are unchanged.

## Models and capabilities deferred

- `RetentionPolicy`.
- Parallel `Role`, `Capability`, `RoleCapability` and `UserRoleAssignment` models.
- An effective-clock-stream table; the stream is a future derived service result.
- Payroll cost allocation and all tax/ISR/IMSS/CFDI models.
- Geofencing and location capture for the new clock foundation.
- Backfill, dual-write and migration of legacy history.

## Enums

The foundation adds enums for employment status and confidence, pay-rate type, branch-assignment type, dated availability type, schedule/shift status, clock event/correction, decision status, work-session status, attendance type/severity/status, and timesheet status/adjustment type. `ClockEvent.source` remains a string because the canonical specification does not approve a stable source vocabulary. Correction, timesheet-adjustment and retroactive-payroll workflows share the same small decision-status enum.

`LOCATION_ANOMALY` is intentionally omitted until location features are in scope. No administrative or synthetic clock-event type exists.

## Relations and deletion rules

Historical identity, employment, shift, publication, clock, session, timesheet and payroll relations use explicit `Restrict`. Optional administrative actor references that should not destroy history use `SetNull`. `Employee.userId` is nullable and unique, so Employee and User lifecycles remain independent.

`WorkSessionClockEvent` and `TimesheetLineWorkSession` are relational join models. Publications point to exact `ShiftRevision` rows; no ID arrays or JSON snapshots are used as the primary scheduling history.

## Indexes and uniqueness

Pragmatic indexes cover employment status, effective rates and assignments, branch/employment shift lookup, business dates, clock event timelines, attendance queues, timesheet periods and payroll-period employment uniqueness. Unique constraints cover employee-account linkage, publication versions, shift revision numbers, publication shift membership, clock-event idempotency, session input ordering, timesheet periods and lines, and payroll lines.

`ClockEvent.idempotencyKey` is globally unique. The V1 contract requires clients/integrations to generate globally collision-resistant keys; this is safer than allowing the same operation to be accepted through another source/device namespace.

## DB-only constraints pending

- Append-only triggers: `ClockEvent`, `SchedulePublication`, `SchedulePublicationShift`.
- Conditional `PayrollLine` immutability after the existing `PayrollPeriod` reaches final status.
- Temporal non-overlap for effective `HOME` `BranchAssignment` records.
- Positive shift duration and valid effective/period ranges.
- Publication link consistency between `shiftId` and `shiftRevision.shiftId`.

These require migration SQL review against a verified DEV database and are not implemented in Phase 1A.

## Design deviations

- The new retroactive payroll model is named `WorkforcePayrollAdjustment` because the legacy schema already owns `PayrollAdjustment` with a different weekly bonus/deduction meaning. The legacy model is not renamed or modified.
- Workforce-specific enum names are prefixed where the legacy schema already has a nearby or potentially ambiguous concept.
- `Branch.timezone` is nullable in the additive foundation. A future explicit data decision must populate valid IANA names before new Workforce runtime logic relies on it.
- `SchedulePeriod.createdById`, `Shift.createdById`, `ShiftRevision.changedById`, `SchedulePublication.publishedById`, and correction/adjustment creator fields remain required and restrictive because the canonical fields require an actor. Optional approval/resolution actors use `SetNull`.

## Questions for migration design

- Which verified Neon DEV branch/database will receive the migration?
- What explicit constraint or validation will guarantee IANA timezone names?
- Should effective-range exclusion constraints treat touching boundaries as allowed?
- Should immutable-row triggers permit only tightly controlled operational metadata, or reject every update/delete?
- Should the publication-link consistency rule be enforced through a composite foreign key or a trigger?
