import test from "node:test";
import assert from "node:assert/strict";
import {
  canCopyPreviousWeek,
  canPublishSchedule,
  scheduleWarningLabel,
} from "../../lib/workforce/scheduling/presentation";

test("publication is available only for an unpublished week without blockers", () => {
  assert.equal(canPublishSchedule({ published: false, blockers: [] }), true);
  assert.equal(
    canPublishSchedule({ published: false, blockers: ["turno inválido"] }),
    false,
  );
  assert.equal(canPublishSchedule({ published: true, blockers: [] }), false);
});

test("copy is available only for an empty week with a source schedule", () => {
  assert.equal(
    canCopyPreviousWeek({
      published: false,
      currentShiftCount: 0,
      previousShiftCount: 4,
    }),
    true,
  );
  assert.equal(
    canCopyPreviousWeek({
      published: false,
      currentShiftCount: 1,
      previousShiftCount: 4,
    }),
    false,
  );
  assert.equal(
    canCopyPreviousWeek({
      published: false,
      currentShiftCount: 0,
      previousShiftCount: 0,
    }),
    false,
  );
});

test("technical warning codes are presented in human Spanish", () => {
  assert.equal(scheduleWarningLabel("UNAVAILABLE"), "Fuera de disponibilidad");
  assert.equal(scheduleWarningLabel("UNASSIGNED"), "Falta asignar una persona");
  assert.equal(scheduleWarningLabel("NEW_CODE"), "Requiere atención");
});
