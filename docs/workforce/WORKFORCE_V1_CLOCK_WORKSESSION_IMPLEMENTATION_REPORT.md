# Workforce V1 — Clock + Effective Stream + WorkSession

## Scope and source of truth

This DEV-only foundation keeps four concepts separate:

- `ClockEvent` is the append-only fact observed by MAESTRO.
- `ClockCorrection` is a final administrative decision. Approved decisions are
  never edited; a bad approved ADD is reversed by a compensating correction.
- `EffectiveClockStream` is a pure, deterministic projection.
- `WorkSession` is a synchronous materialization of that projection.

No legacy `TimeClockEntry` write or dual-write was introduced.

## Routes

- `/workforce-v1/clock`: authenticated employee clock and correction request.
- `/workforce-v1/kiosk`: authenticated, branch-scoped PIN kiosk.
- `/administration/workforce-v1/clock-corrections`: ADMIN decision queue.

## State machine

`NO_SESSION → CLOCK_IN → CLOCKED_IN`; from `CLOCKED_IN`, either
`BREAK_START → ON_BREAK → BREAK_END → CLOCKED_IN` or `CLOCK_OUT → NO_SESSION`.
Invalid transitions are rejected inside the serialized transaction. PERSONAL
and KIOSK are the only accepted sources in V1. Both times are server-aligned
for online V1: `deviceOccurredAt` records the occurrence claimed by this online
operation and `serverReceivedAt` records receipt.

## Idempotency and concurrency

Every mutation supplies a stable `idempotencyKey`, enforced by the existing
unique database constraint. An exact retry returns equivalent success; reuse
for a different operation is rejected. Mutations use a serializable Prisma
transaction, an employment-scoped PostgreSQL advisory transaction lock, and
bounded retry for Prisma `P2034`. State validation, event insertion, and
materialization share one transaction.

## Effective stream and corrections

The pure engine applies only APPROVED corrections:

- `MODIFY_OCCURRED_TIME` changes the effective instant while preserving the
  observed event identity.
- `ADD_MISSING_EVENT` supplies a correction-origin event without fabricating a
  `ClockEvent`.
- `VOID_EVENT` removes an observed or correction-added event from the effective
  projection without deleting either fact.

Ordering is `occurredAt`, event-type order, source, then stable source id.
Requests are restricted to the employee's active Employment and its own
targets/branches, use a bounded time window, and require exactly the fields for
their correction type. Only ADMIN can approve/reject. Approved corrections are
final at service level; DB enforcement remains deferred.

## Reconstruction

The effective stream is reconstructed after every accepted event and approved
correction. Sessions record start/end, worked minutes, accumulated multiple
breaks, status (`OPEN`, `COMPLETE`, `INCOMPLETE`), and observed input links.
Incomplete or invalid pairs are not normalized silently. Reconstruction
increments `reconstructionVersion`. A compensating correction also removes a
now-obsolete native derived session when it has no Attendance/Timesheet
downstream links; linked downstream data blocks that removal.

Published shifts are selected only for the same Employment and Branch within
the deterministic ±12-hour proximity window. Draft shifts never link.
Scheduled sessions retain Shift `businessDate`; unscheduled sessions have
`shiftId = null` and derive business date from the effective CLOCK_IN in the
Branch IANA timezone. Overnight sessions remain one session.

## Schema and DEV migrations

- `20260827190000_add_clock_v1` adds correction Branch provenance and the
  PostgreSQL trigger that rejects UPDATE/DELETE on `ClockEvent`.
- `20260827200000_add_clock_correction_compensation` adds the self-reference
  needed to compensate an approved correction-added event.

Both migrations were inspected and applied only to the verified DEV Neon
database. SQL is additive and contains no destructive legacy operation.

## QA

Automated coverage includes transition validity, idempotent retry, concurrent
clock-in and clock-out races, immutable ClockEvent UPDATE/DELETE, normal and
overnight sessions, one/multiple/incomplete breaks, missing clock-out,
published/draft linking, unscheduled work, all correction states/types,
compensation, reconstruction versioning, employee ownership, branch access,
and ADMIN-only decisions.

Authenticated browser QA exercised PERSONAL clock-in, break start/end,
clock-out, employee correction request, ADMIN approval, correction
compensation, and KIOSK PIN entry. Desktop 1280×800 and mobile 390×844 had no
horizontal overflow or Clock-specific page/console errors. Anonymous access to
employee and administration routes redirected to login. The deterministic QA
ClockEvents remain in DEV because the append-only guarantee correctly prevents
synthetic ledger deletion; reusable credentials/PIN are disabled after QA.

## Deferred

Offline capture is explicitly deferred to V1.5; this implementation is online
only and makes no offline claim. GPS/geofence collection, device management,
Attendance Exceptions, payroll judgment, and a live command center are outside
this module. No production system was read, migrated, or written.
