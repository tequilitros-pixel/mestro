# Empleados — UX hotfix

Canonical route: `/administration/workforce/employees`. The former `/administration/workforce` entry redirects there. The Workforce administration tab bar exposes Empleados first on desktop and mobile; the sidebar points to the canonical route. The list owns its immediately visible `+ Nuevo empleado` action, search, branch/status filters, desktop table and mobile cards.

Creation supports optional linked User, unknown start date, optional rate/currency/jornada, HOME and ALLOWED branches. Unknown inputs remain null or absent. A default HOME template offers explicit next-week application through Scheduling, creating DRAFT shifts only. Server actions require ADMIN and the existing contextual Prisma/RLS transaction setup remains in place. Runtime configuration and privileges are unchanged.

Name changes affect display identity. Branch, rate and jornada changes retain dated history. Termination requires a reason and a date not preceding known employment start; it changes only the employment, preserving shifts, attendance, timesheets and payroll relationships. A terminated employment cannot be reopened or have its conditions changed. Rehire creates a new employment, and an existing open employment prevents duplicate rehire. There is no physical Employee delete action. Removing an ALLOWED assignment closes its effective range rather than deleting it.

The saved employment history can be expanded in the detail page. Mutation buttons disable while saving. Admin-only routes protect rate visibility; employees cannot access list, creation or administration.

## Validation

- Full suite: 324/324, preserving existing tests.
- New DEV database integration: 13/13. Covers linked/unlinked User, unknown data, HOME/ALLOWED/rate/jornada, profile edit, dated history, duplicate assignment, ALLOWED closure, termination validation, retained shift/conditions, immutable terminated employment, rehire and duplicate rehire denial.
- `scripts/workforce/employees-runtime-test.ts` exercises the actual service against guarded DEV.
- `scripts/workforce/employees-browser-qa.mjs` exercises authenticated UI at 1440×900 and 390×844, including create/edit/termination/rehire, explicit template application and normal-employee route denial.
- No Prisma migration or runtime role change is required.

Production execution and cleanup evidence are appended after acceptance.
