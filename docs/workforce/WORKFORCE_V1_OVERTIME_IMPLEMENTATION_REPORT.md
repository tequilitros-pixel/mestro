# MAESTRO Workforce V1 — Overtime V1 Implementation Report

## Boundary

Overtime V1 consumes approved Timesheet/TimesheetLine minutes and classifies time only. It does not read raw ClockEvents or WorkSessions to recalculate work, and it does not calculate wages, multipliers as money, taxes, ISR, IMSS, CFDI or Payroll. Legacy `OvertimeRecord` and `PayrollEntry` remain untouched.

Routes:

- manager: `/administration/workforce-v1/overtime`;
- employee summary: `/workforce-v1/timesheet`.

## Legal baseline and company policy

Legal/reference values are stored in versioned `WorkforcePolicyVersion`, not hidden UI constants:

- DAY ordinary limit: 480 minutes;
- NIGHT ordinary limit: 420 minutes;
- MIXED ordinary limit: 450 minutes;
- weekly DOUBLE band: first 540 overtime-candidate minutes;
- remaining weekly overtime candidates: TRIPLE.

These are Workforce time-unit classifications under the approved Mexico V1 interpretation, not tax or payroll treatment. Company operational warnings are separate Settings fields and do not relabel legal DOUBLE/TRIPLE minutes.

## Deterministic allocation

TimesheetLines are processed by `businessDate` ascending. For each day:

1. approved effective minutes up to the effective jornada limit are ORDINARY;
2. the daily excess becomes an overtime candidate;
3. the unused portion of the 540-minute weekly band becomes DOUBLE;
4. any remainder becomes TRIPLE.

One day may split across DOUBLE and TRIPLE. Every minute reconciles:

`ordinary + double + triple = approved effective minutes`.

Multiple sessions and approved Timesheet adjustments are already represented in the line total and are not applied again. Multiple branches share one Employment weekly bucket. Overnight work remains on the approved Timesheet business date. Paid vacation/holiday/sick time is deferred because it is not explicitly modeled.

The supplied narrative example “Mon 8h + Tue–Sat 10h = 50h” is arithmetically inconsistent: it totals 58h. The canonical 50-hour regression uses five 10-hour DAY jornadas and correctly produces 40h ordinary, 9h double and 1h triple.

## Jornada history

`EmploymentJornadaPolicy` is effective-dated and supports DAY, NIGHT and MIXED. Each business date must resolve to exactly one policy. Missing or overlapping coverage blocks calculation rather than inferring a jornada from Shift times. Mid-week jornada changes are supported honestly per line.

## Preview, finality and stale state

- `PREVIEW`: derived freely for an OPEN or not-yet-finalized Timesheet.
- `FINAL`: persisted only from APPROVED/LOCKED Timesheet snapshots.
- `STALE`: the approved Timesheet later reports `requiresAdjustment` or its frozen source identity no longer matches.

Finalization stores Timesheet version/approval timestamp, approved/ordinary/double/triple totals, weekly band, legal policy identifier, exact Workforce policy version, source fingerprint, actor, calculation timestamp and a daily explanation snapshot. A later settings change never rewrites a finalized result. A retroactive Timesheet source change marks the calculation STALE and preserves its numbers for a future compensating workflow.

One unique calculation exists per Timesheet. Serializable transactions, bounded conflict retries and the unique constraint make repeated and concurrent finalization idempotent.

## Compensation decision

Classification is independent of HOURLY, DAILY, WEEKLY or SALARY pay-rate type. Overtime V1 classifies approved time for audit; Payroll must later decide eligibility and monetary formulas explicitly. No salary formula was invented.

## UX and authorization

The ADMIN board shows employee, period, approved, ordinary, double and triple totals, state and a daily expandable explanation including weekly overtime before the day and remaining double allowance. Missing jornada can be registered with an effective date. The employee sees their own finalized classification without pay value.

Manager routes/actions require ADMIN. Employee access resolves only the Employee linked to the authenticated User. Anonymous access redirects to login. Branch filtering never fragments the Employment-wide weekly calculation.

## Migration, tests and QA

Formal additive migration: `20260829010000_add_workforce_overtime_v1`, applied only to verified DEV. It creates Workforce-native jornada, calculation and line structures with reconciliation constraints; it does not alter legacy overtime/payroll tables.

Pure suite: 150 passing tests. Coverage includes exact limits, one minute overtime, DAY/NIGHT/MIXED, multiple days, exactly 540 minutes, 541 minutes, partial boundary split, 50-hour example, positive/negative Timesheet adjustment, ordering, jornada change/gap/overlap, policy consumers and minute reconciliation.

DEV service validation covers OPEN preview, APPROVED final, stale preservation, effective policy resolution, ADMIN/non-admin, idempotent and concurrent finalization, one logical result and zero legacy writes. Desktop 1280×800 and mobile 390×844 QA verified totals, filters, cards, daily explanation and no document overflow. Existing PostgreSQL adapter SSL/deprecation warnings remain unrelated.

The follow-up Settings gate also verified through the authenticated UI that a
later persisted policy version does not mutate the policy identifier, jornada
limit, weekly double band, or ordinary/double/triple minutes stored in an
existing FINAL calculation. Final reads use the stored policy and daily line
snapshots rather than reclassifying against current Settings.
