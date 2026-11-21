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

Production baseline: 22 successful migrations, every checksum matches this release. Prisma status reports only these pending migrations:

1. `20260904090000_workforce_branches_templates_geofence`
2. `20260905090000_canonical_workforce_geolocation`
3. `20260906120000_workforce_scheduling_geolocation_freeze`

The first two retain their already-applied DEV checksums. Their geo schema is additive and enforcement remains disabled. The third disables branch geofences and replaces automatic-template modes with explicit confirmation. No DROP TABLE/COLUMN or data deletion. The schema diff contains only expected Workforce additions. The two earlier DEV hardening/RLS migrations are excluded; their original files remain in the checkpoint, not in the deployable migrations directory.

Full production backup: `production/before-scheduling.dump` under the checkpoint. `pg_dump` completed; `pg_restore --list` and full SQL extraction to `/dev/null` verify the archive. Baseline migration inventory was saved separately. Rollback is re-aliasing the previous production deployment; additive schema remains compatible. Do not reset the database or reverse migrations by dropping data.

## Validation

- Full suite: 318/318 PASS, including preserved POS2 tests.
- Workforce suite: 206/206 PASS; no existing tests removed.
- Runtime service integration: 11 core checks PASS, plus single apply, pending publication, and explicit republication checks.
- Prisma validate/generate, standalone TypeScript and production build PASS.
- Focused ESLint PASS.
- Browser QA uses the production build against DEV with effective `maestro_runtime`; DEV Webpack JavaScript is blocked by the existing CSP, so no production CSP was weakened.
- Browser: branch deactivation retains the record; template deactivation clears the default. Create/edit branch, seven-day template/default, three HOME assignments with prompts, bulk apply 15 shifts, new shift in another branch, edit shift, publish and employee published calendar PASS.
- Publication initially hit the 10-second transaction limit with 15 shifts. It rolled back atomically. Publication and bulk application now allow 60 seconds; publication and republication retested successfully.
- Screenshots: `monday-qa/desktop.png`, `monday-qa/mobile.png`, `monday-qa/employee.png`.

Production execution and final smoke results are recorded below after deployment.
