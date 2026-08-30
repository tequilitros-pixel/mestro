# Workforce production cutover

Cutover date: 2026-08-29/30  
Certified baseline: `c12b6c8ccccbb5a49a77f41d7c8daeb6e9513f10`

## Previous production baseline

- Vercel project: `mestro` (`prj_JZj6UlFltTRUKSV9XHRMR94iDg2P`).
- Previous deployment: `dpl_92wXq62JDJG9PwqcdeLzGXPCMfeL`, READY.
- Official domain: `maestro-destiladora.space`.
- Production database: Neon project `calm-resonance-98583421`, branch `main`, database `neondb`, schema `public`.
- Workforce migrations pending before cutover: 11.
- Legacy baseline: 28 `ScheduledShift`, 17 `TimeClockEntry`, 1 `OvertimeRecord`, 2 `PayrollEntry`.
- Native Workforce tables were absent before migration.

## Backup and rollback baseline

Neon branch `workforce-cutover-baseline-20260829` (`br-withered-hat-att1ba62`) was created from production `main` at LSN `0/19407310`. It has no compute and expires 2026-09-05 23:59:59Z. Existing protected backups were not modified.

The previous Vercel production deployment remains the application rollback target. All Workforce migrations are additive/backward-compatible with that application. Rollback must prefer the prior deployment alias and the Neon baseline branch; no reverse/destructive migration should be improvised.

## Cutover routing

- Official employee surface: `/workforce` and descendants.
- Official administration surface: `/administration/workforce` and descendants.
- Certified `*-v1` implementations remain internal behind rewrites; direct V1 URLs redirect permanently to official URLs.
- Legacy `/timeclock` and `/administration/schedule` UI routes redirect to Workforce.
- Legacy offline `/api/timeclock/sync` returns HTTP 410 and performs no writes.
- `/administration/personnel` remains only for users, permissions and notifications.

Legacy Workforce tables and their historical facts are preserved. The cutover creates no inferred Employee, Employment, PayRate, clock or payroll facts. Administrators must onboard users explicitly; Payroll remains blocked until an honest effective PayRate and required policy facts exist.

## Workforce settings

The bootstrap policy is effective from 1970-01-01 with certified defaults: attendance 5/5/60/30/60, DAY/NIGHT/MIXED 480/420/450, weekly double band 540, Monday week start and Monday pay day. A valid existing policy is never overwritten.

## Safety and verification

- Fake/test clock requires both non-production `NODE_ENV` and explicit `WORKFORCE_CERTIFICATION_CLOCK=true`; that variable is absent from Vercel Production.
- Pre-push: TypeScript PASS, focused ESLint PASS, 171/171 tests PASS, Prisma validate/generate/status PASS, production build PASS.
- Connected DEV recertification `cutover1`: PASS; 28 ClockEvents, 2 corrections, 7 WorkSessions, zero legacy writes.
- Local route proof: official anonymous routes require login; V1/legacy redirects return 308; legacy sync returns 410.

## Deployment and post-deploy record

This section is finalized after migration, deploy, smoke tests and runtime/database inspection.

