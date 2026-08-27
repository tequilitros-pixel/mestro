# Workforce V1 — Availability + Employee Calendar implementation

Date: 2026-08-27
Baseline: `ac01b1b1a64738bd507610998c4c8e0179c615d9`
Strategy: controlled clean rewrite, isolated V1 runtime, one source of truth.

## Routes

- `/workforce-v1`: authenticated employee calendar with Today, Week agenda and Month summary views.
- `/workforce-v1/availability`: own recurring rules, dated exceptions and 14-day effective result.
- `/administration/workforce-v1/availability`: ADMIN team availability and derived scheduling signal.

The global OPERATOR allowlist includes only the isolated `/workforce-v1` employee surface. The existing ADMIN-only guard still protects `/administration/workforce-v1`.

## Domain services

- `lib/workforce/availability/rules.ts`: pure effective-state, validation, urgency and future Scheduling contract.
- `lib/workforce/availability/authorization.ts`: own Employee versus ADMIN access decision.
- `lib/workforce/availability/service.ts`: authorized queries and mutations for rules/exceptions and team reads.
- `lib/workforce/calendar/rules.ts`: latest published revision selection and NEW/CHANGED/CANCELLED presentation.
- `lib/workforce/calendar/service.ts`: own-calendar query using publication links only.

React components do not own domain decisions. Every Server Action rechecks feature flag, authentication and Employee authorization.

## Availability semantics

`AvailabilityRule` is recurring and future-effective. Replacing a future rule closes the prior open range and bounds the new row before a later rule, preserving history without overlap. `AvailabilityException` is date-specific and wins over recurrence. V1 states are only AVAILABLE and UNAVAILABLE. Absence of facts returns UNKNOWN with `NO_AVAILABILITY_DECLARED`; it is never treated as unavailable.

Start/end may be omitted for an all-day declaration or supplied together as HH:mm. Cross-midnight ranges such as 18:00–01:00 are supported. Future exceptions may be upserted or deleted. Past exceptions and past recurring changes are rejected.

## Urgency and published-shift protection

The 24-hour decision uses civil dates spanning today through the date reached 24 hours from now. A change also requires manager attention when its date has any published Shift revision. The mutation writes only AvailabilityRule/AvailabilityException and returns an attention signal; it never updates Shift, ShiftRevision, SchedulePublication or SchedulePublicationShift.

Conflicts remain derived. No ScheduleConflict table was added. The scheduling-facing contract distinguishes hard blocks (inactive Employment, unauthorized Branch, overlapping Shift), soft conflict (UNAVAILABLE) and UNKNOWN.

## Calendar behavior

Employee reads resolve authenticated User → Employee → active Employment server-side. Employees without a linked User remain valid but cannot self-serve; an authenticated User without a linked active Employee receives an explicit safe state instead of a runtime exception. Calendar queries start from SchedulePublicationShift and therefore hide draft shifts. The latest publication/revision per Shift renders as NEW, CHANGED or CANCELLED.

Branch is always textual. Multi-branch weeks retain each branch name. An overnight Shift remains on `businessDate` and displays as one card with “termina al día siguiente.” Today has an explicit no-shift/day-off state and a disabled clock placeholder; it does not create a second clock source.

Future notification event names are defined for schedule publication, shift change/cancellation and availability-conflict resolution. No delivery infrastructure was built.

## Schema and DEV migration

Migration `20260827010000_require_shift_revision_reason` changes only `ShiftRevision.reason` to NOT NULL. DEV contained zero ShiftRevision rows before application, so no reason was invented. The inspected SQL is one `ALTER COLUMN ... SET NOT NULL`; migration status is current. No legacy table or column changed.

## Deterministic QA data

`seed-employment-qa.ts` now gives the linked employee a second authorized branch and prefers the synthetic `wfqa-operator` identity when present. `seed-availability-calendar-qa.ts` adds four recurring facts, one exception, three published shifts, one unlinked draft, a multi-branch overnight shift and a changed published revision. IDs and cleanup are allowlisted and two complete seed cycles passed. User and Branch rows are never mutated.

PostgreSQL DATE fixtures use civil ISO strings and timestamp-without-time-zone fixtures use UTC civil values. This avoids machine-timezone drift in `businessDate` and absolute instants.

## Tests and structural validation

The focused suite adds 18 tests for recurring AVAILABLE/UNAVAILABLE, exception precedence, UNKNOWN, cross-midnight ranges, hard/soft scheduling signals, own/admin authorization, 24-hour and published attention, draft hiding, publication visibility, revision state, overnight business date and multi-branch labels.

`availability-calendar-structural-test.ts` verifies the NOT NULL constraint, exact WFQA row counts, an unlinked draft, required revision reasons and the overnight business date. Final gates include Prisma format/validate/generate/status, TypeScript, focused ESLint, all Workforce tests and `git diff --check`.

## Authenticated desktop QA

At 1280 px, Today, Week, Month, own Availability and ADMIN team availability rendered without global overflow. Week showed 09:00–17:00 at QA Sobres A, a CHANGED shift, and one 18:00–01:00 overnight card at QA Sobres B. Month showed 30 agenda-summary days. Creating a future recurring rule, creating an exception against a published shift and deleting a future exception all passed. The attention alert appeared and the published shift stayed unchanged.

Anonymous access redirects to login. The linked OPERATOR can access only its employee calendar and availability; `/administration/workforce-v1` redirects it to `/cooking`. ADMIN can access team availability. Pure authorization tests independently reject another Employee ID.

## Mobile QA

At 390×844, Week, Month, Availability editor and ADMIN team view all reported document width 390 with no global overflow. Forms retained two date inputs, four time inputs and all save/delete controls. Long content wraps, branch labels remain textual, no-shift days are clear, and the overnight card stays on Saturday.

QA initially exposed a runtime exception for an authenticated User without linked Employee; the employee pages now render an explicit safe state. After correction, the only console error was the preexisting development CSP rejection from Next React Refresh (`unsafe-eval`).

## Time Off and deferred V1.5 work

Time Off remains a separate manager-approved future domain. No Leave/HR model or availability-as-vacation behavior was added. Preferences, shift swaps, open shifts, acknowledgement workflow, broad notifications, Scheduling mutation UI, native clock mutation and full Time Off are deferred.

## Legacy safety and limitations

Legacy Availability, ScheduleWeek, ScheduledShift, TimeClockEntry and PayrollEntry were not modified or deleted. There is no dual-write and no legacy runtime import in the V1 services.

Current limitations: manager overrides with mandatory reason belong to the Scheduling phase; availability attention is derived on read rather than persisted; partial-day overlap evaluation is exposed as time facts but Scheduling will own the final fit decision; clock CTA remains deliberately disabled.
