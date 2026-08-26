# MAESTRO Workforce V1 — Canonical Specification

This document is the in-repository authority for the Workforce V1 foundation. Phase 1A is additive: the legacy clock, schedule, availability and payroll flows remain the only active runtime paths. There is no backfill, dual-write or historical inference.

## Domain boundaries

- `User` is an authentication account, `Employee` is a person, and `Employment` is a time-bounded labor relationship. Either a `User` or an `Employee` may exist without the other. Unknown employment dates remain null.
- `Shift` is authorized planned work only. Attendance, worked-time, timesheet and payroll state do not belong on it.
- `ClockEvent` is an original observed event. It is never synthesized for an administrative decision. Approved `ClockCorrection` records are combined with observed events by a future effective-clock-stream service.
- `WorkSession` is derived and materialized. Its observed inputs remain linked through `WorkSessionClockEvent`; `ClockEvent` has no mutable session foreign key.
- `Timesheet` consumes `WorkSession` records. `TimesheetLine` has employment-and-business-date granularity and may include several work sessions.
- `PayrollLine` consumes an approved timesheet and freezes the minimal identity, rate, currency, minutes, multipliers and monetary totals needed to explain historical pay.

## Identity and employment

`Employee` optionally links to one unique `User` and may have many historical `Employment` records. Employment status is `ACTIVE`, `INACTIVE` or `TERMINATED`; data confidence is `KNOWN`, `LEGACY_UNKNOWN` or `ESTIMATED`. The foundation never assigns `ESTIMATED` or fabricates dates automatically.

`PayRate` belongs to an employment, uses `HOURLY`, `DAILY`, `WEEKLY` or `SALARY`, and has an effective range. `BranchAssignment` belongs directly to an employment and branch, with type `HOME` or `ALLOWED`.

## Time, timezone and availability

Each `Branch` may store an IANA timezone. A shift stores its business date plus absolute start and end instants. Overnight work is derived from instants; there is no `isOvernight` flag.

A scheduled work session inherits `Shift.businessDate`. For unscheduled work, a future reconstruction service derives business date from the effective `CLOCK_IN` in the branch timezone. The unscheduled-overnight policy beyond that rule remains a documented V1 limitation.

`AvailabilityRule` represents recurring weekly availability with the same string time-of-day convention as the legacy schedule. `AvailabilityException` is a dated `AVAILABLE` or `UNAVAILABLE` override.

## Scheduling history

`SchedulePeriod` groups branch planning. `ShiftRevision` is a full relational snapshot, not a JSON diff. Each immutable `SchedulePublication` has relational `SchedulePublicationShift` rows that reference the exact published shift revision.

## Clock, attendance and sessions

Observed clock types are `CLOCK_IN`, `BREAK_START`, `BREAK_END` and `CLOCK_OUT`. Correction types are `MODIFY_OCCURRED_TIME`, `ADD_MISSING_EVENT` and `VOID_EVENT`; statuses are `PENDING`, `APPROVED`, `REJECTED` and `CANCELLED`.

`WorkSession` is `OPEN`, `COMPLETE` or `INCOMPLETE`. Attendance exceptions initially cover late arrival, early departure, missing punch, no-show, unscheduled work, overtime and break anomalies. Location anomalies are deferred with all V1 geofencing work.

## Timesheet and payroll

A timesheet is unique by employment and period and moves through `OPEN`, `REVIEW`, `APPROVED` and `LOCKED`. Lines contain minutes only, not money. Adjustments add, remove or reclassify payable time without rewriting worked time.

The existing weekly `PayrollPeriod` is reused. A `PayrollLine` is unique by payroll period and employment and references exactly one timesheet. `WorkforcePayrollAdjustment` represents a retroactive correction applied in another payroll period without rewriting the original payroll line. No tax, ISR, IMSS or CFDI model is included.

## Authorization and retention

Legacy `User.role` and module permissions remain unchanged. Actor foreign keys use `User`; no parallel role/capability system is introduced in Phase 1A.

`RetentionPolicy` is deferred. Until legal and business review, legacy Workforce history must not be deleted.

## Database constraints deferred to migration design

The future reviewed PostgreSQL migration must address:

- append-only enforcement for `ClockEvent`, `SchedulePublication` and `SchedulePublicationShift`;
- conditional `PayrollLine` immutability after payroll-period finality;
- non-overlapping effective `HOME` branch assignments per employment;
- `Shift.endAt > Shift.startAt`;
- validity of all effective and period ranges;
- consistency between a publication link's `shiftId` and its referenced revision's `shiftId`.

No trigger or database-only constraint is created in Phase 1A because no DEV database identity has been verified.
