import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// ⚠️ Cambia "onboarding@resend.dev" por tu propio remitente
// (ej. "MAESTRO <no-responder@maestro-destiladora.space>")
// una vez que verifiques tu dominio en Resend.
const FROM_ADDRESS = "MAESTRO <onboarding@resend.dev>";

export async function sendPasswordResetEmail(
  to: string,
  code: string
) {
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Código para restablecer tu contraseña — MAESTRO",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <p style="text-transform: uppercase; letter-spacing: 3px; font-size: 12px; color: #d97706; font-weight: 700;">
          MAESTRO — Destiladora del Norte
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
