import test from "node:test";
import assert from "node:assert/strict";

function getTriggerCategory(triggerType) {
  switch (triggerType) {
    case "STOCK_BAJO":
    case "RECONTEO_PENDIENTE":
      return "INVENTORY";
    case "LICOR_CADUCIDAD":
    case "PROCESO_ATRASADO":
      return "PRODUCTION";
    case "CORTE_DIFERENCIA":
      return "POS";
    default:
      return "SYSTEM";
  }
}

function getTriggerPriority(triggerType) {
  switch (triggerType) {
    case "CORTE_DIFERENCIA":
    case "PROCESO_ATRASADO":
      return "URGENT";
    case "STOCK_BAJO":
    case "LICOR_CADUCIDAD":
      return "HIGH";
    default:
      return "NORMAL";
  }
}

function computeCashCutDifferenceAlert(difference, userName, cutCode) {
  if (Math.abs(difference) < 1) return null;
  const formattedDiff = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(difference);
  const diffWord = difference < 0 ? "FALTANTE" : "SOBRANTE";

  return {
    title: `⚠️ Diferencia en corte (${diffWord}): ${formattedDiff}`,
    body: `${userName} cerró un corte con diferencia de ${formattedDiff}. Revisa el arqueo y desglose.`,
    category: "POS",
    priority: "URGENT",
  };
}

function createShiftRequestNotification(userName, type, reason) {
  const typeLabel =
    type === "SWAP"
      ? "Intercambio de turno"
      : type === "CHANGE_TIME"
      ? "Cambio de horario"
      : type === "DAY_OFF"
      ? "Día libre"
      : "Inasistencia";

  return {
    title: `🔄 Solicitud de turno: ${userName}`,
    body: `${userName} solicitó ${typeLabel}: ${reason}`,
    category: "TIMECLOCK",
    priority: "NORMAL",
  };
}

function createPayrollPaidNotification(weekStart) {
  return {
    title: "💵 Pago de nómina emitido",
    body: `Tu pago de la semana ${weekStart} ha sido procesado. Tu recibo oficial ya está disponible para consulta y firma digital.`,
    category: "PAYROLL",
    priority: "HIGH",
    href: "/timeclock/payroll",
  };
}

test("Automatic check trigger types map to correct categories and priorities", () => {
  assert.equal(getTriggerCategory("STOCK_BAJO"), "INVENTORY");
  assert.equal(getTriggerPriority("STOCK_BAJO"), "HIGH");

  assert.equal(getTriggerCategory("LICOR_CADUCIDAD"), "PRODUCTION");
  assert.equal(getTriggerPriority("LICOR_CADUCIDAD"), "HIGH");

  assert.equal(getTriggerCategory("CORTE_DIFERENCIA"), "POS");
  assert.equal(getTriggerPriority("CORTE_DIFERENCIA"), "URGENT");

  assert.equal(getTriggerCategory("PROCESO_ATRASADO"), "PRODUCTION");
  assert.equal(getTriggerPriority("PROCESO_ATRASADO"), "URGENT");
});
test("Cash cut difference alert triggers on shortages and overages", () => {
  // Below threshold: no alert
  assert.equal(computeCashCutDifferenceAlert(0, "Ana", "CORTE-01"), null);
  assert.equal(computeCashCutDifferenceAlert(0.5, "Ana", "CORTE-01"), null);
  assert.equal(computeCashCutDifferenceAlert(-0.8, "Ana", "CORTE-01"), null);

  // Shortage (negative difference)
  const shortage = computeCashCutDifferenceAlert(-150, "Carlos", "CORTE-02");
  assert.ok(shortage !== null);
  assert.equal(shortage.category, "POS");
  assert.equal(shortage.priority, "URGENT");
  assert.ok(shortage.title.includes("FALTANTE"));

  // Overage (positive difference)
  const overage = computeCashCutDifferenceAlert(200, "Carlos", "CORTE-03");
  assert.ok(overage !== null);
  assert.equal(overage.category, "POS");
  assert.equal(overage.priority, "URGENT");
  assert.ok(overage.title.includes("SOBRANTE"));
});

test("Shift request notification resolves correct labels", () => {
  const swapNotif = createShiftRequestNotification("Luis", "SWAP", "Tengo cita médica");
  assert.equal(swapNotif.category, "TIMECLOCK");
  assert.ok(swapNotif.body.includes("Intercambio de turno"));
  assert.ok(swapNotif.body.includes("Tengo cita médica"));

  const changeTimeNotif = createShiftRequestNotification("María", "CHANGE_TIME", "Entrada a las 10:00");
  assert.ok(changeTimeNotif.body.includes("Cambio de horario"));
});

test("Payroll paid notification targets employee self-service view", () => {
  const notif = createPayrollPaidNotification("2026-10-20");
  assert.equal(notif.category, "PAYROLL");
  assert.equal(notif.priority, "HIGH");
  assert.equal(notif.href, "/timeclock/payroll");
});
