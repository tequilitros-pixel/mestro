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

## Migration and verification evidence

Migration `20260830000000_add_workforce_payroll_v1` is additive, fail-closed
against non-empty Workforce skeleton tables, and was applied only to verified
DEV. It does not alter legacy PayrollEntry, PayrollAdjustment, OvertimeRecord
or TimeClockEntry. Seven default categories were seeded.

Evidence is separated deliberately:

- **Payroll unit tests (16):** explicit 40h/9h/1h example, Mon–Wed $60 and
  Thu–Sun $65 daily rate mapping, HALF_UP fractional-cent reconciliation,
  zero-work approved input, NIGHT snapshot pricing, MIXED snapshot pricing,
  multi-branch aggregation at Employment grain, money invariant, negative-pay
  rejection, unsupported rate, mixed currency, readiness, missing/overlapping
  rate helpers, ADMIN authorization and ownership predicate.
- **Verified DEV service/integration script:** missing-rate and stale-source
  blockers before calculation; two-process concurrent calculation producing one
  canonical line; repeat calculation; reason validation; earning/deduction and
  adjustment idempotency; non-admin denial for every management mutation;
  stale/concurrent approval; Timesheet lock; frozen APPROVED and PAID snapshots;
  retroactive reason/amount/admin/audit/idempotency checks; guessed-ID ownership
  isolation; payment idempotency; and zero legacy PayrollEntry writes. The
  synthetic records are allowlisted and cleaned after QA.
- **Authenticated route QA:** normal DEV login was used. Anonymous manager and
  employee routes redirected to login. A synthetic OPERATOR was redirected away
  from the ADMIN payroll route. An ADMIN exercised the manager board, source
  links, earning, deduction, approval, payment and retroactive form. The linked
  employee saw only its PAID statement; READY manager data was absent.
- **Desktop QA (1280×800):** period/status counts, worksheet, source/audit,
  calculation, read-only APPROVED/PAID states and retroactive workflow passed;
  document width equaled viewport width.
- **Mobile QA (390×844):** employee cards, totals and stacked actions passed;
  document width equaled viewport width (390px), with no horizontal overflow.

The development PostgreSQL SSL/deprecation warnings are pre-existing and do
not change payroll results.

## Traceability and retroactive UX

Manager detail exposes the source Timesheet status, approved/effective minutes,
version and direct board link, followed by the FINAL Overtime ordinary/double/
triple minutes, policy version and direct board link. Approval/payment actor and
timestamps are visible. APPROVED and PAID hide ordinary adjustment controls and
instead expose a confirmed, idempotent retroactive form plus immutable audit
history. The period header reports Employees, READY, BLOCKED, APPROVED, PAID and
total Operational Payable from the actual board scope.

## Deferred

Fiscal payroll, CFDI/PDF, taxes, bank transfers, partial payments, automatic
retro settlement and branch cost allocation are deferred. Legacy payroll URL
and models remain untouched pending a separate cutover gate.
