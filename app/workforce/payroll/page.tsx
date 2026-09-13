import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getEmployeePayrollStatements } from "@/lib/workforce/payroll/service";
import { formatMinutes } from "@/lib/workforce/timesheet/rules";

const money = (value: { toString(): string }, currency: string) => new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(Number(value.toString()));
export default async function EmployeePayrollPage() {
  const user = await getCurrentUser(); if (!user) redirect("/login");
  const statements = await getEmployeePayrollStatements(user.id);
  return <section className="mx-auto max-w-3xl space-y-5"><div><h1 className="text-2xl font-black">Estado de pago operativo</h1><p className="text-sm text-on-surface-variant">No es CFDI ni recibo fiscal.</p></div>{statements.length ? statements.map((line)=><Card key={line.id} className="space-y-3"><div className="flex flex-wrap justify-between gap-2"><strong>{line.payrollPeriod.weekStart.toISOString().slice(0,10)} → {line.payrollPeriod.weekEnd.toISOString().slice(0,10)}</strong><span>{line.status}</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><p>Ordinary<br/><strong>{formatMinutes(line.regularMinutes)}<br/>{money(line.ordinaryPay,line.currencySnapshot)}</strong></p><p>Double<br/><strong>{formatMinutes(line.overtimeTier1Minutes)}<br/>{money(line.doublePay,line.currencySnapshot)}</strong></p><p>Triple<br/><strong>{formatMinutes(line.overtimeTier2Minutes)}<br/>{money(line.triplePay,line.currencySnapshot)}</strong></p><p>Operational payable<br/><strong>{money(line.operationalPayable,line.currencySnapshot)}</strong></p></div><details><summary className="cursor-pointer font-bold">Explicación</summary><div className="mt-2 space-y-1 text-sm">{line.rateSegments.map((segment)=><p key={segment.id}>{segment.businessDate.toISOString().slice(0,10)} · {money(segment.hourlyRate,segment.currency)}/h · ordinary {formatMinutes(segment.ordinaryMinutes)}, double {formatMinutes(segment.doubleMinutes)}, triple {formatMinutes(segment.tripleMinutes)}</p>)}{line.adjustments.map((item)=><p key={item.id}>{item.direction === "EARNING" ? "+" : "−"}{money(item.amount,line.currencySnapshot)} · {item.categoryName} · {item.reason}</p>)}</div></details></Card>) : <Card>No hay estados APPROVED/PAID disponibles.</Card>}</section>;
}
