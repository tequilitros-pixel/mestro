import test from "node:test";
import assert from "node:assert/strict";
import {
  attendanceStateLabels,
  attendanceStatusLabels,
  humanAttendanceIssueLabel,
  isHiddenAttendanceType,
} from "../../lib/workforce/attendance/presentation";

test("attendance issue labels are human and hide technical enum names", () => {
  assert.equal(humanAttendanceIssueLabel("LATE_ARRIVAL"), "Llegó tarde");
  assert.equal(humanAttendanceIssueLabel("MISSING_CLOCK_OUT"), "Falta registrar salida");
  assert.equal(humanAttendanceIssueLabel("UNSCHEDULED_WORK"), "Trabajo no programado");
  assert.notEqual(humanAttendanceIssueLabel("NO_SHOW"), "NO_SHOW");
});

test("historical break anomalies are excluded from current operation", () => {
  assert.equal(isHiddenAttendanceType("BREAK_ANOMALY"), true);
  assert.equal(isHiddenAttendanceType("INCOMPLETE_BREAK"), true);
  assert.equal(isHiddenAttendanceType("LATE_ARRIVAL"), false);
});

test("attendance status and state labels stay human", () => {
  assert.deepEqual(
    {
      pending: attendanceStatusLabels.OPEN,
      resolved: attendanceStatusLabels.RESOLVED,
      working: attendanceStateLabels.WORKING,
      completed: attendanceStateLabels.COMPLETED,
    },
    {
      pending: "Pendiente",
      resolved: "Resuelto",
      working: "Trabajando",
      completed: "Completado",
    },
  );
});
