import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRegisterAction, revokeTerminalAction, toggleRegisterAction } from "./actions";
import { TerminalEnrollmentForm } from "./TerminalEnrollmentForm";

export default async function Pos2CashAdministrationPage() {
  await requireAdmin();
  const [branches, registers, terminals, sessions] = await Promise.all([
    prisma.branch.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.register.findMany({ include: { branch: { select: { name: true } } }, orderBy: [{ branch: { name: "asc" } }, { code: "asc" }] }),
    prisma.terminal.findMany({ include: { branch: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.cashSession.findMany({ include: { register: { select: { name: true } }, branch: { select: { name: true } } }, orderBy: { openedAt: "desc" }, take: 20 }),
  ]);
  return <main className="mx-auto max-w-6xl space-y-8 p-6">
    <div><h1 className="text-2xl font-bold">Cajas y terminales POS 2.0</h1><p className="text-on-surface-variant">Configuración administrativa y sesiones recientes.</p></div>
    <section className="grid gap-4 md:grid-cols-2">
      <form action={createRegisterAction} className="space-y-3 rounded-xl border border-outline-variant p-4">
        <h2 className="font-semibold">Crear Register</h2>
        <select name="branchId" required className="w-full rounded-lg border p-2">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
        <input name="code" required placeholder="CAJA-01" className="w-full rounded-lg border p-2" />
        <input name="name" required placeholder="Caja 1" className="w-full rounded-lg border p-2" />
        <button className="rounded-lg bg-primary px-4 py-2 text-on-primary">Crear caja</button>
      </form>
      <TerminalEnrollmentForm branches={branches} />
    </section>
    <section><h2 className="mb-3 text-lg font-semibold">Registers</h2><div className="space-y-2">{registers.map((register) => <div key={register.id} className="flex items-center justify-between rounded-lg border p-3"><span>{register.branch.name} · {register.code} · {register.name}</span><form action={toggleRegisterAction}><input type="hidden" name="registerId" value={register.id}/><input type="hidden" name="active" value={String(!register.active)}/><button className="text-sm underline">{register.active ? "Desactivar" : "Activar"}</button></form></div>)}</div></section>
    <section><h2 className="mb-3 text-lg font-semibold">Terminales</h2><div className="space-y-2">{terminals.map((terminal) => <div key={terminal.id} className="flex items-center justify-between rounded-lg border p-3"><span>{terminal.branch.name} · {terminal.name} · {terminal.status}</span>{terminal.status !== "REVOKED" && <form action={revokeTerminalAction}><input type="hidden" name="terminalId" value={terminal.id}/><button className="text-sm text-error underline">Revocar</button></form>}</div>)}</div></section>
    <section><h2 className="mb-3 text-lg font-semibold">Sesiones recientes</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th>Sucursal</th><th>Register</th><th>Estado</th><th>Apertura</th><th>Esperado</th><th>Diferencia</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id} className="border-t"><td>{session.branch.name}</td><td>{session.register.name}</td><td>{session.status}</td><td>{session.openedAt.toLocaleString("es-MX")}</td><td>{session.expectedCash?.toString() ?? "—"}</td><td>{session.difference?.toString() ?? "—"}</td></tr>)}</tbody></table></div></section>
  </main>;
}
