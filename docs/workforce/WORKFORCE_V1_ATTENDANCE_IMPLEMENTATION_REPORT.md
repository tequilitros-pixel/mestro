# Workforce V1 — Attendance Exceptions

## Boundary

Attendance compares the effective published `Shift` with the materialized
`WorkSession`. It does not alter Clock facts, decide payable time, or write
legacy timeclock/payroll models. The manager experience is an exception inbox,
not a second raw timeclock table.

## Exception types and severity

V1 derives:

- `LATE_ARRIVAL` — WARNING
- `EARLY_DEPARTURE` — WARNING
- `NO_SHOW` — CRITICAL
- `UNSCHEDULED_WORK` — WARNING
- `MISSING_CLOCK_IN` — CRITICAL
- `MISSING_CLOCK_OUT` — CRITICAL
- `INCOMPLETE_BREAK` — WARNING
- `LONG_BREAK` — WARNING

Legacy enum values remain available for compatibility but are not emitted by
the V1 engine. Early clock-in is deferred because it has no confirmed
high-value operational action in V1.

## Policy

The typed company-policy defaults are:

- late grace: 5 minutes
- early-departure grace: 5 minutes
- long-break threshold: 60 minutes
- no-show threshold: 30 minutes after scheduled start
- missing-clock-out threshold: 60 minutes after scheduled end

These are DEV company-policy defaults, not legal rules. Policy versioning is
deferred; current policy applies to unresolved/current evaluation while final
manager decisions remain historical.

## Evaluation algorithm

Only assigned, currently `PUBLISHED` Shifts participate in plan comparison.
The current Shift row is the effective schedule because post-publication edits
update it and append `ShiftRevision` history. Draft, cancelled, unassigned, and
future shifts do not generate employee no-shows. A WorkSession linked to a
cancelled/non-effective Shift is treated as unscheduled work.

Comparisons use absolute instants. Overnight sessions retain the original
Shift `businessDate`. An active open session is not considered missing its
clock-out until the scheduled end plus threshold. `INCOMPLETE` WorkSession
status preserves invalid/incomplete break evidence; break minutes over policy
produce a separate long-break exception without deciding paid status.

## Auditability, identity, and idempotency

Each derived record stores Branch, business date, scheduled/actual snapshots,
difference minutes, policy snapshot, a stable logical `derivationKey`, and an
evidence fingerprint. The fingerprint is unique. Repeating reconciliation with
unchanged facts only updates `evaluatedAt`; it cannot duplicate an exception.

When evidence no longer qualifies, an OPEN record is automatically RESOLVED
with a system explanation rather than deleted. A manually RESOLVED/DISMISSED
record with identical evidence never reopens. Materially different evidence
gets a new fingerprint/generation, preserving both the prior decision and the
new issue.

## Lifecycle and correction interaction

Manager actions are `RESOLVED` and `DISMISSED`, recording actor, time, and a
required resolution note. Only ADMIN may perform the V1 action. Employees
cannot self-dismiss.

Reconciliation runs synchronously after WorkSession reconstruction (including
approved ClockCorrection), after published Shift creation/update/cancellation,
after schedule publication, and whenever the Attendance Center is queried.
Thus a correction that changes an effective 18:20 clock-in to 18:02 resolves
the stale lateness automatically while retaining its history.

## Manager center

`/administration/workforce-v1/attendance` provides open/critical counts,
Branch/date/employee/type/severity/status filters, responsive exception cards,
schedule and actual snapshots, observed ClockEvent summary, recommended action,
resolution controls, and a shortcut to the existing ClockCorrection queue.
The query result also exposes counts by Branch and type for the future Command
Center contract.

Employee exception UI is deferred to V1.5; manager exception management is the
priority and employee self-resolution remains prohibited.

## QA

Pure tests cover on-time, grace, lateness, early departure, no-show timing,
future/unassigned/cancelled shifts, cancelled-shift work, unscheduled work,
active/missing clock-out, missing clock-in, incomplete/long breaks, overnight,
effective Shift revision, and Branch authorization. DEV integration verifies
idempotent reconciliation, no duplicates, historical finality, materially
changed evidence, correction-style WorkSession reconstruction, automatic stale
resolution, ADMIN resolution, and non-admin denial.

Authenticated browser QA verified filters, detail, correction link, resolution,
and recalculation at 1280×800 and 390×844 with no horizontal overflow or
Attendance runtime/console errors. Anonymous access redirected to login.
Synthetic `WFATTENDANCEQA` data and derived `WFCLOCKQA` attendance rows were
removed after QA.

## Schema and migration

Migration `20260827220000_add_attendance_exceptions_v1` is additive: it extends
existing enums, adds audit/identity/snapshot fields and indexes, and relates
exceptions directly to Branch. The target DEV table was empty, so no invented
backfill was needed. The migration was inspected and applied only to the
verified DEV database. Production and all legacy attendance/timeclock/payroll
tables were untouched.
