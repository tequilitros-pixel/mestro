# Workforce V1 — Write path matrix

> **SUPERSEDED BY CLEAN REWRITE STRATEGY.** Preserved as architectural research and fallback only.

Legacy remains the only source of truth and read path throughout shadow validation.

| Legacy action | Source model | Workforce target | Classification | Idempotency | Failure mode | Rollout | Notes |
|---|---|---|---|---|---|---:|---|
| Create personnel/User | User, UserBranch | Employee, Employment, BranchAssignment | REQUIRES REDESIGN | User ID + create operation | DATA_CONTRACT / AMBIGUOUS | Later | Account role does not prove employee status; HOME cannot be guessed. |
| Change SalaryRate | User.hourlyRate, SalaryRate | PayRate | REQUIRES REDESIGN | SalaryRate ID + version | DATA_CONTRACT | Later | Current action has no currency. |
| Save recurring availability | EmployeeAvailabilityRule | AvailabilityRule | SAFE WITH ADAPTER | legacy ID + updatedAt | MAPPING_MISSING / AMBIGUOUS | 3 | Explicit enum/effective-date adapter. |
| Save dated availability | EmployeeAvailabilityException | AvailabilityException | SAFE WITH ADAPTER | legacy ID + updatedAt | MAPPING_MISSING / AMBIGUOUS | 3 | Copy-week must use deterministic child operations. |
| Create ScheduleWeek draft | ScheduleWeek | SchedulePeriod | SAFE WITH ADAPTER | week ID + branch | DATA_CONTRACT | 4 | Per-branch target and creator required. |
| Create ScheduledShift | ScheduledShift | Shift draft | SAFE WITH ADAPTER | shift ID + create op | MAPPING_MISSING / DATA_CONTRACT | 4 | Requires Employment and branch timezone; DESCANSO unsupported. |
| Update/move ScheduledShift | ScheduledShift | Shift + ShiftRevision | SAFE WITH ADAPTER | shift ID + mutation op | MAPPING_MISSING / DATA_CONTRACT | 4 | Append revision if previously published. |
| Publish week | ScheduleWeek | ShiftRevision, SchedulePublication, links | SAFE TO SHADOW | week ID + publication version | MAPPING_MISSING / DATA_CONTRACT | 4 | Real explicit publish trigger exists; snapshot all branch shifts. |
| Unpublish week | ScheduleWeek | Current SchedulePeriod state | SAFE WITH ADAPTER | week ID + mutation op | UNSUPPORTED if history would be erased | 4 | Never delete prior publication history. |
| Delete shift before publication | ScheduledShift | Remove/cancel shadow draft | SAFE WITH ADAPTER | shift ID + delete op | MAPPING_MISSING | 4 | Legacy remains authoritative. |
| Delete shift after publication | ScheduledShift | CANCELLED ShiftRevision/current status | SAFE WITH ADAPTER | shift ID + delete op | DATA_CONTRACT | 4 | Never physically delete published evidence. |
| Personal Clock In | TimeClockEntry create | ClockEvent CLOCK_IN | SAFE WITH ADAPTER | entry ID + CLOCK_IN | MAPPING_MISSING / AMBIGUOUS / DATA_CONTRACT | 2 | Server time, authorized branch; outbox in same transaction. |
| Personal Clock Out | TimeClockEntry update | ClockEvent/ClockCorrection | REQUIRES REDESIGN | entry ID + client operation | DATA_CONTRACT | Later | Existing action accepts adjusted in/out; not necessarily observed fact. |
| Kiosk Clock In | TimeClockEntry create | ClockEvent CLOCK_IN | SAFE TO SHADOW | entry ID + CLOCK_IN | MAPPING_MISSING / AMBIGUOUS / DATA_CONTRACT | 1 | Verified PIN and geofence are server-side prerequisites. |
| Kiosk Clock Out | TimeClockEntry update | ClockEvent CLOCK_OUT | SAFE TO SHADOW | entry ID + transition op | MAPPING_MISSING / AMBIGUOUS / DATA_CONTRACT | 1 | Uses server time and actual open entry branch. |
| Offline Clock In | TimeClockEntry create | ClockEvent CLOCK_IN | SAFE TO SHADOW | offline operation ID | MAPPING_MISSING / AMBIGUOUS / DATA_CONTRACT | 1 | Existing stable operation ID and duplicate response. |
| Offline Clock Out | TimeClockEntry update | ClockEvent CLOCK_OUT | SAFE TO SHADOW | offline operation ID | MAPPING_MISSING / AMBIGUOUS / DATA_CONTRACT | 1 | Captured device time; validate against authoritative open entry. |
| Break start/end | None | ClockEvent BREAK_START/BREAK_END | DO NOT SHADOW YET | N/A | UNSUPPORTED | Future | No current legacy action. |
| TimeClock edit request | TimeClockEditRequest | ClockCorrection pending | SAFE WITH ADAPTER | request ID + create | AMBIGUOUS / UNSUPPORTED | 5 | Only one conceptual native event may be changed. |
| TimeClock edit approval/rejection | TimeClockEditRequest + TimeClockEntry | ClockCorrection decision | SAFE WITH ADAPTER | request ID + decision transition | AMBIGUOUS / MAPPING_MISSING | 5 | Original ClockEvent stays immutable; compound edits go to review. |
| Manual/administrative TimeClock entry | TimeClockEntry | Imported/manual provenance design | DO NOT SHADOW YET | legacy entry ID | DATA_CONTRACT | Later | Not an observed device fact; needs explicit native manual-event contract. |
| OvertimeRecord derive/create/update | OvertimeRecord | Timesheet comparison | DO NOT SHADOW YET | record ID + updatedAt | POLICY_DIFFERENCE | 7 | Workforce should derive overtime, not accept another source of truth. |
| Overtime approval | OvertimeRecord | Timesheet/overtime comparison | DO NOT SHADOW YET | record ID + decision | POLICY_DIFFERENCE | 7 | Preserve as comparison result. |
| PayrollPeriod submit/create | PayrollPeriod, PayrollEntry | Comparison only | DO NOT SHADOW YET | period ID + submittedAt | DATA_CONTRACT / POLICY_DIFFERENCE | 8 | Frozen legacy snapshot remains authoritative. |
| PayrollEntry calculation/freeze | PayrollEntry | Comparison, not PayrollLine | DO NOT SHADOW YET | entry ID | DATA_CONTRACT / POLICY_DIFFERENCE | 8 | Requires reconciled timesheet, rate, currency and adjustments. |
| Payroll approval/paid/reopen | PayrollPeriod | Comparison state | DO NOT SHADOW YET | period ID + state transition | DATA_CONTRACT | 8 | No authoritative-looking PayrollLine yet. |

## Source-of-truth semantics

For every row above, the current source model remains authoritative after the write and all user-visible reads remain legacy. A shadow processor failure does not change the successful legacy response. The durable outbox guarantees visibility/replay; reconciliation compares legacy facts, intent and target rather than repairing silently.

## Verdict

| Area | Verdict | Gate |
|---|---|---|
| CLOCK | READY WITH CONDITIONS | Start kiosk/offline, then personal clock-in; redesign adjusted personal clock-out. |
| AVAILABILITY | READY WITH CONDITIONS | Enum/effective-date adapter and exactly one active Employment. |
| SCHEDULE | READY WITH CONDITIONS | Branch timezone, per-branch period mapping and revision tests. |
| CORRECTIONS | READY WITH CONDITIONS | Native target ClockEvents and unambiguous single-event semantics. |
| PAY RATE | NOT READY | Explicit currency/data contract required. |
| OVERTIME | NOT READY | Derive from validated Timesheet; comparison only first. |
| TIMESHEET | NOT READY | Native sessions/correction replay and minute parity required. |
| PAYROLL | NOT READY | Reconciled timesheet, overtime, rate/currency and adjustments required. |
