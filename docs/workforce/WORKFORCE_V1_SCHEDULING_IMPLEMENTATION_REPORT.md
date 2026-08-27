# Workforce V1 Scheduling — Implementation Report

## Scope and architecture

Scheduling V1 is isolated at `/administration/workforce-v1/schedule` and is the source of truth only for V1 planned work. It does not write `WorkedTime`, clock, payable-time, payroll, or any legacy scheduling table. Server actions authorize every mutation and delegate business rules to `lib/workforce/scheduling/`.

The manager board is Branch + Week. Desktop uses employee rows and day columns; mobile uses a seven-day strip and a selected-day list. Both expose create/edit, unassigned shifts, coverage, warnings, weekly hours, publication, and compact revision history. Drag/drop is intentionally absent.

## Model changes

- `Shift.employmentId` and `ShiftRevision.employmentId` are nullable so an unassigned need can exist and be published as a warning.
- `StaffingRequirement` stores a date-specific branch/time window and required headcount. This is deliberately not a recurring demand or forecasting model.
- Migration `20260827170000_add_scheduling_v1` only relaxes the two V1 employment foreign keys and creates `StaffingRequirement`, its indexes, checks, and foreign keys. No legacy table is altered.

The migration SQL was inspected and deployed only to the verified Neon DEV database `ep-red-lake-ats4n9i7…/neondb`. Prisma format, validate, generate, and DEV migration status were exercised. Production was not connected to or changed.

## Rules, coverage, and hours

Hard blockers are inactive Employment, unauthorized BranchAssignment, overlapping shifts across every branch, invalid times, and shifts outside the SchedulePeriod. Overnight shifts are one record whose `businessDate` is the start day; conflicts use absolute instants.

Availability is read-only. `UNAVAILABLE` is a manager-visible warning, `UNKNOWN` is informational, and neither blocks publication. Other warnings are unassigned work, coverage gaps, and scheduled-hours/overtime risk. Coverage counts non-cancelled shifts that overlap a requirement window and labels `UNDERSTAFFED`, `COVERED`, or `OVERSTAFFED` textually. Weekly hours are derived only from Shift. The preventive threshold comes from `PayrollSettings.weeklyHourThreshold`, with 48 hours only as the existing/default fallback; it is not a legal payroll calculation.

## Publication and history

Whole-week publication runs in a SERIALIZABLE transaction. It revalidates assigned shifts, creates one `SchedulePublication`, creates an exact `ShiftRevision` snapshot per shift, links every snapshot through `SchedulePublicationShift`, and changes period/shift status atomically. A retry returns the existing publication rather than duplicating it.

Post-publication create/edit/cancel is immediately effective. It requires a reason, appends a revision with actor/time/reason, and never mutates the historical publication link. Published cancellation is logical; only history-free draft shifts are physically deleted. Shift `version` is checked by conditional update, so stale editors fail instead of overwriting.

`schedule.published`, `shift.new`, `shift.changed`, and `shift.cancelled` are registered as future notification event names only; no notification subsystem was added.

## Copy week and templates

Copy Previous Week creates draft facts shifted by seven days, revalidates Employment, branch authorization, time range, and cross-branch overlap, skips invalid assignments, does not copy publications/revisions, and is idempotent once the target contains shifts. Availability remains a warning on the resulting draft.

Legacy templates remain untouched. V1 reuses the useful copy-week concept and defers a second templates UI to avoid two redundant scheduling mechanisms.

## Employee calendar

The V1 employee calendar reads current effective V1 Shift plus its latest revision, only for published/cancelled rows. Drafts remain hidden. New post-publication shifts appear as `NEW`, revisions as `CHANGED`, and cancellations as `CANCELLED`; original publication snapshots remain immutable.

## Tests and QA

Automated coverage includes draft CRUD, unassigned work, inactive and unauthorized Employment, same/cross-branch overlap, availability warnings, copy and invalid-copy skip, transactional publication/snapshots, draft hidden/published visible, immediate revision/reason, cancellation history, double-publish idempotency, stale version, overnight, coverage, hours, and overtime risk. The full Node suite contains 70 passing tests; the DEV service integration also passed and cleans its exact 2030 QA weeks.

Authenticated desktop QA used a temporary DEV ADMIN and verified the board, create/edit/delete, unassigned editor, coverage gap, availability signals, 50/48-hour risk, copy retry, publication, post-publication revision, and revision history. There was no horizontal page overflow at 1280 px. Authenticated employee QA confirmed the admin route redirects to `/cooking`, the V1 calendar hides drafts, and the effective revised shift appears as `Cambió` with its branch.

Authenticated mobile QA used 390×844 and verified the day strip/list, forms, create of a post-publication overnight shift, warnings, coverage, publication controls, expanded revision history, and no horizontal overflow (`scrollWidth = innerWidth = 390`).

Two real UI defects found during QA were fixed: unassigned shifts now have an editable section on both breakpoints, and Copy Week retries report that no duplicates were created instead of presenting the existing count as newly copied.

The only console noise was the project-wide development CSP rejecting React Refresh `unsafe-eval`; it did not prevent navigation or server-action flows and was not changed because shared CSP/runtime configuration is outside Scheduling V1.

The deterministic WFQA seed now covers multi-branch employees, available/unavailable/unknown states, unassigned work, overnight, coverage gap, overtime risk, published, changed, and cancelled shifts. Browser-created rows were reset using only `wfqa_period_*`; temporary auth users and their sessions were removed afterward.

## Legacy and V1.5

`ScheduleWeek`, `ScheduledShift`, legacy templates, and `ScheduleEvent` remain unchanged. There is no dual-write and no legacy route replacement.

Deferred: drag/drop, labor cost, swaps, open-shift claiming, skills/certifications, rest-rule engine, advanced notifications, AI scheduling, and forecasting.
