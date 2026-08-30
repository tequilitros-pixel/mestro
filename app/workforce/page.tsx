import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { dateOnly } from "@/lib/workforce/availability/rules";
import { getEmployeeCalendar, type CalendarShift } from "@/lib/workforce/calendar/service";
import { getOwnEmployeeOrNull } from "@/lib/workforce/availability/service";

const dayMs = 86_400_000;
const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const statusLabel = { NEW: "Nuevo", CHANGED: "Cambió", CANCELLED: "Cancelado" };

function localTime(date: Date, timezone: string) { return new Intl.DateTimeFormat("es-MX", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(date); }
function localDate(date: Date, timezone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year:"numeric",month:"2-digit",day:"2-digit" }).format(date); }
function ShiftCard({ shift }: { shift: CalendarShift }) { return <Card className="space-y-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{shift.branchName}</strong><span className={`rounded-full px-2 py-1 text-xs font-bold ${shift.status === "CANCELLED" ? "bg-error/10 text-error" : shift.status === "CHANGED" ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"}`}>{statusLabel[shift.status]}</span></div><p className="text-lg font-bold">{localTime(shift.startAt, shift.branchTimezone)} → {localTime(shift.endAt, shift.branchTimezone)}{localDate(shift.endAt,shift.branchTimezone) !== localDate(shift.startAt,shift.branchTimezone) ? " · termina al día siguiente" : ""}</p><p className="text-xs text-on-surface-variant">Sucursal: {shift.branchName}</p></Card>; }

export default async function WorkforceCalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const actor={id:user.id,role:user.role};
  if (!await getOwnEmployeeOrNull(actor)) return <Card><h2 className="font-bold">Sin relación laboral vinculada</h2><p className="text-sm text-on-surface-variant">Tu identidad de acceso todavía no está asociada a un Employee activo. Solicita apoyo a administración.</p></Card>;
  const query = await searchParams;
  const view = query.view === "month" ? "month" : query.view === "week" ? "week" : "today";
  const anchor = dateOnly(query.date ?? new Date());
  const weekStart = new Date(anchor.getTime() - ((anchor.getUTCDay() + 6) % 7) * dayMs);
  const from = view === "today" ? anchor : view === "week" ? weekStart : new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const days = view === "today" ? 1 : view === "week" ? 7 : new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)).getUTCDate();
  const calendar = await getEmployeeCalendar(actor, from, days);
  const byDate = new Map<string, CalendarShift[]>();
  for (const shift of calendar.shifts) { const key=shift.businessDate.toISOString().slice(0,10); byDate.set(key,[...(byDate.get(key) ?? []),shift]); }
  if (view === "today") return <section className="space-y-4"><div><p className="text-sm text-on-surface-variant">Hoy · {calendar.employee.displayName}</p><h2 className="text-xl font-bold">{anchor.toLocaleDateString("es-MX", { timeZone: "UTC", dateStyle: "full" })}</h2></div>{calendar.shifts.length ? calendar.shifts.map((shift)=><ShiftCard key={shift.id} shift={shift}/>) : <Card><h2 className="font-bold">Sin turno hoy</h2><p className="text-sm text-on-surface-variant">Día libre o todavía no hay un turno publicado.</p></Card>}<button disabled className="w-full cursor-not-allowed rounded-xl bg-surface-container-high p-3 font-semibold text-on-surface-variant">Reloj laboral disponible en una fase posterior</button></section>;
  const end=new Date(from.getTime()+(days-1)*dayMs); const heading=view==="week"?`${from.toLocaleDateString("es-MX",{timeZone:"UTC",day:"numeric",month:"short"})} – ${end.toLocaleDateString("es-MX",{timeZone:"UTC",day:"numeric",month:"short",year:"numeric"})}`:from.toLocaleDateString("es-MX", { timeZone: "UTC", month: "long", year: "numeric" });
  return <section className="space-y-4"><div><p className="text-sm text-on-surface-variant">{view === "week" ? "Agenda semanal" : "Resumen mensual"}</p><h2 className="text-xl font-bold">{heading}</h2></div><div className="space-y-3">{Array.from({length:days},(_,index)=>{const date=new Date(from.getTime()+index*dayMs);const key=date.toISOString().slice(0,10);const shifts=byDate.get(key)??[];return <article key={key} className="grid gap-2 rounded-xl border border-outline-variant bg-surface-container/50 p-3 sm:grid-cols-[9rem_1fr]"><div><strong className="capitalize">{dayNames[date.getUTCDay()]} {date.getUTCDate()}</strong><p className="text-xs text-on-surface-variant">{shifts.length ? `${shifts.length} turno${shifts.length>1?"s":""}` : "Libre / sin turno"}</p></div><div className="space-y-2">{shifts.map((shift)=><ShiftCard key={shift.id} shift={shift}/>)}</div></article>})}</div></section>;
}
