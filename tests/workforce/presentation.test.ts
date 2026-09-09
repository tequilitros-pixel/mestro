import assert from "node:assert/strict";
import test from "node:test";

import {
  attendanceTypeLabels,
  clockEventLabels,
  humanLabel,
  timesheetReadinessLabels,
  timesheetStatusLabels,
} from "../../lib/workforce/presentation";

test("Workforce presentation translates internal clock and issue values", () => {
  assert.equal(humanLabel(clockEventLabels, "CLOCK_IN"), "Entrada");
  assert.equal(humanLabel(attendanceTypeLabels, "UNSCHEDULED_WORK"), "Trabajo no programado");
  assert.equal(humanLabel(timesheetStatusLabels, "APPROVED"), "Aprobado");
});

test("Workforce presentation keeps an explicit fallback for unknown values", () => {
  assert.equal(humanLabel(timesheetReadinessLabels, "BLOCKED"), "Bloqueado por incidencia");
  assert.equal(humanLabel(timesheetStatusLabels, "NEW_INTERNAL_STATE"), "NEW_INTERNAL_STATE");
  assert.equal(humanLabel(timesheetStatusLabels, null), "Sin registrar");
});
