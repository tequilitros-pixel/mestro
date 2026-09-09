import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_TIME_ZONE,
  businessDayEnd,
  businessDayRange,
  businessWeekRange,
  formatBusinessDateKey,
  formatBusinessDateOnly,
  formatBusinessDateTime,
  formatBusinessDateTimeLocal,
  formatBusinessTime,
  formatCivilDate,
  parseBusinessDateTimeLocal,
  sameBusinessDay,
} from "../lib/dateTime";

const at2038 = new Date("2026-09-09T02:38:00.000Z");

test("la zona oficial y el formato de hora son deterministas", () => {
  assert.equal(BUSINESS_TIME_ZONE, "America/Mexico_City");
  assert.equal(formatBusinessTime(at2038), "20:38");
  assert.equal(formatBusinessDateOnly(at2038), "2026-09-08");
  assert.equal(formatBusinessDateOnly("2026-09-08"), "2026-09-08");
  assert.equal(formatBusinessDateTimeLocal(at2038), "2026-09-08T20:38");
});

test("datetime-local se interpreta como hora civil de Ciudad de México", () => {
  assert.equal(parseBusinessDateTimeLocal("2026-09-08T20:38").toISOString(), "2026-09-09T02:38:00.000Z");
  assert.equal(parseBusinessDateTimeLocal("2026-09-08T23:59").toISOString(), "2026-09-09T05:59:00.000Z");
  assert.equal(parseBusinessDateTimeLocal("2026-09-09T00:01").toISOString(), "2026-09-09T06:01:00.000Z");
});

test("los límites del día de negocio no dependen del día UTC", () => {
  const range = businessDayRange("2026-09-08");
  assert.equal(range.start.toISOString(), "2026-09-08T06:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-09-09T06:00:00.000Z");
  assert.equal(businessDayEnd("2026-09-08").toISOString(), "2026-09-09T05:59:59.999Z");
  assert.equal(sameBusinessDay(new Date("2026-09-09T05:59:00Z"), new Date("2026-09-08T06:01:00Z")), true);
  assert.equal(sameBusinessDay(new Date("2026-09-09T06:01:00Z"), new Date("2026-09-08T06:01:00Z")), false);
});

test("las claves de negocio cruzan 23:59 y 00:01 en México sin offsets fijos", () => {
  assert.equal(formatBusinessDateKey(new Date("2026-09-09T05:59:59.999Z")), "20260908");
  assert.equal(formatBusinessDateKey(new Date("2026-09-09T06:00:00.000Z")), "20260909");
  assert.equal(formatBusinessDateKey(new Date("2026-09-09T06:01:00.000Z")), "20260909");
});

test("las bitácoras muestran un instante de producción en hora de negocio", () => {
  const fermentationReading = new Date("2026-09-09T17:11:12.718Z");
  const rendered = formatBusinessDateTime(fermentationReading);

  assert.equal(formatBusinessTime(fermentationReading), "11:11");
  assert.equal(formatBusinessDateOnly(fermentationReading), "2026-09-09");
  assert.match(rendered, /11:11/);
  assert.doesNotMatch(rendered, /17:11/);
});

test("las fechas civiles no se desplazan por la zona del host", () => {
  assert.equal(formatCivilDate("2026-09-09T00:00:00.000Z"), "9 sep 2026");
});

test("la semana de negocio empieza el lunes y cruza medianoche correctamente", () => {
  const range = businessWeekRange(at2038);
  assert.equal(range.start.toISOString(), "2026-09-07T06:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-09-14T06:00:00.000Z");
});
