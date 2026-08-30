# Workforce certification clock

Workforce uses the system clock by default. Connected historical certification may inject `createTestWorkforceClock` through the internal Clock service context only when both conditions hold:

- `NODE_ENV` is not `production`.
- `WORKFORCE_CERTIFICATION_CLOCK=true` is explicitly present in the process.

The provider owns `now`, `set`, and `advance` operations. Clock actions keep their normal two-argument public API; clients cannot submit an authoritative timestamp. `ClockEvent.deviceOccurredAt`, `serverReceivedAt`, correction audit timestamps, reconstruction timestamps, and Attendance reconciliation all derive from the injected provider. Attempting to create the test clock in production throws `TEST_CLOCK_FORBIDDEN_IN_PRODUCTION`.

The E2E runner also requires an ephemeral `WORKFORCE_E2E_PASSWORD` of at least 16 characters. It is never stored in source or shared configuration.

