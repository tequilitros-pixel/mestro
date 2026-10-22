import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ⚠️ Cambia "onboarding@resend.dev" por tu propio remitente
// (ej. "Destiladora del Norte <no-responder@maestro-destiladora.space>")
// una vez que verifiques tu dominio en Resend.
const FROM_ADDRESS = "Destiladora del Norte <onboarding@resend.dev>";

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
  weekRange: string;        // e.g. "21 oct – 27 oct 2026"
  employeeCount: number;
  estimatedTotal: number;   // MXN number
  submittedByName: string;
  payrollUrl: string;       // full URL to the payroll page
}) {
  if (params.to.length === 0) return;
  const totalFormatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(params.estimatedTotal);
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
