import { PDFDocument, StandardFonts } from "pdf-lib";
import { getCurrentUser } from "@/lib/auth";
import { getEmployeePayrollDetail } from "@/app/actions/payroll";
import { renderPayrollStatementPage } from "@/lib/payroll/statementRenderer";
import { reconcilePayrollReceipt } from "@/lib/payroll/contractualSupplement";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const searchParams = new URL(request.url).searchParams;
  const targetUserId = searchParams.get("userId")?.trim() || user.id;
  const weekStart = searchParams.get("weekStart")?.trim();
  if (!weekStart) return new Response("Falta la semana requerida", { status: 400 });

  const result = await getEmployeePayrollDetail(targetUserId, weekStart);
  if ("error" in result) return new Response(result.error, { status: result.error === "No tienes permiso" ? 401 : 404 });
  const detail = result.data;

  if (detail.approval.status !== "APROBADA" && detail.approval.status !== "PAGADA") {
    return new Response("El expediente todavía no está aprobado para generar recibo formal.", { status: 409 });
  }

  const supplement = detail.supplement ?? { total: 0 };
  const reconciliation = reconcilePayrollReceipt(detail.basePay, detail.overtimePay, supplement.total, detail.adjustments, detail.finalPay);
  if (!reconciliation.matchesApproved) {
    return new Response("El desglose no coincide con el pago aprobado; revisa el expediente.", { status: 409 });
  }
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  await renderPayrollStatementPage(pdf, detail, { regular, bold }, 1, 1);

  const bytes = await pdf.save();
  const safeName = detail.employee.name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `recibo-nomina-${safeName}-${detail.weekStart}.pdf`;
  const download = searchParams.get("download") === "1";

  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
