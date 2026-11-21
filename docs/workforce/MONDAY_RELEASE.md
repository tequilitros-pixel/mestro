# Scheduling release — 2026-09-06

## Scope and checkpoints

Canonical workspace: `/Users/joseadansanchez/maestro-dev`; branch `codex/recover-workforce-3a566e2`; initial HEAD `d966b16af1950e800d64047ad9f2ca92eeb703f2`, no later commits at intake. The original uncommitted work is preserved in `/Users/joseadansanchez/maestro-checkpoints/pre-monday-20260906-095141/` as a binary patch, archive and deferred files.

Production advanced independently to `f2651b74d8fd596913646626cfcfd3d6159a7aaf` / `dpl_J46EKafrcuGh7KZtXDQ8RY2t25hB`. All 288 production changes outside the four shared integration files were preserved byte-for-byte, including POS2, sales and inventory. Auth helpers, permission metadata, package scripts and Prisma schema were merged to retain both versions. Existing production RLS policies are unchanged. The shared runtime context is retained because DEV has enforced RLS; it verifies the authenticated user and rejects privileged roles. Production additionally requires effective `maestro_runtime`.

## Delivered behavior

- Branch creation, editing, deactivation without deleting history, assigned employees, default template.
- HOME / ALLOWED assignment. HOME never generates shifts silently; a default template prompts explicitly and lets the administrator choose the week.
- Seven-day template table with rest days and overnight shifts; single and multiple employee application creates independent DRAFT shifts atomically.
- Global desktop weekly grid, all active employments including those without assignments, persistent add buttons, branch/time inside shifts and hours across branches.
- Create, edit, duplicate, delete/cancel, move branches, stale-version protection and global overlap validation with a human-readable conflict.
- Branch publication and publication history. Audited changes to an already published schedule mark its period pending for explicit republication, retaining the existing live-revision behavior of Scheduling V1.
- Employee calendar defaults to the week and shows date, local time and branch for published shifts.
- Mobile day view with adding/editing and collapsible branch publication status.
- Geolocation is frozen OFF in server code; the branch action refuses enabling it. Geometry is retained. See `phase2/README.md`.

## Migration safety and rollback plan

Production baseline: 22 successful migrations, every checksum matches this release. The following three migrations were reviewed, backed up, and applied successfully:

1. `20260904090000_workforce_branches_templates_geofence`
2. `20260905090000_canonical_workforce_geolocation`
3. `20260906120000_workforce_scheduling_geolocation_freeze`

The first two retain their already-applied DEV checksums. Their geo schema is additive and enforcement remains disabled. The third disables branch geofences and replaces automatic-template modes with explicit confirmation. No DROP TABLE/COLUMN or data deletion. The schema diff contains the expected Workforce additions plus two pre-existing index-name-only differences (EmploymentJornadaPolicy and WorkforceMigrationRecord). Those same two renames remain after deployment; no index or Payroll structure was changed. The two earlier DEV hardening/RLS migrations are excluded; their original files remain in the checkpoint, not in the deployable migrations directory.

Full production backup: `production/before-scheduling.dump` under the checkpoint. `pg_dump` completed; `pg_restore --list` and full SQL extraction to `/dev/null` verify the archive. Baseline migration inventory was saved separately. Rollback is re-aliasing the previous production deployment; additive schema remains compatible. Do not reset the database or reverse migrations by dropping data.

## Validation

- Full suite: 324/324 PASS, including preserved POS2 tests.
- Workforce suite: 212/212 PASS; no existing tests removed.
- Runtime service integration: 11 core checks PASS, plus single apply, pending publication, and explicit republication checks.
- Prisma validate/generate, standalone TypeScript and production build PASS.
- Focused ESLint PASS.
- Browser QA uses the production build against DEV with effective `maestro_runtime`; DEV Webpack JavaScript is blocked by the existing CSP, so no production CSP was weakened.
- Browser: branch deactivation retains the record; template deactivation clears the default. Create/edit branch, seven-day template/default, three HOME assignments with prompts, bulk apply 15 shifts, new shift in another branch, edit shift, publish and employee published calendar PASS.
- Publication initially hit the 10-second transaction limit with 15 shifts. It rolled back atomically. Publication and bulk application now allow 60 seconds; publication and republication retested successfully.
- Screenshots: `monday-qa/desktop.png`, `monday-qa/mobile.png`, `monday-qa/employee.png`.

Production execution and final smoke results are recorded below after deployment.

## Production runtime correction

The first production smoke returned `RUNTIME_DATABASE_ROLE_MUST_ENFORCE_RLS`. The guard was preserved. The official domain was immediately reassigned to the prior deployment while the connection was corrected (the automated rollback command was unavailable on the current Vercel plan; the supported alias operation succeeded).

A new non-privileged LOGIN principal, `maestro_scheduler_login_377326ac`, can SET only the existing `maestro_runtime` role. It has no SUPERUSER, BYPASSRLS, CREATEDB, CREATEROLE or replication privileges. No existing role password or RLS policy was changed. An unused test login was disabled and its role membership revoked.

The runtime connection uses the direct Neon endpoint with startup `role=maestro_runtime`; the pooler explicitly rejects the role startup option. A real connection verified effective `current_user=maestro_runtime`, `rolsuper=false`, `rolbypassrls=false`, and a transaction/auth read succeeded. The credential is stored privately outside Git and as Vercel's sensitive `DATABASE_URL`; Vercel reports that existing variable shared by Development, Preview and Production. Migration owner credentials remain separate. No Resend setting or local shared environment file was changed.

Subsequent isolated probes identified `neondb_owner` as the rejected effective role. The connection is now passed explicitly as adapter configuration, avoiding external Pool identity checks and PostgreSQL environment fallbacks. Runtime role enforcement also supports a transaction-local switch from an unprivileged LOGIN with SET membership, verifies the resulting role, and rejects privileged connections before switching. Six new guard tests pass. The exact application code verified `maestro_runtime`, SUPERUSER=false and BYPASSRLS=false against production. Final cloud results follow below.


## Final production verification

The verified scheduling deployment is `dpl_HrYBtCVjpwcNqQQrLpeDgg73rzhU`, source `5a08c00`. Authenticated browser QA passed on the official domain: branch read/edit, employee list, bulk application generating exactly three DRAFT shifts, explicit branch publication, employee date/time/branch display, mobile layout, and employee denial of administrative access. Test shifts belong exclusively to synthetic identities in the week 2099-01-05. Temporary identities/branches/templates were deactivated and sessions revoked, preserving publication history.

A parallel POS correction subsequently published `fec53b0` / `dpl_DovcPc68ySxyRQY1B7pH4qwCu11m`. That commit includes all scheduling commits through `5a08c00`; the diff contains only five POS-specific files, with no scheduling/runtime changes. This branch fast-forwarded to retain that work. See `monday-qa/deployment.json` and final-domain smoke evidence.

The runtime ultimately uses the dedicated sensitive production variable `MAESTRO_RUNTIME_DATABASE_URL`. Vercel requires it explicitly; it cannot fall back to the ambiguous shared connection. Runtime checks require effective `maestro_runtime`, SUPERUSER=false, BYPASSRLS=false. Changing adapter initialization alone did not resolve the observed owner connection; the dedicated variable did. No RLS policy was weakened in this scheduling task.

Logs from the successful scheduling deployment contain no failed requests or rejected roles. They do contain a pg 8 warning about concurrent client queries becoming unsupported in pg 9, on HTTP 200 responses. This is a follow-up compatibility item, not a failed scheduling operation; pg 9 was not installed. Zero branch geofences are enabled.

| Requested item | Result |
| --- | --- |
| BRANCH MANAGEMENT / EMPLOYEE BRANCH ASSIGNMENT | PASS: create, edit, deactivate, HOME/ALLOWED, explicit template prompt |
| SCHEDULE TEMPLATES / BULK TEMPLATE APPLICATION | PASS: seven-day editor, independent DRAFT shifts, single and multiple employees |
| GLOBAL WEEK TABLE | PASS: desktop seven-day table, all branches, unassigned active employees |
| SHIFT CREATION / SHIFT EDITING | PASS: create, edit, duplicate, remove, cross-branch move through service |
| CROSS-BRANCH OVERLAP / WEEKLY HOURS | PASS: global conflict validation and totals |
| PUBLICATION / EMPLOYEE SCHEDULE | PASS: explicit publication, pending changes, employee published date/time/branch |
| GEOFENCE STATUS | OFF; zero enabled branches; phase 2 deferred |
| MIGRATION SAFETY / PRODUCTION MIGRATIONS | Verified backup; three additive/non-destructive migrations applied; 25 up to date |
| WORKFORCE TESTS / FULL SUITE | 212/212 and 324/324 PASS |
| TYPESCRIPT / BUILD | PASS |
| DESKTOP QA / MOBILE QA | PASS; screenshots retained |
| COMMIT / PUSH | Implementation commits pushed; final evidence recorded in this commit |
| VERCEL DEPLOYMENT / PRODUCTION QA | READY; official-domain functional and final integration smoke evidence retained |
| LOGS | No request failure in successful scheduling QA; pg deprecation warning documented |
| GIT STATUS | Final evidence committed and pushed; verified clean afterward |
