# Workforce V1 — Shadow dual-write design

> **SUPERSEDED BY CLEAN REWRITE STRATEGY.** Preserved as architectural research and fallback only. Do not implement its outbox or dual-write runtime by default.

Fecha: 2026-08-26

## Scope and invariants

This document designs transition infrastructure only. Legacy remains authoritative and every user-visible read continues to use legacy data. No shadow write, feature flag, processor, job, schema change, or production deployment is enabled by this phase.

The bridge consumes identity, branch, timestamps and authorization already resolved server-side. Client-provided `employeeId`, Workforce IDs, branch ownership, status, rates, or approval identity are never trusted. Server Actions remain independently authenticated and authorized, as required by Next.js 16.

## Architecture decision

Use a separate durable outbox, provisionally named `WorkforceShadowOperation`. Do not reuse `WorkforceMigrationRecord`: the latter records historical classification/mapping; an outbox represents live intent, retries and processing state.

```text
authorized legacy action
  -> one database transaction
     -> legacy mutation (authoritative)
     -> immutable, versioned outbox intent
  -> normal legacy response/read path

DEV processor
  -> claim pending outbox row
  -> resolve exactly one active Employment
  -> idempotent Workforce adapter/write
  -> mark processed, or retain classified failure for replay

DEV reconciler
  -> compare expected legacy intents, outbox rows and Workforce targets
  -> report missing, duplicate, mismatched, ambiguous and unprocessed work
```

Legacy mutation plus outbox enqueue should be atomic in the same Postgres transaction. Workforce processing is asynchronous and non-blocking. This removes the crash gap between legacy success and intent recording without allowing a non-authoritative target failure to break current operations. Existing mutations not currently transactional would be refactored into a transaction only when their shadow path is implemented; that refactor must preserve return values and cache revalidation.

## Live operation model

Proposed technical fields (design only):

| Field | Purpose |
|---|---|
| `id` | Technical primary key. |
| `operationType` | Small enum of versioned meanings, e.g. `CLOCK_IN_V1`. |
| `legacyEntityType`, `legacyEntityId` | Authoritative source reference. |
| `clientOperationId` | Optional caller retry identity; required where available. |
| `idempotencyKey` | Unique server-derived identity for one semantic shadow effect. |
| `payloadVersion`, `payload` | Minimal immutable facts/references needed for replay. |
| `status` | `PENDING`, `PROCESSING`, `PROCESSED`, `RETRY`, `REVIEW`, `FAILED`, `SKIPPED`. |
| `failureClass` | `TRANSIENT`, `MAPPING_MISSING`, `AMBIGUOUS`, `DATA_CONTRACT`, `BUG`, `UNSUPPORTED`. |
| `attempts`, `lastError` | Bounded operational diagnostics; errors must be sanitized. |
| `availableAt`, `claimedAt`, `processedAt` | Retry/claim lifecycle. |
| `createdAt`, `updatedAt` | Audit timestamps. |

Unique keys: `idempotencyKey`, plus `(operationType, clientOperationId)` when a client ID exists. The payload stores immutable facts (authorized `userId`, actual `branchId`, occurred time, legacy ID and actor/source), not full mutable rows or credentials.

## Source-of-truth matrix

These rules apply to every concrete action enumerated in the companion write-path matrix.

| Path family | Current source of truth | Shadow target | Authoritative after write | Read path | Shadow failure behavior | Reconciliation |
|---|---|---|---|---|---|---|
| Identity/employment | User/UserBranch | Employee/Employment/Assignment | Legacy | Legacy personnel queries | Review; no target guess | Compare User intent, mapping cardinality and target fields |
| Pay rate | User.hourlyRate/SalaryRate | PayRate | Legacy | Legacy payroll/rate queries | Data-contract failure when currency absent | Compare range, type, amount and explicit currency |
| Availability | EmployeeAvailabilityRule/Exception | AvailabilityRule/Exception | Legacy | Legacy availability helpers | Retry or mapping review | Compare effective dates, weekday, type and times |
| Schedule | ScheduleWeek/ScheduledShift | SchedulePeriod/Shift/revisions/publication | Legacy | Legacy schedule/calendar | Retry or data-contract review | Compare per-branch count, values, version and publication links |
| Clock | TimeClockEntry | ClockEvent | Legacy | Legacy open/recent shift queries | Retry or mapping/data-contract review | Compare one expected event per eligible transition and immutable fields |
| Corrections | TimeClockEditRequest/TimeClockEntry | ClockCorrection | Legacy | Legacy edit-request and payroll reads | Ambiguous cases remain REVIEW | Compare request/decision status and effective event stream |
| Overtime/timesheet | OvertimeRecord/clock calculations | Derived Timesheet comparison | Legacy | Legacy overtime/payroll reads | No write in early levels | Compare worked/payable/tier minutes and policy category |
| Payroll | PayrollPeriod/PayrollEntry | Comparison only | Legacy | Legacy payroll snapshots | No PayrollLine write | Compare frozen inputs, currency, minutes and gross |

## Employment and branch resolution

Every processor resolves `User.userId -> Employee.userId -> exactly one ACTIVE Employment`. Zero active employments becomes `MAPPING_MISSING`; more than one becomes `AMBIGUOUS`. Neither case selects arbitrarily. The branch comes from the authorized operation/legacy row, never HOME assignment. Missing or invalid branch timezone is `DATA_CONTRACT` for ClockEvent and blocks only its shadow operation.

## Priority path: clock

Clock is **READY WITH CONDITIONS**.

- Personal clock-in: server time, authenticated user, validated branch/geofence. Enqueue `CLOCK_IN_V1` with the created `TimeClockEntry.id`; target a native `ClockEvent(CLOCK_IN)`.
- Kiosk clock-in/out: authenticated kiosk session plus verified employee PIN and validated branch/geofence. Enqueue after authorized identity is established.
- Offline sync: already supplies a stable operation ID and duplicate handling. Reuse it as client operation identity; never accept a Workforce identity from payload.
- Personal `clockOutAction`: currently accepts adjusted clock-in and clock-out values and mutates the composite legacy row. It is not necessarily a genuine observed event. It is **not shadow-ready** until the contract separates observed device time from a requested correction. Do not emit ClockEvent from an adjusted value.
- Clock-out without an open legacy entry remains a legacy error and emits no outbox intent.
- Double submit/retry resolves through legacy state plus unique operation/event key.
- Overnight events keep actual instant and branch timezone; WorkSession reconstruction owns business-date grouping.
- Breaks remain unsupported because legacy runtime has no break action.

Suggested ClockEvent idempotency: `clock-event:v1:{legacyEntryId}:CLOCK_IN` and `...:CLOCK_OUT:{clientOperationId-or-authoritative-transition-id}`. ClockEvent.source distinguishes `PERSONAL`, `KIOSK`, and `OFFLINE_SYNC`; it never uses `LEGACY_IMPORTED` for new activity.

## Scheduling

Schedule is **READY WITH CONDITIONS**. The system has a real `publishWeekAction`, so a future adapter may create a truthful ShiftRevision snapshot and SchedulePublication at that trigger.

- ScheduleWeek draft creation maps to a per-branch SchedulePeriod only after branch-specific contents and creator are known.
- Shift create/update can shadow current canonical Shift. Use legacy shift ID plus mutation/outbox ID; updated shifts produce a new revision number instead of rewriting a published snapshot.
- Publish reads the complete authorized week inside processing, creates immutable ShiftRevision rows and one SchedulePublication per branch/version, then links them.
- Unpublish is not historical deletion; it changes the current draft visibility while prior publication remains immutable.
- Delete before any publication may remove/cancel an unpublished shadow draft during shadow validation. Delete after publication must append a CANCELLED revision/current status, never erase published evidence.
- `DESCANSO` has no direct Shift semantics and stays `UNSUPPORTED` until a day-off representation is chosen.
- Branch timezone must be configured; current missing timezones are a data-contract gate.

## Availability

Availability is **READY WITH CONDITIONS** and is a good second path. Legacy recurring rules and dated exceptions resemble Workforce models, but enums differ and must have an explicit adapter. Enqueue the authoritative upsert in the same transaction. Keys: `availability-rule:v1:{legacyId}:{updatedAt}` and `availability-exception:v1:{legacyId}:{updatedAt}`. Copy-week emits one intent per resulting row or one batch intent whose processor has deterministic child keys. Exactly one Employment is required; effective-date and weekday parity must be tested.

## Corrections

Corrections are **READY WITH CONDITIONS**, after native ClockEvents exist for the target period. Request creation alone may enqueue a pending correction only when one conceptual event is affected. Approval/rejection is the decision transition. Approved legacy mutation remains authoritative; Workforce appends/decides ClockCorrection and never mutates the original ClockEvent. Compound changes to both clock-in and clock-out, missing target event, and imported legacy composites go to REVIEW/UNSUPPORTED rather than auto-shadow.

## Employee and pay rate

User creation is **REQUIRES REDESIGN**: `createPersonnel` creates accounts for several roles and does not explicitly assert employment semantics, startedAt, or HOME branch. A later UI/data contract must say whether the User is an employee and identify assignment semantics. Do not auto-create Employee for every User.

Pay rate is **NOT READY**. `updateHourlyRate` atomically updates `User.hourlyRate` and SalaryRate history, but supplies no currency. New native PayRate requires explicit ISO-4217 currency; a UI/config contract is required. Once present, the existing transaction is suitable for legacy mutation plus outbox enqueue, keyed by created SalaryRate ID/version.

## Overtime, timesheet and payroll

- Overtime is **NOT READY** for direct dual-write. Legacy `OvertimeRecord` is derived/reviewed output. Workforce overtime should be derived from Timesheet policy; legacy records are comparison truth and parity evidence, not a second input source.
- Timesheet is **NOT READY**. It becomes a shadow derivation after sufficient native WorkSessions and correction replay exist. It is processor/reconciliation output, not a direct mirror of PayrollEntry.
- Payroll is **NOT READY** and remains READ/COMPARE ONLY. `submitPayrollPeriodAction` freezes entries in one transaction and approval changes period state, but Workforce PayrollLine cannot be created until timesheet minutes, overtime tiers, explicit rate/currency snapshots and adjustments all reconcile. Never reconstruct historical payroll from current rates.

## Failure semantics

Use legacy-first shadow semantics with a durable same-transaction outbox. Failure to enqueue rolls back the legacy transaction because otherwise intent can be lost; this is a local database availability failure, not a Workforce adapter failure. After enqueue, processor failures never change the completed legacy response. They become retry or review records. Transient failures retry with bounded exponential delay; permanent mapping/data-contract/unsupported cases remain visible and require no automatic mutation.

Claim processing should use a short transaction and row locking (`FOR UPDATE SKIP LOCKED` or equivalent). Domain write and processed status commit together where they share the database. A crashed processor therefore safely retries. Payload parsing is versioned and exhaustive; unknown versions are `UNSUPPORTED`.

## Feature flags and rollout

Use one typed server-only configuration object backed by a small set of DEV environment variables, default false. Initial design keys: `clock`, `availability`, `schedule`, `corrections`. No client can enable them. Payroll/timesheet are compare modes rather than write flags.

Recommended sequence:

0. All flags false; deploy outbox/processor/reconciler in DEV.
1. Offline and kiosk clock events, whose identity/time contracts are strongest.
2. Personal clock-in; redesign personal clock-out contract before adding it.
3. Availability rules/exceptions.
4. Draft scheduling, then explicit publication/revision handling.
5. Unambiguous corrections for native events.
6. WorkSession reconstruction and Timesheet comparison.
7. Overtime comparison.
8. Payroll comparison only.

Each path can be disabled independently while pending outbox rows remain replayable.

## DEV reconciliation and metrics

A manually invoked DEV harness should report, per time window and operation type:

- expected authorized legacy transitions;
- outbox present/missing and pending age;
- processed, retry, review and failed counts;
- missing/duplicate Workforce targets;
- field/value mismatches;
- clock, shift, availability and correction parity percentages;
- WorkSession and Timesheet minute differences;
- retry count and ambiguous Employment resolution count.

The failure inbox is a query/report over outbox status/failureClass, not a manager UI. It must redact secrets and allow replay by operation ID after the underlying mapping/data contract is fixed.

## Test plan

Every implemented path requires: legacy success + shadow success; legacy success + processor failure; same-transaction enqueue guarantee; retry; duplicate client request; duplicate processor delivery; zero/multiple active Employment; unauthorized/wrong branch; malformed/unknown payload version; processor crash before and after target write; reconciliation detection and replay.

Clock additionally tests personal/kiosk/offline sources, double submit, missing open entry, adjusted-time rejection and overnight instants. Schedule tests draft/update, publish snapshot, post-publication revision, unpublish and delete before/after publication. Availability tests rule/exception enum and effective-date parity. Corrections test request/approve/reject and compound review. Payroll tests remain comparison-only.

## Cutover preconditions

A path may become Workforce-authoritative only after sustained parity for its defined metrics, zero unexplained mismatches, all failure classes observable, replay/idempotency/processor-crash recovery proven, security review passed, rollback to legacy reads tested, data contracts resolved, and explicit operational approval. No elapsed-time threshold alone is sufficient.

## Schema decision

Implementation will require a new technical `WorkforceShadowOperation` table and small enums/indexes described above. They are not created in this design phase. Do not overload `WorkforceMigrationRecord` or add shadow metadata to core domain models.
