# Workforce V1 end-to-end certification

Date: 2026-08-29  
Environment: verified DEV Neon (`ep-red-lake-ats4n9i7/neondb`)  
Production: untouched

## Connected results

Two independent service-driven runs passed. Neither runner nor application wrote legacy `ScheduledShift`, `TimeClockEntry`, `OvertimeRecord`, or `PayrollEntry` rows.

| Run | Period | Clock events | Corrections | Sessions | Overtime ordinary/double/triple | Frozen payroll |
| --- | --- | ---: | ---: | ---: | --- | ---: |
| `cert1b` | 2031-02-03—2031-02-09 | 28 | 2 | 7 | 2970 / 455 / 0 min | MXN 4,132.50 |
| `run2` | 2031-03-03—2031-03-09 | 28 | 2 | 7 | 2970 / 455 / 0 min | MXN 4,132.50 |

Both runs exercised Employment with a midweek historical PayRate change, weekly Availability plus an exception, HOME and ALLOWED branches, publication and post-publication ShiftRevision, six scheduled shifts, one overnight shift, one unscheduled session, multiple breaks, approved clock corrections before and after approval, Attendance resolution, Timesheet adjustment/approval, Overtime finalization, settings-effective late tolerance, Payroll earnings/deductions, approval freeze, retroactive adjustment, and PAID transition. Append-only ClockEvents remained unchanged and downstream records retained their links.

## Authenticated UI QA

The synthetic `cert1b` ADMIN/Employee session was authenticated through the normal login flow. Admin Workforce, Timesheets, Payroll, employee calendar, Clock, Timesheet and Payroll surfaces rendered on 1440×900 and 390×844. Critical mobile pages reported `scrollWidth === clientWidth` (390 px); no broken navigation or runtime exception was observed.

The development console reports React Refresh attempting `unsafe-eval` under the project's CSP. This is a `next dev` tooling warning, not a Workforce domain exception; the production build gate is recorded separately.

## Cleanup and retained evidence

All synthetic identities use the `wfe2ecert_`/`WFE2E-CERT-` namespace. Runs with immutable ClockEvents preserve their auditable domain chain and deactivate the synthetic user instead of deleting append-only facts. `run2` performed this cleanup automatically. `cert1b` was retained temporarily for authenticated browser QA and must be deactivated after QA. Shared SchedulePeriod/Publication containers and historical policy versions are not deleted; certification-specific employee links are isolated by namespace.

Several failed DEV attempts were preserved under their own QA namespaces after network/timeout failures because ClockEvent deletion is correctly forbidden. They contain no production data and their synthetic users are inactive.

## Verification gates

- TypeScript: PASS (`tsc --noEmit`).
- Focused ESLint: PASS.
- Workforce/full test suite: PASS, 171/171.
- Prisma validate/generate/migrate status: PASS; 13 migrations, DEV schema up to date, no schema change in this certification.
- Production build: PASS with a process-local Resend dummy. The pre-existing Control Room Anthropic authentication message remained non-fatal and unrelated to Workforce.
- Production clock rejection test: PASS.
