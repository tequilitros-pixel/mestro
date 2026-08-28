# MAESTRO Workforce V1 — Timesheet Implementation Report

## Scope

- Repository: `/Users/joseadansanchez/maestro-dev`
- Branch: `workforce-v1-foundation`
- Approved baseline: `8d83518e97643242ebe6d10b14a714e66d0dcdd7`
- Production: untouched
- Legacy runtime and legacy tables: untouched
- Payroll amount and overtime calculation: explicitly deferred

## Routes

- Manager board: `/administration/workforce-v1/timesheets`
- Employee view: `/workforce-v1/timesheet`

Both routes remain behind the existing Workforce V1 feature flag and authenticated layouts. The manager board requires `ADMIN`; the employee view resolves only the Employee linked to the authenticated User.

## Grain and period

- One `Timesheet` per `Employment + PayrollPeriod`.
- One `TimesheetLine` per business date.
- Payroll periods are canonical Monday-through-Sunday records.
- A line aggregates every reconstructed `WorkSession` assigned to that Employment and business date.
- Work-session links retain session and branch provenance, including multiple branches in the same day.
- Overnight sessions use their Clock/Reconstruction `businessDate`; they are not split at midnight.
- Complete unscheduled sessions are included and visibly marked as not linked to a Shift.
- All totals are integer minutes. No currency, pay amount or overtime is calculated.

## Aggregation and attendance readiness

Open and reviewable Timesheets are recomputed from WorkSessions, published Shifts and Attendance Exceptions. Source fingerprints make unchanged recomputation idempotent.

Readiness states are:

- `READY`: no open integrity concern.
- `NEEDS_REVIEW`: warning or other open issue exists; manager receives an explicit conscious-approval warning.
- `BLOCKED`: incomplete WorkSession, or open critical `MISSING_CLOCK_IN`, `MISSING_CLOCK_OUT` or `INCOMPLETE_BREAK` condition.

Attendance resolution and Clock reconstruction signal affected Timesheets in the same transaction.

## Adjustments

Adjustments are explicit records with positive integer minutes, add/remove direction, mandatory reason, creator/approver audit fields and a unique idempotency key. Adjustments never mutate a WorkSession and cannot make payable minutes negative. Approved or locked Timesheets reject direct adjustments.

## Approval, finality and locking

Approval requires the current optimistic `version` and an approval idempotency key. It snapshots:

- source fingerprint;
- base minutes;
- adjustment minutes;
- effective minutes;
- open issue summary;
- approving actor and timestamp.

Approved totals and lines remain stable. A later Clock or Attendance source change sets `requiresAdjustment` instead of silently rewriting approved history. `LOCKED` is a separate ADMIN-only transition that preserves the approved snapshot for the future Payroll domain; it does not calculate or pay wages.

## DEV migration

Formal additive migration: `20260828000000_add_timesheets_v1`.

Applied only to verified Neon DEV `cash-safe-envelopes-dev` (`ep-red-lake-ats4n9i7`, database `neondb`). Preflight confirmed the existing Timesheet tables were empty. The migration adds Timesheet lifecycle/snapshot fields, PayrollPeriod relation, line aggregation metadata, idempotency constraints and actor relations. It contains no destructive statement and changes no legacy table.

## Automated validation

- Pure Workforce tests: 123 passing, including 15 focused Timesheet rules tests.
- DEV service scenario: unique weekly sheet, seven lines, multi-session day, overnight session, two branches, unscheduled work, blocking incomplete session, warning approval, positive/negative adjustments, idempotency, stale-version rejection, stable approved snapshot, retroactive-change signal, locking, employee ownership and ADMIN authorization.
- Synthetic data prefix: `WFTIMESHEETQA`; cleanup is exact and removes no unrelated DEV data.

## Authenticated functional QA

Desktop manager QA at 1280×900 verified weekly filters, Monday–Sunday grid, 48h30 base total, issue count, multi-session details, +30-minute adjustment to 49h00, approval, approved read-only state and lock affordance. Anonymous access redirected to login.

Mobile manager and employee QA at 390×844 verified filters, daily cards, totals, status/readiness labels, touch-sized actions, employee week selector and Clock problem link. Document width matched viewport width. No route runtime error, React error or broken navigation was observed.

The local server emitted only the existing PostgreSQL adapter SSL/deprecation warnings; no Timesheet runtime failure occurred. The production-style local build completed successfully and retained the preexisting `/control-room` Anthropic missing-auth log during static generation. It is outside Workforce and was not changed. Resend was supplied a process-local dummy value for the build only; no secret, shared configuration or email integration was changed.

## Deferred

- overtime rules;
- wage or monetary computation;
- Payroll finalization/export;
- post-approval compensating adjustment workflow beyond the explicit `requiresAdjustment` signal.
