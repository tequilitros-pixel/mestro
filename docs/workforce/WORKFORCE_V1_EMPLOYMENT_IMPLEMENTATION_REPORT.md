# Workforce V1 — Employment foundation implementation

Fecha: 2026-08-26

## Architecture

The module is isolated behind the server-only `WORKFORCE_V1_ENABLED` flag. It never writes legacy SalaryRate, ScheduledShift, ScheduleWeek, TimeClockEntry or PayrollEntry. Routes authenticate with the existing MAESTRO admin session and all mutations repeat authorization server-side.

Runtime layering:

- `lib/workforce/employment/rules.ts`: pure effective-range, currency and authorization rules.
- `lib/workforce/employment/service.ts`: queries and transactional domain mutations.
- `app/actions/workforceEmployment.ts`: authorized Server Actions and route revalidation.
- `/administration/workforce-v1`: employee list.
- `/administration/workforce-v1/employees/new`: create Employee and initial Employment.
- `/administration/workforce-v1/employees/[id]`: identity, employment, assignments, rate and history detail.

## Models used

Employee is independent of User and supports an optional login link, displayName, optional name parts, employee number and active flag. Employment owns lifecycle and confidence. BranchAssignment owns effective HOME/ALLOWED history. PayRate owns effective compensation history with nullable currency only for legacy rows.

No schema change was required: Phase 3A already supplied honest nullable legacy representation.

## Business rules

- A native employee requires a non-empty displayName; User is optional.
- Native rates require positive amount and a three-letter uppercase ISO-4217 code.
- Legacy imported PayRate may keep NULL currency; the native mutation rejects it.
- Effective ranges are half-open and must have end after start.
- HOME ranges cannot overlap. Mutations run at SERIALIZABLE isolation until a temporal database exclusion is introduced.
- ALLOWED assignments may coexist across branches.
- Changing HOME or PayRate closes the currently effective row and appends a new row; it does not rewrite history.
- Termination/inactivation records endedAt; termination may record a reason.
- Rehire appends a new Employment and rejects rehire while another ACTIVE Employment exists.
- Activating an Employment rejects another ACTIVE Employment for the same Employee.

## QA seed/reset contract

`scripts/workforce/seed-employment-qa.ts` verifies the exact DEV Neon endpoint/database before any mutation. It deletes only Employee rows whose displayName begins `WFQA-` and their PayRate, BranchAssignment and Employment children. It never deletes or updates User, Branch or any legacy/non-Workforce table.

The deterministic seed creates six synthetic employees across two existing QA branches: one linked to an existing synthetic QA User, multiple ALLOWED branches, seven PayRates including adjacent historical rates, one inactive Employment and one terminated Employment. Running it twice produces the same rows.

DEV result: 6 Employee, 6 Employment, 6 HOME, 2 ALLOWED and 7 PayRate; User rows touched 0; Branch rows touched 0.

## Tests and validation

Automated coverage includes employees with/without User, lifecycle/rehire representation, HOME overlap, multiple ALLOWED branches, invalid ranges, native/legacy currency behavior, adjacent historical rates and admin-only authorization. The full project test suite, TypeScript and Prisma validation/generation/status are required before commit.

The isolated route correctly redirects an anonymous browser session to login. Desktop/mobile layouts use responsive grids, horizontally scrollable dense history tables, and stacked forms below the `sm`/`lg` breakpoints. Full authenticated click-through requires an existing local admin session; no test-only authentication bypass was introduced.

## Manual QA scenarios represented in DEV

- Create: six deterministic Employee/Employment pairs.
- HOME and ALLOWED: one HOME per employment; employee 2 has two ALLOWED branches.
- Pay rate and change: employee 1 has a closed historical HOURLY rate followed by a current rate.
- Termination: employee 6 is TERMINATED with endedAt/reason.
- Inactive: employee 5 is INACTIVE.
- History: old rate row remains persisted after the new effective row.

## Known limitations

- UI errors currently use standard Server Action error handling; inline form feedback is a later UX refinement.
- Rehire exists in the service layer but is not yet exposed in the basic administration UI.
- Employee identity edits are not exposed yet; history-focused lifecycle mutations are prioritized.
- HOME temporal uniqueness is application-enforced under SERIALIZABLE transactions, not a database exclusion constraint.
- The feature flag is intentionally temporary and defaults OFF.

## Legacy safety

Legacy models, actions, routes and user-visible behavior remain unchanged. No migration was created or applied. Production was not accessed.
