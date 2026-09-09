import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { formatZonedDateTimeParts, parseZonedDateTimeLocal } from "../../lib/workforce/clock/localDateTime";
import { correctionLabel, correctionStatusLabels, requestKindLabels, requestKindToCorrection } from "../../lib/workforce/clock/requestPresentation";

test("employee request choices map to canonical ClockCorrection types", () => {
  assert.deepEqual(requestKindToCorrection("MISSING_CLOCK_IN"), { type: "ADD_MISSING_EVENT", proposedEventType: "CLOCK_IN", requiresTarget: false });
  assert.deepEqual(requestKindToCorrection("MISSING_CLOCK_OUT"), { type: "ADD_MISSING_EVENT", proposedEventType: "CLOCK_OUT", requiresTarget: false });
  assert.equal(requestKindToCorrection("WRONG_CLOCK_IN").type, "MODIFY_OCCURRED_TIME");
  assert.equal(requestKindToCorrection("WRONG_CLOCK_OUT").targetType, "CLOCK_OUT");
  assert.equal(requestKindToCorrection("OTHER").requiresTarget, true);
});

test("request presentation hides technical status and type enums", () => {
  assert.equal(requestKindLabels.MISSING_CLOCK_OUT, "Olvidé registrar salida");
  assert.equal(correctionLabel("ADD_MISSING_EVENT", "CLOCK_IN"), "Olvidé registrar entrada");
  assert.equal(correctionStatusLabels.PENDING, "Pendiente");
  assert.notEqual(correctionStatusLabels.PENDING, "PENDING");
});

test("local request times use IANA timezone across midnight", () => {
  const beforeMidnight = parseZonedDateTimeLocal("2026-09-08", "23:58", "America/Mexico_City");
  const afterMidnight = parseZonedDateTimeLocal("2026-09-09", "00:02", "America/Mexico_City");
  assert.ok(afterMidnight.getTime() > beforeMidnight.getTime());
  assert.deepEqual(formatZonedDateTimeParts(beforeMidnight, "America/Mexico_City"), { date: "2026-09-08", time: "23:58" });
  assert.deepEqual(formatZonedDateTimeParts(afterMidnight, "America/Mexico_City"), { date: "2026-09-09", time: "00:02" });
});

test("request and decision paths keep ownership and admin authorization server-side", async () => {
  const service = await readFile(new URL("../../lib/workforce/clock/service.ts", import.meta.url), "utf8");
  const action = await readFile(new URL("../../app/actions/workforceClock.ts", import.meta.url), "utf8");
  assert.match(service, /resolveOwnActiveEmployment\(actor\)/);
  assert.match(service, /actor\.role !== "ADMIN"/);
  assert.match(service, /Motivo de rechazo obligatorio/);
  assert.match(service, /status !== "PENDING"/);
  assert.match(action, /parseZonedDateTimeLocal/);
});
