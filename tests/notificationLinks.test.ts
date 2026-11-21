import test from "node:test";
import assert from "node:assert/strict";
import { canonicalNotificationHref } from "../lib/notifications/links";

test("notification links preserve valid destinations", () => {
  assert.equal(canonicalNotificationHref("/timeclock/payroll?week=2026-11-02"), "/timeclock/payroll?week=2026-11-02");
  assert.equal(canonicalNotificationHref("/cash-cuts/audit"), "/cash-cuts/audit");
});

test("notification links migrate legacy payroll, event, and cash-cut destinations", () => {
  assert.equal(canonicalNotificationHref("/timeclock/my-payroll"), "/timeclock/payroll");
  assert.equal(
    canonicalNotificationHref("/administration/inventory/eventos/events"),
    "/administration/inventory/events",
  );
  assert.equal(canonicalNotificationHref("/cash-cuts/cut_123?tab=cierre"), "/cash-cuts/daily/cut_123?tab=cierre");
});
