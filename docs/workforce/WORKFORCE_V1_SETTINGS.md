# MAESTRO Workforce V1 — Settings

## Purpose

`/administration/workforce-v1/settings` is the ADMIN-only source for editable Workforce business policy. Code continues to own engines, validation and non-negotiable integrity boundaries; effective-dated database versions own values that can change during normal operations.

Each save creates a complete `WorkforcePolicyVersion` snapshot with a monotonically increasing version, explicit `effectiveFrom`, actor, timestamp and reason. Rows are not edited or physically deleted through the application. Resolution selects the latest version effective on the business date. A future version can therefore be scheduled without changing historical periods.

## Editable policy

General:

- company Workforce timezone;
- pay day;
- Monday–Sunday pay week is visible but fixed while Timesheet and PayrollPeriod use that invariant.

Scheduling:

- weekly scheduled-hours warning threshold;
- preventive overtime warning threshold;
- whether an otherwise valid week may publish with unassigned shifts;
- whether an otherwise valid week may publish with availability warnings.

Clock:

- whether authorized unscheduled work is allowed;
- Shift-link proximity window.

Attendance:

- late-arrival grace;
- early-departure grace;
- long-break threshold;
- no-show threshold;
- missing clock-out threshold.

Overtime legal reference:

- DAY, NIGHT and MIXED ordinary daily minute limits;
- weekly double-overtime minute band;
- legal policy identifier.

The legal section is visually protected. A changed legal value requires explicit confirmation and a detailed reason and receives a new legal policy identifier. Final Overtime calculations retain the exact policy row and value snapshots they used.

## Defaults and existing behavior

The bootstrap version is effective from 1970-01-01 and preserves approved V1 behavior:

- attendance: 5 late, 5 early, 60 long break, 30 no-show and 60 missing-out minutes;
- scheduled-hours and preventive overtime warnings: 48 hours;
- unscheduled work, unassigned publication and availability-warning publication: allowed;
- Shift-link proximity: 720 minutes;
- timezone: `America/Mexico_City`;
- pay week and pay day: Monday;
- legal reference: DAY 480, NIGHT 420, MIXED 450, weekly double band 540 minutes.

## System invariants

These are never editable settings:

- authentication and authorization;
- ClockEvent append-only behavior;
- transaction and idempotency guarantees;
- branch authorization;
- inactive Employment rejection;
- cross-branch Shift overlap prohibition;
- database uniqueness and referential integrity;
- Timesheet and Overtime snapshot finality;
- Monday–Sunday period grain in V1.

## Integration

Attendance reconciliation resolves the effective thresholds and stores them in each exception policy snapshot. Scheduling resolves its effective warning/publication policy for the week. Clock resolves unscheduled-work and Shift-linking policy at event time. Overtime resolves the effective legal policy for the week and refuses to guess if a legal version changes inside one period.

## Validation and authorization

Server-side validation rejects negative/absurd minutes, invalid timezones, invalid weekdays and non-Monday period configuration. Only ADMIN can create a policy version; anonymous and non-admin requests are rejected even if they invoke the Server Action directly.

## DEV validation

The formal additive migration `20260829000000_add_workforce_settings` was applied only to verified DEV `cash-safe-envelopes-dev`. Automated coverage proves defaults, effective-date resolution, invalid-value rejection, non-admin rejection, critical-change confirmation and historical preservation. Authenticated desktop/mobile QA verified labeled controls, audit history and no horizontal document overflow.
