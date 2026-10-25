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
  documentType: "QUOTE" | "CONTRACT";
  metadata: TequilitrosQuoteMetadata;
}

export async function generateTequilitrosPdfBlob(data: QuotePdfData): Promise<Blob> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { metadata } = data;
  const isContract = data.documentType === "CONTRACT" || metadata.isContractConfirmed;
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
  const balanceRemaining = isConsumo ? 0 : data.saleAmount - (metadata.depositPaid ?? depositRequired);

  // PÁGINA 1: Carátula, Ficha del Evento, Desglose Económico y Totales
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
    y -= 85;
    page1.drawText("TARIFARIO OFICIAL POR PRODUCTO (BARRA A CONSUMO - PÁG. 4 DEL MANUAL)", {
      x: 40,
      y,
      size: 8,
      font: fontBold,
      color: brandOrange,
    });

    y -= 10;
    const itemColWidth = 260;
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

    y -= 9 * 13 + 15;
  } else {
    y -= 85;
  }

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
  return new Blob([pdfBytes], { type: "application/pdf" });
}
