# Workforce V1 — Controlled clean rewrite plan

Fecha: 2026-08-26

## Decision

Adopt a controlled clean rewrite with one active source of truth per mode. Cancel shadow dual-write as the primary strategy. Preserve its design documents as research, but do not implement an outbox, replay processor or permanent adapters without a newly demonstrated need.

For DEV data choose **B: reset Workforce-only test data and reseed V1**, after a reviewed reset plan and a compact comparison export. Preserve User, authentication, permissions, Branch, geofence, POS, cash, inventory and all non-Workforce data. Current legacy Workforce data is small, incomplete test history: 1 SalaryRate, 3 ScheduleWeek, 28 ScheduledShift, 10 TimeClockEntry, 1 edit request, 1 OvertimeRecord, 2 PayrollPeriod and 2 PayrollEntry. V1 currently contains controlled-backfill artifacts (4 Employee, 4 Employment, 1 PayRate, 7 WorkSession and 29 migration records) rather than a complete runtime dataset.

## Current legacy architecture

```text
User + UserBranch + User.hourlyRate/SalaryRate
  ├─ EmployeeAvailabilityRule/Exception
  ├─ ScheduleWeek + ScheduledShift
  │    ├─ ScheduleEvent/templates
  │    ├─ AvailabilityOverrideAudit
  │    └─ ShiftChangeRequest
  ├─ TimeClockEntry + TimeClockEditRequest
  │    ├─ geofence/kiosk/offline sync
  │    ├─ overtime calculation
  │    └─ payroll/analytics
  └─ OvertimeRecord + PayrollAdjustment
       └─ PayrollPeriod + frozen PayrollEntry
```

The same data is read by employee calendar/history/hours/requests, administration schedule/timeclock/personnel, payroll reports/analytics and kiosk flows. Legacy payroll computes directly from TimeClockEntry, ScheduledShift, SalaryRate/User.hourlyRate, overtime and adjustments. This is the parallel calculation chain that the rewrite must remove.

## Dependency graph and cross-module safety

| Legacy area | Writers | Readers/UI | Other dependencies | V1 replacement | Deletion blocker |
|---|---|---|---|---|---|
| User labor fields | personnel and kiosk actions | personnel admin, schedule employee picker, payroll | authentication, sessions, permissions, POS and many non-Workforce relations | Employee/Employment/PayRate/Assignment; User retained for identity | Separate labor state/rate/branch semantics without changing auth |
| AvailabilityRule/Exception | availability actions and copy-week | employee availability and admin schedule conflict checks | Schedule publish/edit validation | AvailabilityRule/AvailabilityException | V1 enum parity, recurring/effective dates and UI replacement |
| ScheduleWeek | schedule draft/publish/unpublish | employee calendar, availability lock, shift requests | publication visibility and payroll locks | SchedulePeriod/Publications | Branch-specific periods and explicit publication workflow |
| ScheduledShift | schedule/events/templates/shift-request actions | calendar, clock matching, kiosk, payroll, analytics | ScheduleEvent, TimeClockEntry, AvailabilityOverrideAudit, ShiftChangeRequest | Shift/Revisions/Publications | Replace every FK-dependent request/audit/template/event flow |
| TimeClockEntry | personal/kiosk/manual/offline actions; correction approval | clock widget/history/hours/admin; overtime/payroll/analytics | ScheduledShift, geofence alerts, edit requests | ClockEvent -> WorkSession | New clock UX/API, correction engine and all downstream reads |
| TimeClockEditRequest | employee request/admin review | request manager/history | mutates TimeClockEntry; payroll period lock | ClockCorrection | Native immutable event correction UX and approvals |
| OvertimeRecord | overtime derive/review jobs/actions | overtime manager, payroll, analytics | branch policy, User.hourlyRate | Timesheet payable tiers/policy | Timesheet derivation and approval parity |
| PayrollPeriod | payroll submit/approve/pay/reopen | payroll UI and periodLock | PayrollEntry and V1 PayrollLine/adjustments already reference it | **Reuse** PayrollPeriod | Adapt statuses/workflow without breaking lock or V1 FKs |
| PayrollEntry | payroll submission transaction | frozen payroll views/analytics | User and PayrollPeriod | PayrollLine | Approved Timesheet, PayRate/currency and adjustment snapshot parity |

Cross-module searches found no direct POS, cash-cut or inventory reads of Workforce legacy tables. Their shared dependencies are User, Branch, navigation/permissions and global dashboard links; those shared models/routes must remain stable. ScheduleEvent and scheduling templates are adjacent scheduling features, not standalone modules: retain them initially and adapt their shift creation to V1. Notification-rule infrastructure does not directly query the listed legacy models, but any future schedule/timeclock notification trigger must be re-audited before legacy removal. No Workforce cron was found; overtime refresh is action-driven.

## Data value analysis

| Data | Value | Treatment before reset |
|---|---|---|
| User, auth, roles, permissions | WORTH PRESERVING | Never reset; create explicit Employee links only for QA workers |
| Branch/geofence | WORTH PRESERVING | Never reset; add trustworthy timezone before V1 scheduling/clock QA |
| 28 legacy shifts / 10 entries | MUST PRESERVE FOR COMPARISON only | Export IDs, instants, branch/user, business date and minute totals; parity already proved |
| 2 PayrollPeriod / 2 PayrollEntry | MUST PRESERVE FOR COMPARISON only | Export frozen snapshot; decide whether the shared PayrollPeriod rows remain or are reset in a separately approved plan |
| SalaryRate/overtime/edit request | USEFUL ONLY FOR TEST REFERENCE | Export minimal fixtures, then recreate correct V1 cases |
| Empty legacy availability | SAFE TO DISCARD | No migration engineering |
| Controlled V1 backfill rows/mappings | SAFE TO DISCARD after report preservation | Replace with reproducible native V1 seed |

No reset is authorized by this plan. Before execution, enumerate exact rows and inbound FKs, export comparison JSON without secrets, take a DEV database restore point, and obtain explicit reset authorization.

## Target runtime architecture

User remains authentication identity; Employee/Employment becomes labor identity. Availability feeds scheduling constraints. Published Shift revisions supply expected work. Native ClockEvents and approved corrections produce one effective stream. A deterministic engine reconstructs WorkSession; attendance detection creates exceptions; approved Timesheets define payable minutes; PayrollLine consumes only approved Timesheet plus explicit PayRate/currency and adjustments.

There are no permanent legacy adapters. Temporary DEV-only seed/reset utilities must be removable and must not be imported by runtime.

## WorkSession engine contract

One pure deterministic engine consumes ordered original ClockEvents plus approved ClockCorrections and returns effective events, WorkSessions and structural exceptions. It must support normal/overnight work, duplicate void, time modification, missing punch, unscheduled work and CLOCK_IN/BREAK_START/BREAK_END/CLOCK_OUT. Break events are included from the first native clock design. Shift state never carries attendance state.

Required invariants: immutable ClockEvent identity; deterministic order/tie-break; no negative duration; incomplete sequences produce INCOMPLETE plus exception; businessDate follows matched Shift or explicit branch-zone policy; unknown is never coerced to zero; reconstruction version is recorded.

## Route strategy

Build isolated DEV routes under `/workforce-v1` and `/administration/workforce-v1` while legacy routes remain unchanged. This prevents mixed reads inside a page and makes manual/mobile QA unambiguous. A typed server-only `WORKFORCE_V1_ENABLED` flag may expose navigation/routes in DEV, but does not dual-write or switch individual repositories underneath one route.

When the entire vertical slice passes, replace the existing `/timeclock`, `/timeclock/calendar`, `/timeclock/availability`, `/timeclock/requests`, `/timeclock/payroll`, `/administration/schedule` and personnel-timeclock routes in one controlled cutover commit. Then remove the temporary V1 prefixes and flag. Preserve route permission mappings and redirects deliberately.

## Reproducible QA seed

Design a Workforce-only seed referencing preserved QA User and Branch rows. It should create: at least 6 employees; active/inactive employments; HOME and ALLOWED assignments across 3 timezone-configured branches; explicit MXN hourly/daily rates; recurring availability and exceptions; draft/published/revised/cancelled normal and overnight shifts; on-time, late, early, missing, unscheduled and multi-branch ClockEvents; complete breaks and break anomaly; approved/pending corrections; WorkSessions/exceptions; open/approved Timesheets; overtime tiers; adjustments; and a PayrollPeriod/PayrollLine comparison fixture.

Seed IDs must be deterministic and idempotent. Reset scope must be an explicit allowlist of Workforce V1 tables and QA-owned records—never User, Branch or a broad schema wipe.

## Implementation order

1. **Employment foundation and DEV QA seed contract.** Employee/Employment/BranchAssignment/PayRate repositories, authorization and native validation. Configure branch timezones.
2. **Effective clock stream + WorkSession engine (pure).** Complete semantics before exposing a clock that would produce ambiguous time.
3. **Availability runtime.** Native rules/exceptions and employee UI.
4. **Scheduling runtime.** Period, Shift, revision/publication, event/template adapters and manager/employee calendar.
5. **Native clock vertical slice.** Personal, kiosk and offline ClockEvents including breaks; reconstruction and recent/history reads.
6. **Corrections and AttendanceException.** Request/decision flow and detectors.
7. **Timesheet/payable time.** Lines, links, adjustments, review/approval and MY HOURS.
8. **Overtime policy derivation.** Remove direct OvertimeRecord computation after parity.
9. **Payroll.** Reuse PayrollPeriod; generate PayrollLine only from approved Timesheet and explicit snapshots.
10. **Manager command center and complete employee experience.** Coverage, working/late/missing, risk and approvals.
11. **DEV cutover and legacy deletion.** Switch routes/readers, run regression/mobile tests, then remove dead actions/models in dependency order.

The engine moves earlier than the suggested order because native ClockEvent semantics must be executable and testable before clock UI starts writing facts.

## Experience targets

Employee V1: TODAY (shift, branch, hours, status, clock/break controls), WEEK, AVAILABILITY, MY HOURS (worked/payable/exceptions) and REQUESTS. Manager V1: COMMAND CENTER, SCHEDULE with revisions/publication, ATTENDANCE exceptions, TIMESHEET review/approval and PAYROLL review/post.

## Test gates

Each module requires unit tests, database integration/structural tests, full route/action tests, manual desktop UI and relevant mobile/offline tests. Security tests verify every Server Action/API independently authorizes and derives User/Employment/Branch server-side. Time tests cover IANA zones, DST policy, overnight and retry ordering. No next domain begins while two sources can mutate the same concept in V1 mode.

Global gates: Prisma format/validate/generate; TypeScript; all tests; clean migration status; deterministic seed twice; reset scope dry-run; no cross-module regressions; manual employee/manager journeys; documented rollback commit.

## Cutover and deletion

Legacy deletion occurs only after its replacement exists, every reference/FK is moved, DEV validation is complete and Git provides a known rollback commit. First stop legacy routes/writes in V1 mode, then verify no runtime imports/queries, then remove UI/actions, then dependent request/audit models, and only afterward create destructive schema migration. PayrollPeriod is retained unless a later design proves replacement necessary. User and Branch are never part of Workforce deletion.

The clean rewrite is ready to begin with the employment foundation, but no runtime or destructive work is authorized by this document.
