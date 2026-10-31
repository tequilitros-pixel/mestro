import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  OFFICIAL_WHATSAPP_DISPLAY,
  OFFICIAL_CONTRACT_CLAUSES,
  CONSUMO_PRICES_CATALOG,
  type TequilitrosQuoteMetadata,
} from "./quote-types";

export interface QuotePdfData {
  code: string;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  location: string;
  eventDate: string;
  guestCount: number;
  saleAmount: number;
  documentType: "QUOTE" | "CONTRACT" | "RECEIPT";
  metadata: TequilitrosQuoteMetadata;
}

export async function generateTequilitrosPdfBlob(data: QuotePdfData): Promise<Blob> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { metadata } = data;
  const isReceipt = data.documentType === "RECEIPT";
  const isContract = data.documentType === "CONTRACT" || (!isReceipt && metadata.isContractConfirmed);
  const isConsumo = metadata.modality === "consumo";

  const brandOrange = rgb(0.88, 0.53, 0.21);
  const darkGray = rgb(0.15, 0.18, 0.22);
  const mediumGray = rgb(0.4, 0.45, 0.5);
  const lightBg = rgb(0.96, 0.96, 0.97);
  const greenColor = rgb(0.08, 0.6, 0.35);

  const formattedEventDate = new Date(data.eventDate).toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const formattedIssueDate = new Date().toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const depositRequired = isConsumo
    ? data.saleAmount
    : metadata.depositRequired || Math.round(data.saleAmount * 0.5);
  const depositPaid = metadata.depositPaid ?? depositRequired;
  const balanceRemaining = isConsumo ? 0 : data.saleAmount - depositPaid;

  // ==========================================
  // DOCUMENTO TIPO: RECIBO OFICIAL DE ANTICIPO
  // ==========================================
  if (isReceipt) {
    const pageReceipt = doc.addPage([612, 792]);
    const { width } = pageReceipt.getSize();
    let yR = 745;

    // Encabezado
    pageReceipt.drawText("TEQUILITROS®", {
      x: 40,
      y: yR,
      size: 22,
      font: fontBold,
      color: brandOrange,
    });

    pageReceipt.drawText("RECIBO OFICIAL DE ANTICIPO", {
      x: 200,
      y: yR + 2,
      size: 11,
      font: fontBold,
      color: greenColor,
    });

    yR -= 16;
    pageReceipt.drawText("Destiladora del Norte · Coctelería Premium de Tequila", {
      x: 40,
      y: yR,
      size: 9,
      font: fontRegular,
      color: mediumGray,
    });

    pageReceipt.drawText(`WhatsApp Oficial: ${OFFICIAL_WHATSAPP_DISPLAY}`, {
      x: 40,
      y: yR - 12,
      size: 9,
      font: fontRegular,
      color: mediumGray,
    });

    // Cuadro superior derecho: Folios de recibo
    const recFolio = metadata.receiptFolio || `REC-${data.code.replace(/[^0-9]/g, "") || "0001"}`;
    const refFolio = metadata.contractFolio || data.code;

    pageReceipt.drawText("COMPROBANTE DE PAGO", {
      x: width - 230,
      y: 747,
      size: 9.5,
      font: fontBold,
      color: greenColor,
    });
    pageReceipt.drawText(`FOLIO: ${recFolio}`, {
      x: width - 230,
      y: 733,
      size: 11,
      font: fontBold,
      color: darkGray,
    });
    pageReceipt.drawText(`Contrato/Cotización: ${refFolio}`, {
      x: width - 230,
      y: 719,
      size: 8.5,
      font: fontRegular,
      color: mediumGray,
    });
    pageReceipt.drawText(`Emisión: ${formattedIssueDate}`, {
      x: width - 230,
      y: 706,
      size: 8.5,
      font: fontRegular,
      color: mediumGray,
    });

    // Línea divisoria
    yR = 690;
    pageReceipt.drawLine({
      start: { x: 40, y: yR },
      end: { x: width - 40, y: yR },
      thickness: 1,
      color: rgb(0.85, 0.87, 0.9),
    });

    // Cuadro Ficha Técnica (Cliente y Evento)
    yR -= 15;
    const cardH = 80;
    pageReceipt.drawRectangle({
      x: 40,
      y: yR - cardH,
      width: width - 80,
      height: cardH,
      color: lightBg,
      borderColor: rgb(0.85, 0.87, 0.9),
      borderWidth: 1,
    });

    // Cliente
    pageReceipt.drawText("DATOS DEL CLIENTE", { x: 55, y: yR - 18, size: 8, font: fontBold, color: mediumGray });
    pageReceipt.drawText(data.clientName, { x: 55, y: yR - 34, size: 12, font: fontBold, color: darkGray });
    pageReceipt.drawText(`Teléfono: ${data.clientPhone || "No especificado"}`, { x: 55, y: yR - 49, size: 8.5, font: fontRegular, color: darkGray });
    pageReceipt.drawText(`Correo: ${metadata.clientEmail || "No especificado"}`, { x: 55, y: yR - 62, size: 8.5, font: fontRegular, color: darkGray });

    // Evento
    const colR2 = 320;
    pageReceipt.drawText("EVENTO ASOCIADO", { x: colR2, y: yR - 18, size: 8, font: fontBold, color: mediumGray });
    pageReceipt.drawText(`Fecha del Evento: ${formattedEventDate}`, { x: colR2, y: yR - 34, size: 9, font: fontBold, color: darkGray });
    pageReceipt.drawText(`Sede: ${data.location} (${metadata.viaticosZone})`, { x: colR2, y: yR - 49, size: 8.5, font: fontRegular, color: darkGray });
    pageReceipt.drawText(`Tipo: ${metadata.eventType} · ${data.guestCount} pers. · ${metadata.durationHours} hrs`, { x: colR2, y: yR - 62, size: 8.5, font: fontRegular, color: darkGray });

    yR -= cardH + 25;

    // RECUADRO PRINCIPAL DE ANTICIPO RECIBIDO
    pageReceipt.drawText("DETALLE DE LA OPERACIÓN DE PAGO", {
      x: 40,
      y: yR,
      size: 9.5,
      font: fontBold,
      color: greenColor,
    });

    yR -= 12;
    const paymentCardH = 105;
    pageReceipt.drawRectangle({
      x: 40,
      y: yR - paymentCardH,
      width: width - 80,
      height: paymentCardH,
      color: rgb(0.94, 0.98, 0.95),
      borderColor: rgb(0.5, 0.82, 0.62),
      borderWidth: 1.5,
    });

    pageReceipt.drawText("MONTO TOTAL DEL ANTICIPO RECIBIDO:", {
      x: 60,
      y: yR - 22,
      size: 9,
      font: fontBold,
      color: darkGray,
    });

    pageReceipt.drawText(`$${depositPaid.toLocaleString("es-MX")} MXN`, {
      x: 60,
      y: yR - 50,
      size: 24,
      font: fontBold,
      color: greenColor,
    });

    const paymentDateStr = metadata.depositPaidAt
      ? new Date(metadata.depositPaidAt).toLocaleDateString("es-MX", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : formattedIssueDate;

    pageReceipt.drawText(`Fecha en que se cubrió: ${paymentDateStr}`, {
      x: 60,
      y: yR - 70,
      size: 9,
      font: fontRegular,
      color: darkGray,
    });

    pageReceipt.drawText(`Forma de Pago: ${metadata.depositMethod || "Efectivo en Sucursal"}`, {
      x: 60,
      y: yR - 86,
      size: 9,
      font: fontBold,
      color: darkGray,
    });

    // Columna lateral dentro del cuadro
    pageReceipt.drawText(`Recibido por: ${metadata.depositReceivedByName || metadata.creatorName}`, {
      x: 340,
      y: yR - 70,
      size: 8.5,
      font: fontRegular,
      color: darkGray,
    });
    pageReceipt.drawText(`Sucursal emisora: ${metadata.depositBranchName || metadata.branchName || "Matriz"}`, {
      x: 340,
      y: yR - 86,
      size: 8.5,
      font: fontRegular,
      color: darkGray,
    });

    yR -= paymentCardH + 25;

    // TABLA DE BALANCE FINANCIERO DEL EVENTO
    pageReceipt.drawText("ESTADO DE CUENTA Y SALDO PENDIENTE", {
      x: 40,
      y: yR,
      size: 9,
      font: fontBold,
      color: brandOrange,
    });

    yR -= 12;
    pageReceipt.drawRectangle({
      x: 40,
      y: yR - 18,
      width: width - 80,
      height: 18,
      color: rgb(0.9, 0.92, 0.95),
    });

    pageReceipt.drawText("Concepto Financiero", { x: 55, y: yR - 13, size: 8.5, font: fontBold, color: darkGray });
    pageReceipt.drawText("Importe", { x: 480, y: yR - 13, size: 8.5, font: fontBold, color: darkGray });

    yR -= 20;

    // Fila 1: Total Presupuestado
    pageReceipt.drawText("Inversión Total Contratada del Servicio", { x: 55, y: yR - 12, size: 9, font: fontRegular, color: darkGray });
    pageReceipt.drawText(`$${data.saleAmount.toLocaleString("es-MX")} MXN`, { x: 470, y: yR - 12, size: 9, font: fontBold, color: darkGray });
    yR -= 22;

    // Fila 2: Anticipo
    pageReceipt.drawText("(-) Anticipo Recibido para Congelamiento de Fecha", { x: 55, y: yR - 12, size: 9, font: fontBold, color: greenColor });
    pageReceipt.drawText(`-$${depositPaid.toLocaleString("es-MX")} MXN`, { x: 466, y: yR - 12, size: 9, font: fontBold, color: greenColor });
    yR -= 24;

    // Fila 3: Saldo Restante
    pageReceipt.drawRectangle({
      x: 40,
      y: yR - 26,
      width: width - 80,
      height: 26,
      color: rgb(0.98, 0.96, 0.92),
      borderColor: rgb(0.92, 0.78, 0.6),
      borderWidth: 1,
    });
    pageReceipt.drawText("SALDO PENDIENTE A LIQUIDAR EL DÍA DEL EVENTO:", { x: 55, y: yR - 17, size: 9, font: fontBold, color: brandOrange });
    pageReceipt.drawText(
      isConsumo ? "Consumo de producto en evento" : `$${balanceRemaining.toLocaleString("es-MX")} MXN`,
      { x: 450, y: yR - 17, size: 10, font: fontBold, color: brandOrange }
    );

    yR -= 50;

    // NOTAS Y POLÍTICAS DEL RECIBO
    pageReceipt.drawText("TÉRMINOS Y CONDICIONES DEL ANTICIPO", {
      x: 40,
      y: yR,
      size: 8,
      font: fontBold,
      color: darkGray,
    });

    yR -= 12;
    pageReceipt.drawText(
      "1. Este recibo constituye el comprobante formal de reserva y apartado exclusivo de fecha en la agenda oficial de Tequilitros.",
      { x: 40, y: yR, size: 7.2, font: fontRegular, color: mediumGray }
    );
    yR -= 11;
    pageReceipt.drawText(
      "2. El anticipo es estrictamente NO REEMBOLSABLE por bloqueo de fecha, asignación de equipo y rechazo de otros solicitantes para ese día.",
      { x: 40, y: yR, size: 7.2, font: fontRegular, color: mediumGray }
    );
    yR -= 11;
    pageReceipt.drawText(
      "3. El saldo pendiente deberá ser liquidado en su totalidad previo al inicio del servicio el día del evento pactado.",
      { x: 40, y: yR, size: 7.2, font: fontRegular, color: mediumGray }
    );
    yR -= 11;
    pageReceipt.drawText(
      "4. Solicitud de cambios de fecha sujeta a disponibilidad con mínimo 15 días naturales de anticipación.",
      { x: 40, y: yR, size: 7.2, font: fontRegular, color: mediumGray }
    );

    // Enlace de validación
    yR -= 25;
    const recOnlineUrl = `https://maestro-destiladora.space/tequilitros/cotizacion/${data.code}`;
    pageReceipt.drawText(`Verifica este recibo y los detalles de tu evento en línea: ${recOnlineUrl}`, {
      x: 40,
      y: yR,
      size: 7,
      font: fontRegular,
      color: brandOrange,
    });

    // Firmas
    yR -= 45;
    pageReceipt.drawLine({ start: { x: 70, y: yR }, end: { x: 230, y: yR }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
    pageReceipt.drawText("TEQUILITROS® EVENTOS", { x: 105, y: yR - 12, size: 7.5, font: fontBold, color: darkGray });
    pageReceipt.drawText("Recibió (Firma y Sello)", { x: 110, y: yR - 22, size: 6.5, font: fontRegular, color: mediumGray });

    pageReceipt.drawLine({ start: { x: 380, y: yR }, end: { x: 540, y: yR }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
    pageReceipt.drawText(data.clientName, { x: 410, y: yR - 12, size: 7.5, font: fontBold, color: darkGray });
    pageReceipt.drawText("Firma de Conformidad del Cliente", { x: 400, y: yR - 22, size: 6.5, font: fontRegular, color: mediumGray });

    const receiptPdfBytes = await doc.save();
    return new Blob([Uint8Array.from(receiptPdfBytes)], { type: "application/pdf" });
  }

  // ==========================================
  // DOCUMENTO TIPO: COTIZACIÓN O CONTRATO
  // ==========================================
  const page1 = doc.addPage([612, 792]); // Tamaño Carta US
  const { width } = page1.getSize();
  let y = 745;

  // Header
  page1.drawText("TEQUILITROS®", {
    x: 40,
    y,
    size: 22,
    font: fontBold,
    color: brandOrange,
  });

  page1.drawText("BARRAS MÓVILES & EVENTOS", {
    x: 200,
    y: y + 2,
    size: 9,
    font: fontBold,
    color: darkGray,
  });

  y -= 16;
  page1.drawText("Destiladora del Norte · Coctelería Premium de Tequila", {
    x: 40,
    y,
    size: 9,
    font: fontRegular,
    color: mediumGray,
  });

  page1.drawText(`WhatsApp Oficial: ${OFFICIAL_WHATSAPP_DISPLAY}`, {
    x: 40,
    y: y - 12,
    size: 9,
    font: fontRegular,
    color: mediumGray,
  });

  // Cuadro superior derecho: Folio y Estatus
  const docTitle = isContract ? "CONTRATO Y RECIBO OFICIAL" : "PRESUPUESTO FORMAL";
  page1.drawText(docTitle, {
    x: width - 230,
    y: 747,
    size: 10,
    font: fontBold,
    color: isContract ? rgb(0.5, 0.2, 0.7) : brandOrange,
  });

  const folioText = `FOLIO: ${isContract ? metadata.contractFolio || data.code : data.code}`;
  page1.drawText(folioText, {
    x: width - 230,
    y: 733,
    size: 11,
    font: fontBold,
    color: darkGray,
  });

  page1.drawText(`Fecha: ${formattedIssueDate}`, {
    x: width - 230,
    y: 719,
    size: 8.5,
    font: fontRegular,
    color: mediumGray,
  });

  page1.drawText(`Atendido por: ${metadata.creatorName} (${metadata.branchName || "Sucursal"})`, {
    x: width - 230,
    y: 706,
    size: 8.5,
    font: fontRegular,
    color: mediumGray,
  });

  // Línea divisoria
  y = 690;
  page1.drawLine({
    start: { x: 40, y },
    end: { x: width - 40, y },
    thickness: 1,
    color: rgb(0.85, 0.87, 0.9),
  });

  // Cuadro Ficha Técnica (Cliente y Evento)
  y -= 15;
  const cardHeight = 85;
  page1.drawRectangle({
    x: 40,
    y: y - cardHeight,
    width: width - 80,
    height: cardHeight,
    color: lightBg,
    borderColor: rgb(0.85, 0.87, 0.9),
    borderWidth: 1,
  });

  // Columna Izquierda: Cliente
  page1.drawText("DATOS DEL CLIENTE", {
    x: 55,
    y: y - 18,
    size: 8,
    font: fontBold,
    color: mediumGray,
  });
  page1.drawText(data.clientName, {
    x: 55,
    y: y - 34,
    size: 12,
    font: fontBold,
    color: darkGray,
  });
  page1.drawText(`Teléfono: ${data.clientPhone || "No especificado"}`, {
    x: 55,
    y: y - 50,
    size: 9,
    font: fontRegular,
    color: darkGray,
  });
  page1.drawText(`Correo: ${metadata.clientEmail || "No especificado"}`, {
    x: 55,
    y: y - 64,
    size: 9,
    font: fontRegular,
    color: darkGray,
  });

  // Columna Derecha: Evento
  const col2X = 320;
  page1.drawText("DETALLES DEL EVENTO", {
    x: col2X,
    y: y - 18,
    size: 8,
    font: fontBold,
    color: mediumGray,
  });
  page1.drawText(`Fecha: ${formattedEventDate}`, {
    x: col2X,
    y: y - 34,
    size: 9.5,
    font: fontBold,
    color: darkGray,
  });
  page1.drawText(`Lugar: ${data.location} (${metadata.viaticosZone})`, {
    x: col2X,
    y: y - 50,
    size: 9,
    font: fontRegular,
    color: darkGray,
  });
  page1.drawText(
    `Aforo: ${data.guestCount} personas · ${metadata.durationHours} hrs de atención (${isConsumo ? "Barra a Consumo" : "Barra Libre"})`,
    {
      x: col2X,
      y: y - 64,
      size: 9,
      font: fontRegular,
      color: darkGray,
    }
  );

  y -= cardHeight + 25;

  // TABLA DE CONCEPTOS ECONÓMICOS
  page1.drawText("DESGLOSE DEL SERVICIO", {
    x: 40,
    y,
    size: 9,
    font: fontBold,
    color: brandOrange,
  });

  y -= 12;
  page1.drawRectangle({
    x: 40,
    y: y - 16,
    width: width - 80,
    height: 18,
    color: rgb(0.9, 0.92, 0.95),
  });

  page1.drawText("Concepto", { x: 50, y: y - 12, size: 8.5, font: fontBold, color: darkGray });
  page1.drawText("Cantidad", { x: 340, y: y - 12, size: 8.5, font: fontBold, color: darkGray });
  page1.drawText("Unitario", { x: 420, y: y - 12, size: 8.5, font: fontBold, color: darkGray });
  page1.drawText("Subtotal", { x: 500, y: y - 12, size: 8.5, font: fontBold, color: darkGray });

  y -= 20;

  if (isConsumo) {
    // Fila 1: Atención de Barra
    page1.drawText(`Atención y Operación de Barra Móvil (${metadata.durationHours} hrs)`, {
      x: 50,
      y: y - 12,
      size: 8.5,
      font: fontBold,
      color: darkGray,
    });
    page1.drawText("Incluye bartenders profesionales, mobiliario y servicio continuo", {
      x: 50,
      y: y - 23,
      size: 7.5,
      font: fontRegular,
      color: mediumGray,
    });
    page1.drawText(`${metadata.durationHours} hrs`, { x: 340, y: y - 12, size: 8.5, font: fontRegular, color: darkGray });
    page1.drawText("$250 MXN", { x: 420, y: y - 12, size: 8.5, font: fontRegular, color: darkGray });
    page1.drawText(`$${(metadata.durationHours * 250).toLocaleString("es-MX")} MXN`, {
      x: 495,
      y: y - 12,
      size: 8.5,
      font: fontBold,
      color: darkGray,
    });

    y -= 32;

    // Fila 2: Viáticos
    page1.drawText(`Viáticos y Traslado (${metadata.viaticosZone})`, {
      x: 50,
      y: y - 12,
      size: 8.5,
      font: fontBold,
      color: darkGray,
    });
    page1.drawText("1 servicio", { x: 340, y: y - 12, size: 8.5, font: fontRegular, color: darkGray });
    page1.drawText(`$${metadata.viaticosCost} MXN`, { x: 420, y: y - 12, size: 8.5, font: fontRegular, color: darkGray });
    page1.drawText(`$${metadata.viaticosCost.toLocaleString("es-MX")} MXN`, {
      x: 495,
      y: y - 12,
      size: 8.5,
      font: fontBold,
      color: darkGray,
    });

    y -= 25;

    // Fila 3: Consumo de Producto
    page1.drawText("Consumo de Producto en Evento (Tequila, refrescos, insumos)", {
      x: 50,
      y: y - 12,
      size: 8.5,
      font: fontBold,
      color: darkGray,
    });
    page1.drawText("No se cobra por adelantado; se liquida al concluir según consumo real", {
      x: 50,
      y: y - 23,
      size: 7.5,
      font: fontRegular,
      color: mediumGray,
    });
    page1.drawText("A consumo", { x: 340, y: y - 12, size: 8, font: fontRegular, color: mediumGray });
    page1.drawText("Según carta", { x: 420, y: y - 12, size: 8, font: fontRegular, color: mediumGray });
    page1.drawText("En evento", { x: 500, y: y - 12, size: 8, font: fontBold, color: brandOrange });

    y -= 30;
  } else {
    // Barra Libre
    page1.drawText(`Servicio de Barra Libre Tequilitros (${metadata.durationHours} hrs)`, {
      x: 50,
      y: y - 12,
      size: 8.5,
      font: fontBold,
      color: darkGray,
    });
    page1.drawText("Bartenders, coctelería con tequila, refrescos, jugos, hielo y cristalería", {
      x: 50,
      y: y - 23,
      size: 7.5,
      font: fontRegular,
      color: mediumGray,
    });
    page1.drawText(`${data.guestCount} pers.`, { x: 340, y: y - 12, size: 8.5, font: fontRegular, color: darkGray });
    page1.drawText(`$${metadata.pricePerGuest} MXN`, { x: 420, y: y - 12, size: 8.5, font: fontRegular, color: darkGray });
    page1.drawText(`$${(data.guestCount * metadata.pricePerGuest).toLocaleString("es-MX")} MXN`, {
      x: 495,
      y: y - 12,
      size: 8.5,
      font: fontBold,
      color: darkGray,
    });

    y -= 32;

    if (metadata.extraHours > 0) {
      page1.drawText(`Horas Extra de Atención (${metadata.extraHours} hr${metadata.extraHours > 1 ? "s" : ""})`, {
        x: 50,
        y: y - 12,
        size: 8.5,
        font: fontBold,
        color: darkGray,
      });
      page1.drawText(`${metadata.extraHours} hrs`, { x: 340, y: y - 12, size: 8.5, font: fontRegular, color: darkGray });
      page1.drawText(`$${data.guestCount * 20} MXN`, { x: 420, y: y - 12, size: 8.5, font: fontRegular, color: darkGray });
      page1.drawText(`$${metadata.extraHoursCost.toLocaleString("es-MX")} MXN`, {
        x: 495,
        y: y - 12,
        size: 8.5,
        font: fontBold,
        color: darkGray,
      });
      y -= 25;
    }

    page1.drawText(`Viáticos y Traslado (${metadata.viaticosZone})`, {
      x: 50,
      y: y - 12,
      size: 8.5,
      font: fontBold,
      color: darkGray,
    });
    page1.drawText("1 servicio", { x: 340, y: y - 12, size: 8.5, font: fontRegular, color: darkGray });
    page1.drawText(`$${metadata.viaticosCost} MXN`, { x: 420, y: y - 12, size: 8.5, font: fontRegular, color: darkGray });
    page1.drawText(`$${metadata.viaticosCost.toLocaleString("es-MX")} MXN`, {
      x: 495,
      y: y - 12,
      size: 8.5,
      font: fontBold,
      color: darkGray,
    });

    y -= 30;
  }

  // Cuadro de Totales y Liquidación
  y -= 10;
  page1.drawRectangle({
    x: 310,
    y: y - 65,
    width: 262,
    height: 65,
    color: lightBg,
    borderColor: rgb(0.85, 0.87, 0.9),
    borderWidth: 1,
  });

  page1.drawText(isConsumo ? "Total Fijo (Horas + Viáticos):" : "Total del Servicio:", {
    x: 325,
    y: y - 18,
    size: 9,
    font: fontBold,
    color: darkGray,
  });
  page1.drawText(`$${data.saleAmount.toLocaleString("es-MX")} MXN`, {
    x: 470,
    y: y - 18,
    size: 11,
    font: fontBold,
    color: darkGray,
  });

  page1.drawText(isConsumo ? "Monto para Congelar Fecha:" : "Anticipo Requerido (50%):", {
    x: 325,
    y: y - 35,
    size: 8.5,
    font: fontBold,
    color: greenColor,
  });
  page1.drawText(`$${(metadata.depositPaid ?? depositRequired).toLocaleString("es-MX")} MXN`, {
    x: 470,
    y: y - 35,
    size: 10,
    font: fontBold,
    color: greenColor,
  });

  page1.drawText(isConsumo ? "Consumo de Producto:" : "Saldo el Día del Evento:", {
    x: 325,
    y: y - 52,
    size: 8.5,
    font: fontBold,
    color: brandOrange,
  });
  page1.drawText(isConsumo ? "A liquidar en evento" : `$${balanceRemaining.toLocaleString("es-MX")} MXN`, {
    x: 470,
    y: y - 52,
    size: 9,
    font: fontBold,
    color: brandOrange,
  });

  // Si es Barra a Consumo: Tabla Oficial de Precios
  if (isConsumo) {
    y -= 75;
    page1.drawText("TARIFARIO OFICIAL POR PRODUCTO (BARRA A CONSUMO - PÁG. 4 DEL MANUAL)", {
      x: 40,
      y,
      size: 8,
      font: fontBold,
      color: brandOrange,
    });

    y -= 10;
    CONSUMO_PRICES_CATALOG.forEach((item, index) => {
      const isCol2 = index >= 9;
      const rowInCol = isCol2 ? index - 9 : index;
      const itemX = isCol2 ? 310 : 40;
      const itemY = y - rowInCol * 13;

      page1.drawText(`• ${item.item}:`, {
        x: itemX,
        y: itemY,
        size: 7.5,
        font: fontRegular,
        color: darkGray,
      });

      page1.drawText(`$${item.price} MXN / ${item.unit}`, {
        x: itemX + 165,
        y: itemY,
        size: 7.5,
        font: fontBold,
        color: darkGray,
      });
    });

    y -= 9 * 13 + 12;
  } else {
    // Barra Libre: Coctelería seleccionada y detalles
    const drinksList =
      metadata.selectedDrinks && metadata.selectedDrinks.length > 0
        ? metadata.selectedDrinks.join("   ·   ")
        : "Cantarito   ·   Paloma   ·   Vampiro   ·   Tequimiche   ·   Tequimora";

    y -= 75;
    const drinksCardHeight = 44;
    page1.drawRectangle({
      x: 40,
      y: y - drinksCardHeight,
      width: width - 80,
      height: drinksCardHeight,
      color: lightBg,
      borderColor: rgb(0.85, 0.87, 0.9),
      borderWidth: 1,
    });

    page1.drawText("COCTELERÍA OFICIAL SELECCIONADA (VASO 32 OZ / 946 ML)", {
      x: 52,
      y: y - 13,
      size: 8,
      font: fontBold,
      color: brandOrange,
    });

    page1.drawText(drinksList, {
      x: 52,
      y: y - 26,
      size: 7.8,
      font: fontBold,
      color: darkGray,
    });

    page1.drawText(
      "Preparados con tequila artesanal de la casa, fruta fresca del día, refrescos, jugos y escarchados Tajín. Variantes sin alcohol disponibles.",
      {
        x: 52,
        y: y - 37,
        size: 6.8,
        font: fontRegular,
        color: mediumGray,
      }
    );

    y -= drinksCardHeight + 10;

    // Recibo de anticipo (si ya está confirmado) o notas especiales
    if (isContract && metadata.depositPaid) {
      const receiptHeight = 30;
      page1.drawRectangle({
        x: 40,
        y: y - receiptHeight,
        width: width - 80,
        height: receiptHeight,
        color: rgb(0.94, 0.98, 0.95),
        borderColor: rgb(0.7, 0.9, 0.8),
        borderWidth: 1,
      });

      page1.drawText("RECIBO DE ANTICIPO FORMALIZADO:", {
        x: 52,
        y: y - 11,
        size: 7.5,
        font: fontBold,
        color: greenColor,
      });

      const receiptDetails = `Anticipo recibido: $${metadata.depositPaid.toLocaleString("es-MX")} MXN  |  Método: ${metadata.depositMethod || "Efectivo"}  |  Recibido por: ${metadata.depositReceivedByName || metadata.creatorName}`;
      page1.drawText(receiptDetails, {
        x: 52,
        y: y - 22,
        size: 7,
        font: fontRegular,
        color: darkGray,
      });

      y -= receiptHeight + 8;
    } else if (metadata.specialNotes?.trim()) {
      const notesHeight = 28;
      page1.drawRectangle({
        x: 40,
        y: y - notesHeight,
        width: width - 80,
        height: notesHeight,
        color: rgb(0.98, 0.98, 0.95),
        borderColor: rgb(0.88, 0.85, 0.75),
        borderWidth: 1,
      });

      page1.drawText("NOTAS Y ACUERDOS ESPECIALES:", {
        x: 52,
        y: y - 10,
        size: 7.5,
        font: fontBold,
        color: darkGray,
      });

      const cleanNote =
        metadata.specialNotes.trim().length > 115
          ? metadata.specialNotes.trim().slice(0, 112) + "..."
          : metadata.specialNotes.trim();
      page1.drawText(cleanNote, {
        x: 52,
        y: y - 21,
        size: 7,
        font: fontRegular,
        color: darkGray,
      });

      y -= notesHeight + 8;
    }
  }

  // Enlace web de verificación oficial
  const onlineVerificationUrl = `https://maestro-destiladora.space/tequilitros/cotizacion/${data.code}`;
  page1.drawText(`Verifica o consulta este documento digital en: ${onlineVerificationUrl}`, {
    x: 40,
    y: y - 2,
    size: 7,
    font: fontRegular,
    color: brandOrange,
  });

  y -= 14;

  // Cláusulas resumidas al pie de página 1 o continuación
  page1.drawText("CONDICIONES DE CONTRATACIÓN Y RESERVA", {
    x: 40,
    y,
    size: 8,
    font: fontBold,
    color: darkGray,
  });

  y -= 12;
  page1.drawText(
    "1. Apartado con anticipo obligatorio no reembolsable · 2. Aforo total: Barra libre computa al 100% de asistentes (incluyendo niños y adultos)",
    { x: 40, y, size: 6.8, font: fontRegular, color: mediumGray }
  );
  y -= 10;
  page1.drawText(
    "3. Cambios de fecha con mínimo 15 días de anticipación y sujetos a disponibilidad y aprobación mutua de Tequilitros",
    { x: 40, y, size: 6.8, font: fontRegular, color: mediumGray }
  );
  y -= 10;
  page1.drawText(
    "4. Excedente de asistentes pagan tarifa unitaria + 10% de recargo · 5. Liquidación del saldo al inicio del servicio el día del evento",
    { x: 40, y, size: 6.8, font: fontRegular, color: mediumGray }
  );

  // Sección de firmas al pie
  y -= 35;
  page1.drawLine({
    start: { x: 70, y },
    end: { x: 230, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  page1.drawText("TEQUILITROS® EVENTOS", { x: 105, y: y - 12, size: 7.5, font: fontBold, color: darkGray });
  page1.drawText("Prestador del Servicio", { x: 112, y: y - 22, size: 6.5, font: fontRegular, color: mediumGray });

  page1.drawLine({
    start: { x: 380, y },
    end: { x: 540, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  page1.drawText(data.clientName, { x: 410, y: y - 12, size: 7.5, font: fontBold, color: darkGray });
  page1.drawText("Firma de Conformidad del Cliente", { x: 400, y: y - 22, size: 6.5, font: fontRegular, color: mediumGray });

  // PÁGINA 2 (Para contratos oficiales): Cláusulas legales completas detalladas
  if (isContract) {
    const page2 = doc.addPage([612, 792]);
    let y2 = 745;

    page2.drawText("TÉRMINOS, CONDICIONES Y POLÍTICAS CONTRACTUALES", {
      x: 40,
      y: y2,
      size: 12,
      font: fontBold,
      color: brandOrange,
    });
    page2.drawText(`Folio Oficial de Contrato: ${metadata.contractFolio || data.code}`, {
      x: 40,
      y: y2 - 14,
      size: 8.5,
      font: fontBold,
      color: darkGray,
    });

    y2 -= 35;

    OFFICIAL_CONTRACT_CLAUSES.forEach((clause) => {
      page2.drawText(clause.title, {
        x: 40,
        y: y2,
        size: 9.5,
        font: fontBold,
        color: darkGray,
      });
      y2 -= 13;

      // Dividir texto largo en líneas
      const words = clause.body.split(" ");
      let currentLine = "";
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length > 105) {
          page2.drawText(currentLine, { x: 40, y: y2, size: 8, font: fontRegular, color: mediumGray });
          y2 -= 11;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        page2.drawText(currentLine, { x: 40, y: y2, size: 8, font: fontRegular, color: mediumGray });
        y2 -= 18;
      }
    });

    // Firmas al pie de página 2
    y2 = 120;
    page2.drawLine({ start: { x: 70, y: y2 }, end: { x: 230, y: y2 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
    page2.drawText("TEQUILITROS® EVENTOS", { x: 105, y: y2 - 12, size: 8, font: fontBold, color: darkGray });
    page2.drawText("Prestador del Servicio", { x: 112, y: y2 - 22, size: 7, font: fontRegular, color: mediumGray });

    page2.drawLine({ start: { x: 380, y: y2 }, end: { x: 540, y: y2 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
    page2.drawText(data.clientName, { x: 410, y: y2 - 12, size: 8, font: fontBold, color: darkGray });
    page2.drawText("Firma de Conformidad del Cliente", { x: 400, y: y2 - 22, size: 7, font: fontRegular, color: mediumGray });
  }

  const pdfBytes = await doc.save();
  // pdf-lib expone una vista que puede estar respaldada por ArrayBufferLike.
  // Crear una copia DOM-compatible evita el conflicto de tipos de TS 5.9 y
  // mantiene el PDF idéntico para descarga, compartir y AirDrop.
  return new Blob([Uint8Array.from(pdfBytes)], { type: "application/pdf" });
}
