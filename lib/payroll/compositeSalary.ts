/**
 * ==========================================================
 * MAESTRO — Salario Compuesto y Prestaciones Proporcionales
 * ----------------------------------------------------------
 * Desglose semanal de prestaciones proporcionales devengadas
 * conforme a la Ley Federal del Trabajo y Contrato Individual
 * de Trabajo (Agaveros y Tequileros del Norte S.A.S. de C.V.):
 *
 * - Cláusula Sexta: Salario base por hora más el equivalente
 *   proporcional semanal de prestaciones laborales.
 * - Cláusula Octava: 12 días de vacaciones anuales (art. 76 LFT)
 *   y 25% de prima vacacional.
 * - Cláusula Novena: 15 días de aguinaldo cubierto semanalmente.
 * ==========================================================
 */

export const COMPANY_NAME = "AGAVEROS Y TEQUILEROS DEL NORTE S.A.S. DE C.V.";
export const COMPANY_TRADE_NAME = "PLANTA DESTILADORA DEL NORTE";
export const COMPANY_ADDRESS = "Todos los Santos #63, Lomas de la Cruz, Colotlán, Jalisco, C.P. 46202";
export const LEGAL_REPRESENTATIVE = "José Adrián Sánchez Jiménez";

export const AGUINALDO_DAYS = 15;
export const VACACIONES_DAYS = 12;
export const PRIMA_VACACIONAL_PERCENT = 0.25;
export const DAYS_IN_YEAR = 365;

export const AGUINALDO_RATIO = AGUINALDO_DAYS / DAYS_IN_YEAR; // ~0.041096 (4.11%)
export const VACACIONES_RATIO = VACACIONES_DAYS / DAYS_IN_YEAR; // ~0.032877 (3.29%)
export const PRIMA_VACACIONAL_RATIO = VACACIONES_RATIO * PRIMA_VACACIONAL_PERCENT; // ~0.008219 (0.82%)

export type CompositeSalaryBreakdown = {
  // Cuotas por hora
  baseHourlyRate: number;
  aguinaldoHourly: number;
  vacacionesHourly: number;
  primaVacacionalHourly: number;
  totalHourlyRate: number;

  // Importes devengados en el periodo
  hoursWorked: number;
  basePay: number;
  aguinaldoPay: number;
  vacacionesPay: number;
  primaVacacionalPay: number;
  totalPay: number;
};

/**
 * Calcula el desglose del salario compuesto para una tarifa por hora y horas trabajadas.
 */
export function calculateCompositeSalary(
  hourlyRate: number,
  hoursWorked: number
): CompositeSalaryBreakdown {
  const baseHourlyRate = Math.round(hourlyRate * 100) / 100;

  // Cuotas por hora redondeadas a centavos para transparencia contable
  const aguinaldoHourly = Math.round(baseHourlyRate * AGUINALDO_RATIO * 100) / 100;
  const vacacionesHourly = Math.round(baseHourlyRate * VACACIONES_RATIO * 100) / 100;
  const primaVacacionalHourly = Math.round(baseHourlyRate * PRIMA_VACACIONAL_RATIO * 100) / 100;
  const totalHourlyRate = baseHourlyRate + aguinaldoHourly + vacacionesHourly + primaVacacionalHourly;

  // Totales de la semana
  const basePay = Math.round(baseHourlyRate * hoursWorked * 100) / 100;
  const aguinaldoPay = Math.round(aguinaldoHourly * hoursWorked * 100) / 100;
  const vacacionesPay = Math.round(vacacionesHourly * hoursWorked * 100) / 100;
  const primaVacacionalPay = Math.round(primaVacacionalHourly * hoursWorked * 100) / 100;
  const totalPay = basePay + aguinaldoPay + vacacionesPay + primaVacacionalPay;

  return {
    baseHourlyRate,
    aguinaldoHourly,
    vacacionesHourly,
    primaVacacionalHourly,
    totalHourlyRate,
    hoursWorked,
    basePay,
    aguinaldoPay,
    vacacionesPay,
    primaVacacionalPay,
    totalPay,
  };
}
