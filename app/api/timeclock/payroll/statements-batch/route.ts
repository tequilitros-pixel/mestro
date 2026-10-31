import { PDFDocument, StandardFonts } from "pdf-lib";
import { getCurrentUser } from "@/lib/auth";
import { getPayrollWeekTable, getEmployeePayrollDetail } from "@/app/actions/payroll";
import { renderPayrollStatementPage } from "@/lib/payroll/statementRenderer";
import { getUserModuleKeys } from "@/app/actions/permissions";
import { canAccessModule } from "@/lib/permission-modules";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const moduleKeys = user.role !== "ADMIN" ? await getUserModuleKeys(user.id) : [];
  const isAdmin = canAccessModule(user.role, moduleKeys, "/timeclock/payroll");
  if (!isAdmin) {
    return new Response("No tienes permisos de administración de nómina", { status: 403 });
  }

  const searchParams = new URL(request.url).searchParams;
  const weekStart = searchParams.get("weekStart")?.trim();
  if (!weekStart) return new Response("Falta el parámetro weekStart", { status: 400 });

  const tableResult = await getPayrollWeekTable(weekStart);
  if ("error" in tableResult) {
    return new Response(tableResult.error, { status: 404 });
  }

  const table = tableResult.data;
  // Filtrar solo colaboradores que hayan laborado o tengan percepción en la semana
  const eligibleEmployees = table.employees.filter(
    (e) => (e.totalHours > 0 || e.finalPay > 0) && (e.approval.status === "APROBADA" || e.approval.status === "PAGADA" || table.period.status === "APROBADA" || table.period.status === "PAGADA")
  );

  if (eligibleEmployees.length === 0) {
    return new Response(
      "No hay recibos aprobados disponibles para generar en este periodo semanal. Asegúrate de aprobar la nómina primero.",
      { status: 404 }
    );
  }

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const totalEmployees = eligibleEmployees.length;

  for (let i = 0; i < totalEmployees; i++) {
    const employee = eligibleEmployees[i];
    const detailResult = await getEmployeePayrollDetail(employee.id, weekStart);
    if ("success" in detailResult) {
      await renderPayrollStatementPage(
        pdf,
        detailResult.data,
        { regular, bold },
        i + 1,
        totalEmployees
      );
    }
  }

  const bytes = await pdf.save();
  const filename = `recibos-nomina-semana-${weekStart}.pdf`;
  const download = searchParams.get("download") !== "0";

  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
