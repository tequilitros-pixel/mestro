import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Remitente por defecto. Puedes personalizarlo con la variable de entorno EMAIL_FROM en .env
// (ej. EMAIL_FROM="Destiladora del Norte <tickets@destiladoradelnorte.com>")
const FROM_ADDRESS = process.env.EMAIL_FROM || "Destiladora del Norte <onboarding@resend.dev>";
const REPLY_TO_ADDRESS = process.env.EMAIL_REPLY_TO || "tequilitros@gmail.com";

export async function sendPasswordResetEmail(
  to: string,
  code: string
) {
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Código para restablecer tu contraseña — Destiladora del Norte",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <p style="text-transform: uppercase; letter-spacing: 3px; font-size: 12px; color: #d97706; font-weight: 700;">
          Destiladora del Norte
        </p>
        <h2 style="color: #0f172a;">Restablece tu contraseña</h2>
        <p style="color: #334155; font-size: 15px;">
          Usa este código para continuar. Expira en 15 minutos.
        </p>
        <div style="background: #0f172a; color: #fbbf24; font-size: 32px; font-weight: 800; letter-spacing: 8px; text-align: center; padding: 20px; border-radius: 12px; margin: 24px 0;">
          ${code}
        </div>
        <p style="color: #94a3b8; font-size: 13px;">
          Si tú no solicitaste este código, puedes ignorar este correo.
        </p>
      </div>
    `,
  });
}

export async function sendPayrollReviewEmail(params: {
  to: string[];
  weekRange: string;
  employeeCount: number;
  estimatedTotal: number;
  submittedByName: string;
  payrollUrl: string;
}) {
  if (params.to.length === 0) return;
  const totalFormatted = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(params.estimatedTotal);
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `Nómina en revisión — ${params.weekRange}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
        <p style="text-transform: uppercase; letter-spacing: 3px; font-size: 12px; color: #d97706; font-weight: 700;">Destiladora del Norte</p>
        <h2 style="color: #0f172a;">Nómina lista para revisión</h2>
        <p style="color: #334155; font-size: 15px;">Enviada por <strong>${params.submittedByName}</strong> para la semana <strong>${params.weekRange}</strong>.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
          <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Empleados</td><td style="padding: 8px 0; font-weight: 700; text-align: right;">${params.employeeCount}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b; font-size: 14px;">Total estimado</td><td style="padding: 8px 0; font-weight: 700; text-align: right; color: #0f172a;">${totalFormatted}</td></tr>
        </table>
        <a href="${params.payrollUrl}" style="display: inline-block; background: #0f172a; color: #fbbf24; font-weight: 700; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-size: 15px;">Revisar nómina →</a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">Ingresa como administrador para aprobar o hacer correcciones.</p>
      </div>
    `,
  });
}

export async function sendSaleReceiptEmail(params: {
  to: string;
  saleCode: string;
  branchName: string;
  branchAddress?: string | null;
  date: string;
  cashierName?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discountAmount: number;
  total: number;
  payments: Array<{
    method: string;
    amount: number;
  }>;
  change?: number | null;
}) {
  const currency = (val: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);

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

  const itemsHtml = params.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #0f172a;">
          <div style="font-weight: 600;">${item.name}</div>
          <div style="font-size: 12px; color: #64748b;">${item.quantity} × ${currency(item.unitPrice)}</div>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 600; text-align: right; color: #0f172a; white-space: nowrap;">
          ${currency(item.lineTotal)}
        </td>
      </tr>
    `
    )
    .join("");

  const paymentsHtml = params.payments
    .map(
      (p) => `
      <div style="display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-top: 4px;">
        <span>${paymentLabels[p.method] ?? p.method}</span>
        <span style="font-weight: 600;">${currency(p.amount)}</span>
      </div>
    `
    )
    .join("");

  return await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    replyTo: REPLY_TO_ADDRESS,
    subject: `Tu ticket de compra — ${params.saleCode} (Destiladora del Norte)`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
        <!-- Header -->
        <div style="background: #0f172a; padding: 24px 20px; text-align: center;">
          <p style="text-transform: uppercase; letter-spacing: 3px; font-size: 11px; color: #fbbf24; font-weight: 700; margin: 0 0 8px 0;">
            Destiladora del Norte
          </p>
          <h1 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0;">
            Recibo de Compra
          </h1>
          <p style="color: #94a3b8; font-size: 13px; margin: 6px 0 0 0;">
            ${params.branchName}${params.branchAddress ? ` · ${params.branchAddress}` : ""}
          </p>
        </div>

        <div style="padding: 24px 20px;">
          <!-- Meta info -->
          <div style="background: #f8fafc; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #475569;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #64748b;">Folio:</span>
              <strong style="color: #0f172a; font-family: monospace;">${params.saleCode}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #64748b;">Fecha:</span>
              <span style="color: #0f172a;">${params.date}</span>
            </div>
            ${params.cashierName ? `
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Atendido por:</span>
              <span style="color: #0f172a;">${params.cashierName}</span>
            </div>` : ""}
          </div>

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <thead>
              <tr style="border-bottom: 2px solid #e2e8f0;">
                <th style="padding-bottom: 8px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Concepto</th>
                <th style="padding-bottom: 8px; text-align: right; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Importe</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Totals -->
          <div style="border-top: 1px dashed #cbd5e1; padding-top: 12px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: #64748b; margin-bottom: 4px;">
              <span>Subtotal</span>
              <span>${currency(params.subtotal)}</span>
            </div>
            ${params.discountAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: #16a34a; margin-bottom: 4px;">
              <span>Descuento</span>
              <span>−${currency(params.discountAmount)}</span>
            </div>` : ""}
            <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
              <span>TOTAL</span>
              <span style="color: #0f172a;">${currency(params.total)}</span>
            </div>
          </div>

          <!-- Payments breakdown -->
          <div style="background: #f8fafc; border-radius: 10px; padding: 12px 16px; margin-bottom: 24px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px;">
              Forma de pago
            </div>
            ${paymentsHtml}
            ${typeof params.change === "number" && params.change > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: #16a34a; margin-top: 4px; font-weight: 600;">
              <span>Cambio entregado</span>
              <span>${currency(params.change)}</span>
            </div>` : ""}
          </div>

          <!-- Footer note -->
          <div style="text-align: center; border-top: 1px solid #f1f5f9; padding-top: 18px;">
            <p style="font-size: 14px; font-weight: 600; color: #0f172a; margin: 0 0 4px 0;">
              ¡Gracias por tu compra!
            </p>
            <p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">
              ¿Dudas o aclaraciones? Contáctanos en <a href="mailto:${REPLY_TO_ADDRESS}" style="color: #d97706; text-decoration: none; font-weight: 600;">${REPLY_TO_ADDRESS}</a>
            </p>
            <p style="font-size: 10px; color: #94a3b8; margin: 8px 0 0 0;">
              Comprobante de operación simplificado emitido por Maestro POSpress.
            </p>
          </div>
        </div>
      </div>
    `,
  });
}
