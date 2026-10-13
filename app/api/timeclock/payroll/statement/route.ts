import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getEmployeePayrollDetail } from "@/app/actions/payroll";

export const runtime = "nodejs";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const INK = rgb(0.09, 0.12, 0.12);
const MUTED = rgb(0.32, 0.38, 0.36);
const ACCENT = rgb(0.08, 0.32, 0.25);
const PALE = rgb(0.93, 0.96, 0.93);
const LINE = rgb(0.78, 0.83, 0.79);

function cleanText(value: string) {
  return value.replace(/[–—]/g, "-").replace(/·/g, " - ").replace(/\u00a0/g, " ");
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function dateRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "UTC" });
  return `${formatter.format(new Date(`${start}T00:00:00.000Z`))} - ${formatter.format(new Date(`${end}T00:00:00.000Z`))}`;
}

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

function money(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}

function hours(value: number) {
  const totalMinutes = Math.max(0, Math.round(value * 60));
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function drawWrapped(page: PDFPage, text: string, options: { x: number; y: number; width: number; font: PDFFont; size: number; color?: ReturnType<typeof rgb>; lineGap?: number }) {
  const color = options.color ?? INK;
  const lineGap = options.lineGap ?? 4;
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
    page.drawText(entry, { x: options.x, y: options.y - index * (options.size + lineGap), font: options.font, size: options.size, color });
  });
  return options.y - lines.length * (options.size + lineGap);
}

function footer(page: PDFPage, pageNumber: number, font: PDFFont) {
  page.drawLine({ start: { x: MARGIN, y: 30 }, end: { x: PAGE_WIDTH - MARGIN, y: 30 }, thickness: 0.5, color: LINE });
  page.drawText("Documento informativo generado desde MAESTRO", { x: MARGIN, y: 18, font, size: 7, color: MUTED });
  page.drawText(`Pagina ${pageNumber}`, { x: PAGE_WIDTH - MARGIN - 45, y: 18, font, size: 7, color: MUTED });
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const userId = searchParams.get("userId")?.trim();
  const weekStart = searchParams.get("weekStart")?.trim();
  if (!userId || !weekStart) return new Response("Faltan datos del expediente", { status: 400 });

  const result = await getEmployeePayrollDetail(userId, weekStart);
  if ("error" in result) return new Response(result.error, { status: result.error === "No tienes permiso" ? 401 : 404 });
  const detail = result.data;
  if (detail.approval.status !== "APROBADA" && detail.approval.status !== "PAGADA") {
    return new Response("El expediente todavía no está aprobado", { status: 409 });
  }

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let pageNumber = 0;
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pageNumber += 1;
  footer(page, pageNumber, regular);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNumber += 1;
    footer(page, pageNumber, regular);
    y = PAGE_HEIGHT - MARGIN;
  };
  const ensureSpace = (needed: number) => {
    if (y - needed < 52) newPage();
  };

  page.drawText("RESUMEN DE HORAS APROBADAS", { x: MARGIN, y, font: bold, size: 18, color: ACCENT });
  y -= 27;
  page.drawText("Explicacion semanal para revision del empleado", { x: MARGIN, y, font: regular, size: 10, color: MUTED });
  y -= 28;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1.2, color: ACCENT });
  y -= 25;

  page.drawText(cleanText(detail.employee.name), { x: MARGIN, y, font: bold, size: 15, color: INK });
  y -= 19;
  page.drawText(`Semana: ${cleanText(dateRange(detail.weekStart, detail.weekEnd))}`, { x: MARGIN, y, font: regular, size: 10, color: MUTED });
  y -= 26;

  page.drawRectangle({ x: MARGIN, y: y - 78, width: CONTENT_WIDTH, height: 92, color: PALE, borderColor: LINE, borderWidth: 0.7 });
  page.drawText("Estado del expediente", { x: MARGIN + 14, y: y - 19, font: bold, size: 9, color: ACCENT });
  page.drawText(detail.approval.status === "PAGADA" ? "PAGADA" : "APROBADA", { x: MARGIN + 14, y: y - 39, font: bold, size: 13, color: INK });
  page.drawText(`Aprobada por: ${cleanText(detail.approval.approvedByName ?? "-" )}`, { x: MARGIN + 170, y: y - 19, font: regular, size: 9, color: MUTED });
  page.drawText(`Fecha: ${detail.approval.approvedAt ? cleanText(dateTimeLabel(detail.approval.approvedAt)) : "-"}`, { x: MARGIN + 170, y: y - 39, font: regular, size: 9, color: MUTED });
  page.drawText("Este resumen usa las horas congeladas al momento de la aprobacion.", { x: MARGIN + 14, y: y - 64, font: regular, size: 8, color: MUTED });
  y -= 105;

  const metrics = [
    ["Horas aprobadas", hours(detail.totalHours)],
    ["Pago por horas", money(detail.basePay)],
    ["Ajustes", money(detail.adjustmentsTotal)],
    ["Total", money(detail.finalPay)],
  ];
  const metricWidth = CONTENT_WIDTH / metrics.length;
  metrics.forEach(([label, value], index) => {
    const x = MARGIN + index * metricWidth;
    page.drawText(label, { x, y, font: regular, size: 8, color: MUTED });
    page.drawText(cleanText(value), { x, y: y - 17, font: bold, size: 12, color: INK });
  });
  y -= 48;

  page.drawText("Detalle diario", { x: MARGIN, y, font: bold, size: 12, color: ACCENT });
  y -= 22;
  for (const day of detail.days) {
    const actualLines = day.entries.length > 0
      ? day.entries.map((entry) => `${entry.branchName}: ${timeLabel(entry.clockIn)} - ${entry.clockOut ? timeLabel(entry.clockOut) : "sin salida"}`).join("; ")
      : "Sin registro de entrada y salida";
    const schedule = day.scheduled ? `${day.scheduled.branchName}: ${day.scheduled.startTime} - ${day.scheduled.endTime}` : "Sin turno programado";
    const explanation = day.incident
      ? `${INCIDENT_LABELS[day.incident] ?? day.incident}${day.justifiedNotes ? ` - Justificacion: ${day.justifiedNotes}` : ""}`
      : day.justifiedNotes ? `Justificacion: ${day.justifiedNotes}` : "Sin incidencia";
    const rowHeight = 72;
    ensureSpace(rowHeight + 12);
    page.drawRectangle({ x: MARGIN, y: y - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: pageNumber % 2 === 0 ? rgb(0.98, 0.99, 0.98) : rgb(1, 1, 1), borderColor: LINE, borderWidth: 0.5 });
    page.drawText(cleanText(dateLabel(day.date)), { x: MARGIN + 10, y: y - 16, font: bold, size: 9, color: INK });
    page.drawText(hours(day.hoursWorked), { x: PAGE_WIDTH - MARGIN - 48, y: y - 16, font: bold, size: 11, color: ACCENT });
    page.drawText("Programado", { x: MARGIN + 10, y: y - 33, font: bold, size: 7, color: MUTED });
    drawWrapped(page, schedule, { x: MARGIN + 74, y: y - 33, width: CONTENT_WIDTH - 160, font: regular, size: 7.5, color: MUTED, lineGap: 2 });
    page.drawText("Registrado", { x: MARGIN + 10, y: y - 48, font: bold, size: 7, color: MUTED });
    drawWrapped(page, actualLines, { x: MARGIN + 74, y: y - 48, width: CONTENT_WIDTH - 84, font: regular, size: 7.5, color: INK, lineGap: 2 });
    drawWrapped(page, explanation, { x: MARGIN + 10, y: y - 64, width: CONTENT_WIDTH - 20, font: regular, size: 7.2, color: MUTED, lineGap: 2 });
    y -= rowHeight + 8;
  }

  if (detail.adjustments.length > 0) {
    ensureSpace(85);
    page.drawText("Ajustes incluidos", { x: MARGIN, y, font: bold, size: 12, color: ACCENT });
    y -= 19;
    for (const adjustment of detail.adjustments) {
      const sign = adjustment.type === "BONO" ? "+" : "-";
      const line = `${adjustment.concept}: ${sign}${money(adjustment.amount)}${adjustment.notes ? ` - ${adjustment.notes}` : ""}`;
      y = drawWrapped(page, line, { x: MARGIN, y, width: CONTENT_WIDTH, font: regular, size: 8.5, color: INK, lineGap: 3 }) - 5;
    }
  }

  const bytes = await pdf.save();
  const filename = `horas-aprobadas-${detail.employee.name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")}-${detail.weekStart}.pdf`;
  const download = searchParams.get("download") === "1";
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename || `horas-aprobadas-${detail.weekStart}.pdf`}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

const INCIDENT_LABELS: Record<string, string> = {
  SIN_SALIDA: "Sin salida registrada",
  SIN_TURNO: "Trabajo sin turno programado",
  TURNO_NO_TRABAJADO: "Turno programado no trabajado",
  LLEGADA_TARDE: "Llegada tarde",
  SALIDA_ANTICIPADA: "Salida anticipada",
};
