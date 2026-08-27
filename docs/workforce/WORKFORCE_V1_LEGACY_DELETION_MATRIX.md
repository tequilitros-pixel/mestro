# Workforce V1 — Legacy deletion matrix

Nothing in this matrix is authorized for deletion now.

| Legacy item | Current dependents | V1 replacement | Data value | Delete now? | Delete after? | Blocker |
|---|---|---|---|---|---|---|
| User | Auth/session, permissions, personnel, POS, cash, inventory, events, all Workforce | User linked optionally to Employee | WORTH PRESERVING | NO | NEVER | Shared application identity |
| User.hourlyRate | personnel, overtime, payroll UI/calculation | active PayRate | TEST REFERENCE | NO | Field only, after all readers move | Explicit currency and payroll parity |
| UserBranch as labor assignment | personnel, clock branch access, kiosk | BranchAssignment | WORTH PRESERVING as access evidence | NO | Possibly reuse for non-labor access | Separate app access from labor assignment |
| SalaryRate | personnel update, payroll historical lookup | PayRate | TEST REFERENCE | NO | YES | Explicit currency and all payroll readers moved |
| EmployeeAvailabilityRule | availability actions/helpers, schedule conflict checks | AvailabilityRule | EMPTY / SAFE TO DISCARD | NO | YES | V1 action/UI and enum parity |
| EmployeeAvailabilityException | availability actions/helpers, schedule conflict checks | AvailabilityException | EMPTY / SAFE TO DISCARD | NO | YES | V1 action/UI and copy-week parity |
| AvailabilitySettings | availability deadline/UI | Reuse or V1 configuration | WORTH PRESERVING | NO | Decide later | Not equivalent to employee availability rows |
| ScheduleWeek | schedule actions, employee calendar, availability, shift requests | SchedulePeriod/Publications | TEST REFERENCE | NO | YES | Branch periods, publish/unpublish replacement |
| ScheduledShift | schedule/actions/UI, kiosk, clock matcher, payroll, analytics, events/templates, requests | Shift/Revisions/Publications | COMPARISON | NO | YES | All readers plus dependent FKs migrated |
| AvailabilityOverrideAudit | ScheduledShift FK, schedule audit | V1 audit/exception decision | TEST REFERENCE | NO | YES | Decide V1 audit representation |
| ShiftChangeRequest | ScheduledShift FK, requests employee/admin UI | New Shift/availability request model | TEST REFERENCE | NO | YES | Request workflow redesign |
| ScheduleEvent | scheduling event actions/templates and ScheduledShift | Reuse with Shift relation or adapt | WORTH PRESERVING | NO | Not necessarily | New Shift association required |
| Schedule templates | schedule template actions/UI | Reuse/adapt to create Shift drafts | WORTH PRESERVING | NO | Not necessarily | Stop creating ScheduledShift |
| TimeClockEntry | personal/kiosk/manual/offline actions, admin, overtime, payroll, analytics, geofence | ClockEvent/WorkSession | COMPARISON | NO | YES | Native clock, engine and every downstream read |
| TimeClockEditRequest | employee/admin edit UI, TimeClockEntry | ClockCorrection | TEST REFERENCE | NO | YES | Native correction request/approval flow |
| GeofenceAlert.timeClockId | admin geofence UI | ClockEvent/WorkSession association or nullable context | TEST REFERENCE | NO | Field/model decision later | Remove legacy FK safely |
| OvertimeRecord | overtime actions/UI, payroll, analytics | Timesheet overtime tiers/policy | TEST REFERENCE | NO | YES | Approved Timesheet parity and policy engine |
| PayrollAdjustment | payroll computation/UI | WorkforcePayrollAdjustment or retained input | WORTH PRESERVING | NO | Decide later | Adjustment lifecycle and retroactivity semantics |
| PayrollPeriod | period lock, payroll workflow, PayrollEntry, PayrollLine, Workforce adjustments | **Reuse** PayrollPeriod | WORTH PRESERVING | NO | NO planned | Already shared by V1 models |
| PayrollEntry | payroll frozen views/calculation | PayrollLine | COMPARISON | NO | YES | Approved Timesheet, currency/rate snapshots and UI replacement |
| PayrollIncidentJustification | payroll reporting | AttendanceException resolution/notes | TEST REFERENCE | NO | Likely | Preserve documentation semantics |
| Legacy Workforce actions | all legacy employee/manager pages | V1 repositories/actions | No data | NO | YES | Routes and tests cut over |
| Legacy `/timeclock*` and `/administration/schedule` UI | navigation, permission modules, dashboard links | isolated V1 routes then same final URLs | No data | NO | YES | Complete employee/manager journeys |
| `/api/timeclock/sync` | offline queue | V1 ClockEvent sync route | No data | NO | Replace | Offline retry/idempotency/mobile tests |
| Legacy bridge/backfill scripts | developer tooling only | reproducible V1 QA seed/reset | RESEARCH | NO | Archive/remove after cutover | Keep reports and rollback evidence |
