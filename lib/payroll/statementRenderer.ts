import { type PDFDocument, type PDFFont, rgb } from "pdf-lib";
import {
  COMPANY_NAME,
  COMPANY_TRADE_NAME,
  COMPANY_ADDRESS,
  LEGAL_REPRESENTATIVE,
} from "@/lib/payroll/compositeSalary";
import { numberToMexicanCurrencyText } from "@/lib/payroll/numberToWords";
import type { PayrollEmployeeDetail } from "@/app/actions/payroll";
import { reconcilePayrollReceipt } from "@/lib/payroll/contractualSupplement";

// Formato Carta (Letter): 612 x 792 puntos
export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;
export const MARGIN = 36;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 540 pt

export const INK = rgb(0.1, 0.12, 0.12);
export const MUTED = rgb(0.35, 0.38, 0.38);
export const BRAND_PRIMARY = rgb(0.06, 0.3, 0.22); // Verde esmeralda agavero
export const BRAND_SECONDARY = rgb(0.12, 0.42, 0.32);
export const BG_HEADER = rgb(0.94, 0.97, 0.95);
export const BG_ALT = rgb(0.97, 0.98, 0.97);
export const BG_HIGHLIGHT = rgb(0.92, 0.96, 0.93);
export const LINE = rgb(0.76, 0.82, 0.78);
export const LINE_DARK = rgb(0.4, 0.48, 0.44);

export function cleanText(value: string) {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/·/g, " - ")
    .replace(/\u00a0/g, " ")
    .trim();
}

export function dateRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${start}T00:00:00.000Z`))} al ${formatter.format(new Date(`${end}T00:00:00.000Z`))}`;
}

export function shortDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function money(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

export function hours(value: number) {
  const totalMinutes = Math.max(0, Math.round(value * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function drawWrapped(
  page: any,
  text: string,
  options: {
    x: number;
    y: number;
    width: number;
    font: PDFFont;
    size: number;
    color?: ReturnType<typeof rgb>;
    lineGap?: number;
  }
) {
  const color = options.color ?? INK;
  const lineGap = options.lineGap ?? 3;
  const words = cleanText(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (options.font.widthOfTextAtSize(candidate, options.size) <= options.width || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  lines.forEach((entry, index) => {
    page.drawText(entry, {
      x: options.x,
      y: options.y - index * (options.size + lineGap),
      font: options.font,
      size: options.size,
      color,
    });
  });
  return options.y - lines.length * (options.size + lineGap);
}

/**
 * Renderiza la hoja de recibo de un empleado en un PDFDocument.
 */
export async function renderPayrollStatementPage(
  pdf: PDFDocument,
  detail: PayrollEmployeeDetail,
  fonts: { regular: PDFFont; bold: PDFFont },
  pageIndex = 1,
  totalPages = 1
) {
  const { regular, bold } = fonts;
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  let y = PAGE_HEIGHT - MARGIN;

  // ─── 1. ENCABEZADO PATRONAL E INSTITUCIONAL ──────────────────────────────────
  page.drawRectangle({
    x: MARGIN,
    y: y - 56,
    width: CONTENT_WIDTH,
    height: 56,
    color: BG_HEADER,
    borderColor: BRAND_PRIMARY,
    borderWidth: 1,
  });

  page.drawText(COMPANY_NAME, {
    x: MARGIN + 12,
    y: y - 18,
    font: bold,
    size: 11,
    color: BRAND_PRIMARY,
  });

  page.drawText(`${COMPANY_TRADE_NAME} · DOMICILIO FISCAL: ${COMPANY_ADDRESS}`, {
    x: MARGIN + 12,
    y: y - 31,
    font: regular,
    size: 7,
    color: MUTED,
  });

  page.drawText("RECIBO INDIVIDUAL DE PAGO Y LIQUIDACIÓN SEMANAL", {
    x: MARGIN + 12,
    y: y - 46,
    font: bold,
    size: 8.5,
    color: INK,
  });

  const statusBadge = detail.approval.status === "PAGADA" ? "PAGADA" : "APROBADA";
  const statusWidth = bold.widthOfTextAtSize(statusBadge, 9) + 16;
  page.drawRectangle({
    x: PAGE_WIDTH - MARGIN - statusWidth - 12,
    y: y - 24,
    width: statusWidth,
    height: 16,
    color: BRAND_PRIMARY,
  });
  page.drawText(statusBadge, {
    x: PAGE_WIDTH - MARGIN - statusWidth - 4,
    y: y - 20,
    font: bold,
    size: 8.5,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Semana: ${detail.weekStart}`, {
    x: PAGE_WIDTH - MARGIN - 105,
    y: y - 44,
    font: bold,
    size: 7.5,
    color: MUTED,
  });

  y -= 66;

  // ─── 2. DATOS DEL TRABAJADOR Y PERIODO ──────────────────────────────────────
  const infoBoxHeight = 36;
  page.drawRectangle({
    x: MARGIN,
    y: y - infoBoxHeight,
    width: CONTENT_WIDTH,
    height: infoBoxHeight,
    color: rgb(1, 1, 1),
    borderColor: LINE,
    borderWidth: 0.8,
  });

  page.drawText("TRABAJADOR(A):", { x: MARGIN + 10, y: y - 14, font: bold, size: 7.5, color: MUTED });
  page.drawText(cleanText(detail.employee.name).toUpperCase(), { x: MARGIN + 85, y: y - 14, font: bold, size: 9, color: INK });

  page.drawText("PERIODO:", { x: MARGIN + 10, y: y - 26, font: bold, size: 7.5, color: MUTED });
  page.drawText(cleanText(dateRange(detail.weekStart, detail.weekEnd)), { x: MARGIN + 85, y: y - 26, font: regular, size: 7.5, color: INK });

  const sucursalName = detail.days.find((d) => d.entries[0]?.branchName)?.entries[0]?.branchName ?? "Planta Destiladora del Norte";
  page.drawText("SUCURSAL:", { x: MARGIN + 330, y: y - 14, font: bold, size: 7.5, color: MUTED });
  page.drawText(cleanText(sucursalName), { x: MARGIN + 385, y: y - 14, font: regular, size: 7.5, color: INK });

  page.drawText("TIPO DE JORNADA:", { x: MARGIN + 330, y: y - 26, font: bold, size: 7.5, color: MUTED });
  page.drawText("8 hrs ordinarias (Cláusula 4ª)", { x: MARGIN + 418, y: y - 26, font: regular, size: 7.5, color: INK });

  y -= infoBoxHeight + 8;

  // ─── 3. TARIFA BASE Y ADICIONAL REAL DEL SNAPSHOT ────────────────────────
  const supplement = detail.supplement ?? {
    aguinaldoReference: 0, vacationsReference: 0, vacationPremiumReference: 0, total: 0,
  };
  const reconciliation = reconcilePayrollReceipt(
    detail.basePay, detail.overtimePay, supplement.total, detail.adjustments, detail.finalPay,
  );
  if (!reconciliation.matchesApproved) {
    throw new Error("PAYROLL_RECEIPT_TOTAL_MISMATCH: revisa los conceptos, sin compensaciones de centavos.");
  }
  const perHour = (amount: number) => detail.totalHours > 0
    ? Math.round(amount / detail.totalHours * 100) / 100 : 0;
  const hourlyBase = perHour(detail.basePay);
  const composite = {
    baseHourlyRate: hourlyBase,
    aguinaldoHourly: perHour(supplement.aguinaldoReference),
    vacacionesHourly: perHour(supplement.vacationsReference),
    primaVacacionalHourly: perHour(supplement.vacationPremiumReference),
    totalHourlyRate: perHour(detail.basePay + supplement.total),
  };
  page.drawText("DESGLOSE DE TARIFA POR HORA (BASE Y REFERENCIAS DEL ADICIONAL PAGADO)", {
    x: MARGIN, y, font: bold, size: 7.5, color: BRAND_PRIMARY,
  });
  y -= 10;

  const rateColWidth = CONTENT_WIDTH / 5;
  const rateBoxHeight = 40;
  page.drawRectangle({
    x: MARGIN,
    y: y - rateBoxHeight,
    width: CONTENT_WIDTH,
    height: rateBoxHeight,
    color: BG_ALT,
    borderColor: LINE,
    borderWidth: 0.8,
  });

  const rateColumns = [
    { title: "Sueldo Base / Hora", sub: "Según horas aprobadas", value: money(composite.baseHourlyRate) },
    { title: "Ref. Aguinaldo", sub: "Adicional contractual", value: money(composite.aguinaldoHourly) },
    { title: "Ref. Vacaciones", sub: "Adicional contractual", value: money(composite.vacacionesHourly) },
    { title: "Ref. Prima Vac.", sub: "Adicional contractual", value: money(composite.primaVacacionalHourly) },
    { title: "TARIFA TOTAL / HORA", sub: "Base + adicional pagado", value: money(composite.totalHourlyRate), highlight: true },
  ];

  rateColumns.forEach((col, index) => {
    const x = MARGIN + index * rateColWidth;
    if (col.highlight) {
      page.drawRectangle({
        x,
        y: y - rateBoxHeight,
        width: rateColWidth,
        height: rateBoxHeight,
        color: BG_HIGHLIGHT,
        borderColor: BRAND_SECONDARY,
        borderWidth: 1,
      });
    }
    page.drawText(col.title, { x: x + 6, y: y - 12, font: bold, size: 6.8, color: col.highlight ? BRAND_PRIMARY : INK });
    page.drawText(col.sub, { x: x + 6, y: y - 21, font: regular, size: 5.8, color: MUTED });
    page.drawText(col.value, { x: x + 6, y: y - 34, font: bold, size: 9, color: col.highlight ? BRAND_PRIMARY : INK });
  });

  y -= rateBoxHeight + 10;

  // ─── 4. LIQUIDACIÓN DE LA SEMANA ─────────────────────────────────────────────
  page.drawText("DESGLOSE DE PERCEPCIONES EFECTIVAMENTE REGISTRADAS", {
    x: MARGIN,
    y,
    font: bold,
    size: 7.5,
    color: BRAND_PRIMARY,
  });
  y -= 10;

  // Solo se imprimen percepciones aprobadas. No ajustar centavos ni distribuir
  // prestaciones que no estén registradas efectivamente en el snapshot.
  const adjustedTotal = detail.finalPay;
  const concepts: { num: string; name: string; detail: string; amount: number }[] = [];
  const add = (name: string, detailText: string, amount: number) => {
    if (Math.round(amount * 100) === 0) return;
    concepts.push({ num: String(concepts.length + 1).padStart(2, "0"), name, detail: detailText, amount });
  };
  add("Sueldo Ordinario Devengado", `${hours(detail.totalHours)} laboradas a la tarifa base`, detail.basePay);
  add("Horas Extraordinarias", "Importe efectivamente registrado", detail.overtimePay);
  add("Referencia Aguinaldo (adicional)", "Parte informativa del adicional contractual pagado", supplement.aguinaldoReference);
  add("Referencia Vacaciones (adicional)", "Parte informativa del adicional contractual pagado", supplement.vacationsReference);
  add("Referencia Prima Vacacional", "Parte informativa del adicional contractual pagado", supplement.vacationPremiumReference);
  for (const adj of detail.adjustments.filter((item) => item.origin !== "CONTRACTUAL_SUPPLEMENT")) {
    add(adj.type === "DEDUCCION" ? "Deducción documentada" : "Bono documentado",
      cleanText(adj.concept).slice(0, 48), adj.type === "DEDUCCION" ? -adj.amount : adj.amount);
  }
  // El total anterior ya fue conciliado en centavos: no se inventa un
  // renglón negativo para cuadrar conceptos.
  const tableHeight = 18 + concepts.length * 15 + 24;
  page.drawRectangle({
    x: MARGIN,
    y: y - tableHeight,
    width: CONTENT_WIDTH,
    height: tableHeight,
    color: rgb(1, 1, 1),
    borderColor: LINE,
    borderWidth: 0.8,
  });

  // Table header
  page.drawRectangle({
    x: MARGIN,
    y: y - 16,
    width: CONTENT_WIDTH,
    height: 16,
    color: BG_ALT,
  });
  page.drawText("#", { x: MARGIN + 8, y: y - 11, font: bold, size: 7, color: MUTED });
  page.drawText("CONCEPTO DE PERCEPCIÓN", { x: MARGIN + 28, y: y - 11, font: bold, size: 7, color: MUTED });
  page.drawText("FUNDAMENTO / DETALLE", { x: MARGIN + 220, y: y - 11, font: bold, size: 7, color: MUTED });
  page.drawText("IMPORTE (MXN)", { x: PAGE_WIDTH - MARGIN - 80, y: y - 11, font: bold, size: 7, color: MUTED });

  let rowY = y - 28;
  concepts.forEach((concept, i) => {
    if (i % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: rowY - 4,
        width: CONTENT_WIDTH,
        height: 14,
        color: rgb(0.985, 0.99, 0.985),
      });
    }
    page.drawText(concept.num, { x: MARGIN + 8, y: rowY, font: regular, size: 7, color: MUTED });
    page.drawText(concept.name, { x: MARGIN + 28, y: rowY, font: bold, size: 7.5, color: INK });
    page.drawText(concept.detail, { x: MARGIN + 220, y: rowY, font: regular, size: 6.8, color: MUTED });
    page.drawText(money(concept.amount), { x: PAGE_WIDTH - MARGIN - 75, y: rowY, font: bold, size: 7.5, color: INK });
    rowY -= 15;
  });

  // Total footer row
  page.drawRectangle({
    x: MARGIN,
    y: y - tableHeight,
    width: CONTENT_WIDTH,
    height: 22,
    color: BG_HIGHLIGHT,
    borderColor: BRAND_PRIMARY,
    borderWidth: 0.8,
  });
  page.drawText("TOTAL APROBADO A PAGAR EN LA SEMANA:", {
    x: MARGIN + 12,
    y: y - tableHeight + 7,
    font: bold,
    size: 8,
    color: BRAND_PRIMARY,
  });
  page.drawText(money(adjustedTotal), {
    x: PAGE_WIDTH - MARGIN - 90,
    y: y - tableHeight + 6,
    font: bold,
    size: 11,
    color: BRAND_PRIMARY,
  });

  y -= tableHeight + 5;

  // Letra del monto
  const currencyText = numberToMexicanCurrencyText(adjustedTotal);
  page.drawText(`(${currencyText})`, {
    x: MARGIN + 6,
    y,
    font: bold,
    size: 6.8,
    color: MUTED,
  });

  y -= 14;

  // ─── 5. ASISTENCIA DIARIA ────────────────────────────────────────────────────
  page.drawText("REGISTRO DE ASISTENCIA SEMANAL (LUNES A DOMINGO)", {
    x: MARGIN,
    y,
    font: bold,
    size: 7.5,
    color: BRAND_PRIMARY,
  });
  y -= 8;

  const dayBoxWidth = CONTENT_WIDTH / 7;
  const dayBoxHeight = 36;
  page.drawRectangle({
    x: MARGIN,
    y: y - dayBoxHeight,
    width: CONTENT_WIDTH,
    height: dayBoxHeight,
    color: rgb(1, 1, 1),
    borderColor: LINE,
    borderWidth: 0.8,
  });

  detail.days.forEach((day, index) => {
    const x = MARGIN + index * dayBoxWidth;
    if (index > 0) {
      page.drawLine({
        start: { x, y },
        end: { x, y: y - dayBoxHeight },
        thickness: 0.5,
        color: LINE,
      });
    }
    const isRest = day.hoursWorked === 0 && !day.scheduled;
    page.drawText(shortDateLabel(day.date).toUpperCase(), {
      x: x + 4,
      y: y - 10,
      font: bold,
      size: 6.5,
      color: isRest ? MUTED : INK,
    });
    page.drawText(isRest ? "Descanso" : hours(day.hoursWorked), {
      x: x + 4,
      y: y - 22,
      font: bold,
      size: isRest ? 6.5 : 7.8,
      color: isRest ? MUTED : BRAND_PRIMARY,
    });
    const subLabel = day.incident ? (day.justified ? "Justificada" : "Incidencia") : day.hoursWorked > 0 ? "Asistencia" : "Libre";
    page.drawText(subLabel, {
      x: x + 4,
      y: y - 31,
      font: regular,
      size: 5.8,
      color: MUTED,
    });
  });

  y -= dayBoxHeight + 12;

  // ─── 6. CLÁUSULA LEGAL DE FINIQUITO CONTINUO ────────────────────────────────
  const legalClauseHeight = 56;
  page.drawRectangle({
    x: MARGIN,
    y: y - legalClauseHeight,
    width: CONTENT_WIDTH,
    height: legalClauseHeight,
    color: BG_ALT,
    borderColor: LINE_DARK,
    borderWidth: 0.8,
  });

  page.drawText("CONSTANCIA DE RECIBO (SIN RENUNCIA DE DERECHOS):", {
    x: MARGIN + 8,
    y: y - 10,
    font: bold,
    size: 6.8,
    color: INK,
  });

  const legalText = `El presente recibo refleja las horas, importes y ajustes registrados en MAESTRO para el periodo. Su aprobación no acredita necesariamente pago bancario ni liquidación de aguinaldo, vacaciones, prima vacacional, descanso semanal u otros derechos laborales. La firma, si se recaba, reconoce la consulta del desglose y no representa finiquito, renuncia a prestaciones ni liberación general de obligaciones del patrón.`;

  drawWrapped(page, legalText, {
    x: MARGIN + 8,
    y: y - 20,
    width: CONTENT_WIDTH - 16,
    font: regular,
    size: 5.6,
    color: INK,
    lineGap: 2.2,
  });

  y -= legalClauseHeight + 24;

  // ─── 7. ESPACIO DE FIRMAS ───────────────────────────────────────────────────
  const colSigWidth = (CONTENT_WIDTH - 40) / 2;

  // Firma Patronal
  page.drawLine({
    start: { x: MARGIN + 10, y: y },
    end: { x: MARGIN + 10 + colSigWidth, y },
    thickness: 0.8,
    color: INK,
  });
  page.drawText("POR EL PATRÓN", {
    x: MARGIN + 10,
    y: y - 10,
    font: bold,
    size: 6.8,
    color: MUTED,
  });
  page.drawText(LEGAL_REPRESENTATIVE, {
    x: MARGIN + 10,
    y: y - 20,
    font: bold,
    size: 8,
    color: INK,
  });
  page.drawText(COMPANY_NAME, {
    x: MARGIN + 10,
    y: y - 29,
    font: regular,
    size: 6.5,
    color: MUTED,
  });

  // Firma Trabajador
  const xTrabajador = PAGE_WIDTH - MARGIN - colSigWidth - 10;

  if (detail.signature?.signatureData) {
    try {
      const base64Data = detail.signature.signatureData.replace(/^data:image\/\w+;base64,/, "");
      const imageBytes = Buffer.from(base64Data, "base64");
      const pngImage = await pdf.embedPng(imageBytes);
      const targetHeight = 36;
      const scale = targetHeight / pngImage.height;
      const renderWidth = Math.min(pngImage.width * scale, colSigWidth - 20);
      const renderHeight = targetHeight;
      page.drawImage(pngImage, {
        x: xTrabajador + (colSigWidth - renderWidth) / 2,
        y: y + 2,
        width: renderWidth,
        height: renderHeight,
      });
    } catch (err) {
      console.error("[statementRenderer] Error incrustando firma en PDF:", err);
    }
  }

  page.drawLine({
    start: { x: xTrabajador, y },
    end: { x: xTrabajador + colSigWidth, y },
    thickness: 0.8,
    color: INK,
  });
  page.drawText("FIRMA DE CONFORMIDAD DEL TRABAJADOR(A)", {
    x: xTrabajador,
    y: y - 10,
    font: bold,
    size: 6.8,
    color: MUTED,
  });
  page.drawText(cleanText(detail.employee.name).toUpperCase(), {
    x: xTrabajador,
    y: y - 20,
    font: bold,
    size: 8,
    color: INK,
  });

  if (detail.signature?.signedAt) {
    const signedDate = new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Mexico_City",
    }).format(new Date(detail.signature.signedAt));
    page.drawText(`Firmado digitalmente el ${signedDate}`, {
      x: xTrabajador,
      y: y - 29,
      font: bold,
      size: 6.2,
      color: BRAND_PRIMARY,
    });
    page.drawText(`Acreditación de consentimiento continuo · Art. 108 LFT`, {
      x: xTrabajador,
      y: y - 37,
      font: regular,
      size: 5.5,
      color: MUTED,
    });
  } else {
    page.drawText("Recibí en efectivo / transferencia bancaria a entera conformidad", {
      x: xTrabajador,
      y: y - 29,
      font: regular,
      size: 6,
      color: MUTED,
    });
  }

  // Footer institucional
  page.drawLine({
    start: { x: MARGIN, y: 22 },
    end: { x: PAGE_WIDTH - MARGIN, y: 22 },
    thickness: 0.5,
    color: LINE,
  });
  page.drawText(
    `Documento oficial de control interno y liquidación de nómina · Generado desde MAESTRO el ${new Date().toLocaleDateString("es-MX")}`,
    {
      x: MARGIN,
      y: 12,
      font: regular,
      size: 6,
      color: MUTED,
    }
  );
  page.drawText(`Página ${pageIndex} de ${totalPages}`, {
    x: PAGE_WIDTH - MARGIN - 54,
    y: 12,
    font: regular,
    size: 6,
    color: MUTED,
  });
}
