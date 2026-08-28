# MAESTRO Workforce V1 — Payroll V1 Implementation Report

## Scope

Payroll V1 is a Workforce-native operational gross-pay calculation. It consumes
approved/locked Timesheet, FINAL Overtime daily snapshots, effective PayRate,
PayrollPeriod and effective Workforce Settings. It never reads ClockEvent or
legacy PayrollEntry as a payroll source and performs no dual-write.

This is not ISR, IMSS, INFONAVIT, CFDI, withholding, SAT submission or a fiscal
net-pay engine. UI and employee statements are labeled operational/non-fiscal.

## Money and rate resolution

Only `HOURLY` PayRate is supported safely in V1. DAILY, WEEKLY and SALARY block
readiness instead of using an invented formula. Each persisted Overtime daily
line resolves exactly one effective-dated PayRate for its business date. Gaps,
overlaps, missing currency, unsupported rate type and mixed currency block.
This correctly supports a Mon–Wed / Thu–Sun rate change and never multiplies
weekly overtime by an arbitrary current rate.

Minutes remain integers. Prisma Decimal calculates each daily ordinary,
double and triple component and rounds that component to currency cents using
`ROUND_HALF_UP`; totals are sums of rounded components. For $60 MXN, 40h + 9h
double + 1h triple produces $2,400 + $1,080 + $180 = $3,660. Positive earnings
are added to gross; explicit deductions are subtracted to produce Operational
Payable. Negative payable is blocked.

## Adjustments and configurable categories

`WorkforcePayrollCategory` provides editable name, EARNING/DEDUCTION direction
and active state in Workforce Settings. Defaults cover bonus, commission,
attendance bonus, other earning, advance/loan, uniform and other authorized
deduction. No executable formula editor exists. Each pre-approval adjustment
stores positive amount, direction, category-name snapshot, reason, actor,
timestamp and idempotency key. Approved lines reject direct edits.

The existing Workforce-native `WorkforcePayrollAdjustment` is reused for
post-approval RETROACTIVE records. The original PayrollLine stays frozen and
the adjustment points to a future settlement period. Fiscal treatment and
automatic carry-forward are deferred.

## Lifecycle and finality

PayrollLine has DRAFT/READY/APPROVED/PAID, optimistic version and unique
approval/payment keys. READY may recompute while preserving manual
adjustments. APPROVED snapshots employee, daily rates, currency, daily tier
minutes/pay, totals, Timesheet version, Overtime/policy identity, source
fingerprint, actor and timestamp. APPROVED locks the Timesheet in the same
serializable transaction. PAID records actor, time and optional reference.

Final reads use stored PayrollLine and rate-segment snapshots. Later PayRate,
Settings or retroactive source changes cannot rewrite APPROVED/PAID money.
Bounded serialization retries and unique keys provide one logical result for
concurrent calculate, adjustment, approval and payment operations. Period bulk
approval is all-or-nothing for READY lines.

## Routes, authorization and privacy

- ADMIN worksheet: `/administration/workforce-v1/payroll`.
- Employee statement: `/workforce-v1/payroll`.
- Payroll policy/categories: `/administration/workforce-v1/settings`.

ADMIN actions reauthorize server-side. Anonymous users redirect to login;
non-admin management redirects to the existing denied destination. Employee
queries are scoped by authenticated User → Employee and expose only own
APPROVED/PAID statements. General Scheduling/Workforce boards expose no rate
or payroll totals.

## Migration, tests and QA

Migration `20260830000000_add_workforce_payroll_v1` is additive, fail-closed
against non-empty Workforce skeleton tables, and was applied only to verified
DEV. It does not alter legacy PayrollEntry, PayrollAdjustment, OvertimeRecord
or TimeClockEntry. Seven default categories were seeded.

The 161-test suite covers Decimal components, rounding, money invariant,
earnings, deductions, negative payable, unsupported types, currency mismatch,
readiness, authorization, ownership, ordinary/double/triple classification and
midweek rates. DEV service QA additionally verifies uniqueness, preserved
manual adjustments, stale-version rejection, concurrent approval idempotency,
Timesheet lock, frozen original after retro adjustment, PAID idempotency, own
statement and zero legacy writes.

Authenticated desktop 1280×800 QA verified period header, worksheet,
calculation explanation, adjustments, approval/lock and payment. Mobile
390×844 uses stacked employee cards and statement sections; manager, employee
and Settings pages had no document overflow. The known development CSP/React
Refresh log and PostgreSQL driver warnings remain unrelated.

## Deferred

Fiscal payroll, CFDI/PDF, taxes, bank transfers, partial payments, automatic
retro settlement and branch cost allocation are deferred. Legacy payroll URL
and models remain untouched pending a separate cutover gate.
