/**
 * Driver universal para impresoras térmicas de tickets (58mm y 80mm).
 * Soporta:
 * 1. Bluetooth Low Energy (BLE) / SPP vía Web Bluetooth API
 * 2. Cable USB Tipo-C / USB-Serial vía Web Serial API
 * 3. Fallback universal vía diálogo del Sistema / Navegador (window.print)
 *
 * Diseñado para impresoras económicas de $400 a $900 MXN (Xprinter, GOOJPRT, Panda, MPT-II, etc.)
 */

import type { ReceiptData } from "@/components/pos/ReceiptTicket";

export type PrinterConnectionType = "bluetooth" | "usb" | "system";
export type PaperWidth = "58mm" | "80mm";

export interface PrinterSettings {
  type: PrinterConnectionType;
  paperWidth: PaperWidth;
  autoCut: boolean;
  feedLines: number;
  lastDeviceName?: string;
}

type BluetoothWritableCharacteristic = {
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValueWithResponse?: (data: Uint8Array) => Promise<void>;
  writeValueWithoutResponse?: (data: Uint8Array) => Promise<void>;
  writeValue: (data: Uint8Array) => Promise<void>;
};

type BluetoothService = {
  getCharacteristics: () => Promise<BluetoothWritableCharacteristic[]>;
};

type BluetoothServer = {
  getPrimaryService: (service: string) => Promise<BluetoothService>;
  getPrimaryServices: () => Promise<BluetoothService[]>;
};

type BluetoothDevice = {
  name?: string;
  gatt?: { connected: boolean; connect: () => Promise<BluetoothServer>; disconnect: () => void };
};

type BluetoothNavigator = Navigator & {
  bluetooth?: { requestDevice: (options: { acceptAllDevices: boolean; optionalServices: string[] }) => Promise<BluetoothDevice> };
};

type SerialPort = {
  open: (options: { baudRate: number; dataBits: number; stopBits: number; parity: string; flowControl: string }) => Promise<void>;
  close: () => Promise<void>;
  writable: { getWriter: () => { write: (data: Uint8Array) => Promise<void>; releaseLock: () => void } };
};

type SerialNavigator = Navigator & { serial?: { requestPort: () => Promise<SerialPort> } };

function browserErrorDetails(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: "", message: "" };
}

const SETTINGS_KEY = "maestro:pos-printer-settings";

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  type: "bluetooth",
  paperWidth: "58mm",
  autoCut: false,
  feedLines: 3,
  lastDeviceName: undefined,
};

export function getStoredPrinterSettings(): PrinterSettings {
  if (typeof window === "undefined") return DEFAULT_PRINTER_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const defaultType: PrinterConnectionType = isWebBluetoothSupported()
        ? "bluetooth"
        : isWebSerialSupported()
        ? "usb"
        : "system";
      return { ...DEFAULT_PRINTER_SETTINGS, type: defaultType };
    }
    const parsed = JSON.parse(raw);
    return {
      type: parsed.type || "bluetooth",
      paperWidth: parsed.paperWidth === "80mm" ? "80mm" : "58mm",
      autoCut: Boolean(parsed.autoCut),
      feedLines: typeof parsed.feedLines === "number" ? parsed.feedLines : 3,
      lastDeviceName: parsed.lastDeviceName,
    };
  } catch {
    return DEFAULT_PRINTER_SETTINGS;
  }
}

export function saveStoredPrinterSettings(settings: Partial<PrinterSettings>): PrinterSettings {
  if (typeof window === "undefined") return DEFAULT_PRINTER_SETTINGS;
  const current = getStoredPrinterSettings();
  const updated = { ...current, ...settings };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Error al guardar configuración de impresora en localStorage", e);
  }
  return updated;
}

export function isWebBluetoothSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return typeof (navigator as BluetoothNavigator).bluetooth?.requestDevice === "function";
}

export function isWebSerialSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return typeof (navigator as SerialNavigator).serial?.requestPort === "function";
}

// ==========================================
// ESC/POS Command Encoder
// ==========================================

export class EscPosEncoder {
  private buffer: number[] = [];
  private widthChars: number;

  constructor(paperWidth: PaperWidth = "58mm") {
    // 58mm = 32 caracteres por línea
    // 80mm = 48 caracteres por línea
    this.widthChars = paperWidth === "80mm" ? 48 : 32;
  }

  init(): this {
    // ESC @ (Initialize printer)
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  alignLeft(): this {
    // ESC a 0
    this.buffer.push(0x1b, 0x61, 0x00);
    return this;
  }

  alignCenter(): this {
    // ESC a 1
    this.buffer.push(0x1b, 0x61, 0x01);
    return this;
  }

  alignRight(): this {
    // ESC a 2
    this.buffer.push(0x1b, 0x61, 0x02);
    return this;
  }

  bold(enable = true): this {
    // ESC E n
    this.buffer.push(0x1b, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  doubleSize(enable = true): this {
    // GS ! n (0x11 = double width & height, 0x00 = normal)
    this.buffer.push(0x1d, 0x21, enable ? 0x11 : 0x00);
    return this;
  }

  doubleHeight(enable = true): this {
    // GS ! n (0x01 = double height, 0x00 = normal)
    this.buffer.push(0x1d, 0x21, enable ? 0x01 : 0x00);
    return this;
  }

  /**
   * Sanitiza caracteres en español para compatibilidad universal con firmwares chinos económicos.
   */
  private sanitizeText(text: string): string {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // quita tildes si el firmware no tiene CP850
      .replace(/ñ/g, "n")
      .replace(/Ñ/g, "N")
      .replace(/[^\x20-\x7E\n]/g, ""); // mantiene solo ASCII imprimible y saltos de línea
  }

  text(str: string): this {
    const clean = this.sanitizeText(str);
    for (let i = 0; i < clean.length; i++) {
      this.buffer.push(clean.charCodeAt(i));
    }
    return this;
  }

  line(str = ""): this {
    this.text(str);
    this.buffer.push(0x0a); // LF
    return this;
  }

  dashedLine(): this {
    this.line("-".repeat(this.widthChars));
    return this;
  }

  doubleDashedLine(): this {
    this.line("=".repeat(this.widthChars));
    return this;
  }

  /**
   * Imprime dos columnas alineadas a los extremos:
   * Ej: "Subtotal                     $150.00"
   */
  twoColumns(left: string, right: string): this {
    const cleanLeft = this.sanitizeText(left);
    const cleanRight = this.sanitizeText(right);
    const spaceCount = this.widthChars - cleanLeft.length - cleanRight.length;

    if (spaceCount >= 1) {
      this.line(cleanLeft + " ".repeat(spaceCount) + cleanRight);
    } else {
      // Si el texto es muy largo, cortamos o lo colocamos en 2 líneas
      const maxLeft = this.widthChars - cleanRight.length - 1;
      if (maxLeft > 4) {
        this.line(cleanLeft.substring(0, maxLeft) + " " + cleanRight);
      } else {
        this.line(cleanLeft);
        this.line(" ".repeat(Math.max(0, this.widthChars - cleanRight.length)) + cleanRight);
      }
    }
    return this;
  }

  /**
   * Formatea un artículo de la venta con cantidad, nombre y precio.
   */
  itemRow(qty: number, name: string, total: string, unitPrice?: string): this {
    const prefix = `${qty}x `;
    const cleanName = this.sanitizeText(name);
    const cleanTotal = this.sanitizeText(total);
    const availableForName = this.widthChars - prefix.length - cleanTotal.length - 1;

    if (cleanName.length <= availableForName) {
      const spaces = this.widthChars - prefix.length - cleanName.length - cleanTotal.length;
      this.line(prefix + cleanName + " ".repeat(Math.max(1, spaces)) + cleanTotal);
    } else {
      // Línea 1: Prefijo + nombre
      this.line(prefix + cleanName);
      // Línea 2: precio a la derecha
      const spaces = this.widthChars - cleanTotal.length;
      this.line(" ".repeat(Math.max(0, spaces)) + cleanTotal);
    }

    if (unitPrice && qty > 1) {
      const note = `  (${this.sanitizeText(unitPrice)} c/u)`;
      this.line(note);
    }

    return this;
  }

  feed(lines = 3): this {
    // ESC d n (feed n lines)
    this.buffer.push(0x1b, 0x64, Math.min(Math.max(1, lines), 10));
    return this;
  }

  cut(partial = true): this {
    // GS V m (0 = full cut, 1 = partial cut, 66 = partial cut with feed)
    this.buffer.push(0x1d, 0x56, partial ? 0x42 : 0x00, 0x00);
    return this;
  }

  beep(): this {
    // ESC B 1 2 (beep 1 time)
    this.buffer.push(0x1b, 0x42, 0x01, 0x02);
    return this;
  }

  encode(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

// ==========================================
// Receipt to ESC/POS Converter
// ==========================================

const formatMoney = (val: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);

export function buildReceiptEscPos(
  receipt: ReceiptData,
  settings: PrinterSettings
): Uint8Array {
  const encoder = new EscPosEncoder(settings.paperWidth);

  encoder.init();

  // Header centrado
  encoder.alignCenter();
  encoder.doubleHeight(true);
  encoder.bold(true);
  encoder.line("DESTILADORA DEL NORTE");
  encoder.doubleHeight(false);
  encoder.bold(false);

  if (receipt.branchName) {
    encoder.bold(true);
    encoder.line(receipt.branchName);
    encoder.bold(false);
  }

  if (receipt.branchAddress) {
    encoder.line(receipt.branchAddress);
  }

  encoder.dashedLine();

  // Metadatos
  encoder.alignLeft();
  encoder.twoColumns("FOLIO:", receipt.saleCode);
  encoder.twoColumns("FECHA:", receipt.date);
  if (receipt.cashierName) {
    encoder.twoColumns("ATENDIO:", receipt.cashierName);
  }

  if (receipt.isOffline) {
    encoder.alignCenter();
    encoder.bold(true);
    encoder.line("* VENTA SIN CONEXION *");
    encoder.bold(false);
    encoder.alignLeft();
  }

  encoder.dashedLine();

  // Encabezado de items
  encoder.twoColumns("CANT CONCEPTO", "IMPORTE");
  encoder.dashedLine();

  // Artículos
  for (const item of receipt.items) {
    encoder.itemRow(
      item.quantity,
      item.name,
      formatMoney(item.lineTotal),
      item.quantity > 1 ? formatMoney(item.unitPrice) : undefined
    );
  }

  encoder.dashedLine();

  // Totales
  encoder.twoColumns("SUBTOTAL:", formatMoney(receipt.subtotal));

  if (receipt.discountAmount > 0) {
    encoder.twoColumns("DESCUENTO:", `-${formatMoney(receipt.discountAmount)}`);
  }

  encoder.doubleDashedLine();
  encoder.bold(true);
  encoder.doubleHeight(true);
  encoder.twoColumns("TOTAL:", formatMoney(receipt.total));
  encoder.doubleHeight(false);
  encoder.bold(false);
  encoder.doubleDashedLine();

  // Formas de pago
  const paymentLabels: Record<string, string> = {
    EFECTIVO: "Efectivo",
    TARJETA: "Tarjeta",
    TRANSFERENCIA: "Transferencia",
    DIDI: "DiDi",
    UBER: "Uber",
    RAPPI: "Rappi",
    VALES: "Vales",
    OTRO: "Otro",
  };

  encoder.line("FORMA DE PAGO:");
  for (const p of receipt.payments) {
    encoder.twoColumns(`  ${paymentLabels[p.method] ?? p.method}:`, formatMoney(p.amount));
  }

  if (typeof receipt.cashReceived === "number" && receipt.cashReceived > 0) {
    encoder.twoColumns("  Efectivo Recibido:", formatMoney(receipt.cashReceived));
  }

  if (typeof receipt.change === "number" && receipt.change > 0) {
    encoder.bold(true);
    encoder.twoColumns("  CAMBIO:", formatMoney(receipt.change));
    encoder.bold(false);
  }

  encoder.dashedLine();

  // Pie de página
  encoder.alignCenter();
  encoder.bold(true);
  encoder.line("GRACIAS POR SU COMPRA");
  encoder.bold(false);
  encoder.line("Comprobante simplificado de venta");
  encoder.line("www.destiladoradelnorte.com");

  // Avance de papel y corte
  encoder.feed(settings.feedLines || 3);
  if (settings.autoCut) {
    encoder.cut(true);
  }

  return encoder.encode();
}

export function buildTestTicketEscPos(settings: PrinterSettings): Uint8Array {
  const encoder = new EscPosEncoder(settings.paperWidth);
  encoder.init();
  encoder.alignCenter();
  encoder.doubleHeight(true);
  encoder.bold(true);
  encoder.line("MAESTRO POS");
  encoder.doubleHeight(false);
  encoder.bold(false);
  encoder.line("TEST DE IMPRESION");
  encoder.dashedLine();
  encoder.alignLeft();
  encoder.twoColumns("CONEXION:", settings.type.toUpperCase());
  encoder.twoColumns("PAPEL:", settings.paperWidth);
  encoder.twoColumns("FECHA:", new Date().toLocaleTimeString("es-MX"));
  encoder.dashedLine();
  encoder.alignCenter();
  encoder.line("Impresora lista y funcionando!");
  encoder.line("Soporte para tickets economicos");
  encoder.dashedLine();
  encoder.feed(settings.feedLines || 3);
  if (settings.autoCut) {
    encoder.cut(true);
  }
  return encoder.encode();
}

// ==========================================
// Web Bluetooth Connection
// ==========================================

// Servicios Bluetooth comunes en mini impresoras térmicas
const BLE_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Servicio estándar de impresión térmico
  "0000ffe0-0000-1000-8000-00805f9b34fb", // Muy común en impresoras chinas BLE (Zjiang, GOOJPRT, MPT)
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC Transparent Serial
  "0000fff0-0000-1000-8000-00805f9b34fb", // Vendor alternate
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

export async function printViaBluetooth(
  data: Uint8Array,
  onStatusUpdate?: (status: string) => void
): Promise<{ success: boolean; deviceName?: string; error?: string }> {
  if (!isWebBluetoothSupported()) {
    return {
      success: false,
      error: "Web Bluetooth no es compatible con este navegador. Por favor utiliza Chrome, Edge o prueba por Cable USB / Impresión del Sistema.",
    };
  }

  try {
    onStatusUpdate?.("Buscando impresora Bluetooth…");

    const bluetooth = (navigator as BluetoothNavigator).bluetooth;
    if (!bluetooth) {
      return { success: false, error: "Web Bluetooth no está disponible en este navegador." };
    }
    const device = await bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_PRINTER_SERVICES,
    });

    if (!device) {
      return { success: false, error: "No se seleccionó ninguna impresora Bluetooth." };
    }

    const deviceName = device.name || "Impresora Bluetooth";
    onStatusUpdate?.(`Conectando a ${deviceName}…`);

    const server = await device.gatt?.connect();
    if (!server) {
      throw new Error("No se pudo conectar al servidor GATT de la impresora.");
    }

    onStatusUpdate?.("Buscando canal de impresión…");

    // Buscamos cualquier servicio disponible que tenga una característica con permiso de escritura
    let writeChar: BluetoothWritableCharacteristic | null = null;

    // Intentamos primero con los servicios conocidos
    for (const serviceUuid of BLE_PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeChar = char;
            break;
          }
        }
        if (writeChar) break;
      } catch {
        // Continuamos buscando en otros servicios
      }
    }

    // Si aún no la encontramos, buscamos en todos los servicios primarios
    if (!writeChar) {
      try {
        const services = await server.getPrimaryServices();
        for (const service of services) {
          try {
            const chars = await service.getCharacteristics();
            for (const char of chars) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                writeChar = char;
                break;
              }
            }
            if (writeChar) break;
          } catch {
            // Siguiente servicio
          }
        }
      } catch {
        // No se pudieron listar servicios
      }
    }

    if (!writeChar) {
      device.gatt?.disconnect();
      throw new Error("No se encontró el canal de escritura en la impresora Bluetooth seleccionada.");
    }

    onStatusUpdate?.("Enviando ticket a la impresora…");

    // Las mini impresoras BLE tienen un MTU limitado (generalmente de 20 a 100 bytes).
    // Enviamos en bloques de 64 bytes para evitar saturar el buffer de la impresora.
    const chunkSize = 64;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      if (writeChar.writeValueWithResponse) {
        await writeChar.writeValueWithResponse(chunk);
      } else if (writeChar.writeValueWithoutResponse) {
        await writeChar.writeValueWithoutResponse(chunk);
      } else {
        await writeChar.writeValue(chunk);
      }
      // Micro-pausa de 20ms entre bloques para impresoras con microcontroladores lentos
      await new Promise((r) => setTimeout(r, 20));
    }

    onStatusUpdate?.("Ticket impreso con éxito.");

    // Desconectar suavemente después de terminar
    setTimeout(() => {
      try {
        if (device.gatt?.connected) {
          device.gatt.disconnect();
        }
      } catch {
        // Ignorar error al desconectar
      }
    }, 500);

    return { success: true, deviceName };
  } catch (error) {
    const { name, message } = browserErrorDetails(error);
    if (name === "NotFoundError" || message.includes("User cancelled")) {
      return { success: false, error: "Selección de impresora cancelada." };
    }
    return {
      success: false,
      error: message || "Error al comunicarse con la impresora Bluetooth.",
    };
  }
}

// ==========================================
// Web Serial / USB Type-C Connection
// ==========================================

export async function printViaUsb(
  data: Uint8Array,
  onStatusUpdate?: (status: string) => void
): Promise<{ success: boolean; deviceName?: string; error?: string }> {
  if (!isWebSerialSupported()) {
    return {
      success: false,
      error: "Web Serial no está disponible en este navegador. Utiliza Chrome o Edge en PC, Mac, Linux o Android, o utiliza Bluetooth / Diálogo del Sistema.",
    };
  }

  try {
    onStatusUpdate?.("Solicitando acceso a impresora USB…");
    const serial = (navigator as SerialNavigator).serial;
    if (!serial) {
      return { success: false, error: "Web Serial no está disponible en este navegador." };
    }
    const port = await serial.requestPort();

    if (!port) {
      return { success: false, error: "No se seleccionó ningún puerto USB." };
    }

    onStatusUpdate?.("Abriendo comunicación con impresora USB…");
    // La mayoría de impresoras térmicas USB/Serial operan a 9600 o 115200 baudios.
    // 9600 es el estándar más compatible universalmente.
    await port.open({
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      flowControl: "none",
    });

    onStatusUpdate?.("Enviando ticket por cable USB…");
    const writer = port.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();

    await port.close();

    onStatusUpdate?.("Ticket impreso con éxito vía USB.");
    return { success: true, deviceName: "Impresora USB (Cable)" };
  } catch (error) {
    const { name, message } = browserErrorDetails(error);
    if (name === "NotFoundError" || message.includes("No port selected")) {
      return { success: false, error: "Selección de impresora USB cancelada." };
    }
    return {
      success: false,
      error: message || "Error al comunicarse con la impresora USB.",
    };
  }
}

// ==========================================
// Universal Dispatcher
// ==========================================

export async function printReceiptUniversal(
  receipt: ReceiptData,
  settings: PrinterSettings,
  onStatusUpdate?: (status: string) => void
): Promise<{ success: boolean; deviceName?: string; error?: string }> {
  if (settings.type === "system") {
    if (typeof window !== "undefined") {
      window.print();
      return { success: true, deviceName: "Impresora del Sistema" };
    }
    return { success: false, error: "No se puede imprimir fuera del navegador." };
  }

  const binaryData = buildReceiptEscPos(receipt, settings);

  if (settings.type === "bluetooth") {
    return await printViaBluetooth(binaryData, onStatusUpdate);
  }

  if (settings.type === "usb") {
    return await printViaUsb(binaryData, onStatusUpdate);
  }

  return { success: false, error: "Tipo de conexión desconocido." };
}

export async function printTestTicketUniversal(
  settings: PrinterSettings,
  onStatusUpdate?: (status: string) => void
): Promise<{ success: boolean; deviceName?: string; error?: string }> {
  if (settings.type === "system") {
    if (typeof window !== "undefined") {
      window.print();
      return { success: true, deviceName: "Impresora del Sistema" };
    }
    return { success: false, error: "No se puede imprimir fuera del navegador." };
  }

  const binaryData = buildTestTicketEscPos(settings);

  if (settings.type === "bluetooth") {
    return await printViaBluetooth(binaryData, onStatusUpdate);
  }

  if (settings.type === "usb") {
    return await printViaUsb(binaryData, onStatusUpdate);
  }

  return { success: false, error: "Tipo de conexión desconocido." };
}
