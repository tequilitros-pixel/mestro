import Link from "next/link";
import { getNotificationRules } from "@/app/actions/notificationRules";
import { ROLE_LABELS, type PersonnelRole } from "@/lib/personnelRoles";
import { PlusIcon, BellIcon } from "@/components/ui/icons";
import RuleActions from "./RuleActions";

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  STOCK_BAJO: "Stock bajo en sucursales",
  LICOR_CADUCIDAD: "Botellas de licor por caducar",
  RECONTEO_PENDIENTE: "Reconteo de evento sin surtir",
  CORTE_DIFERENCIA: "Diferencias al cerrar un corte de caja",
  PROCESO_ATRASADO: "Procesos de producción atrasados",
};

export default async function NotificationRulesPage() {
  const rules = await getNotificationRules();

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/administration/personnel"
              className="mb-2 inline-block text-sm font-semibold text-on-surface-variant hover:text-on-surface"
            >
              ← Personal
            </Link>
            <h1 className="flex items-center gap-2 text-3xl font-bold sm:text-4xl">
              <BellIcon className="h-7 w-7 text-on-surface-variant" />
              Notificaciones
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
              Configura qué avisos se mandan por notificación push, quién los recibe y cada cuánto
              se revisan.
            </p>
          </div>

          <Link
            href="/administration/personnel/notifications/new"
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            <PlusIcon className="h-4 w-4" />
            Nueva regla
          </Link>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container divide-y divide-outline-variant">
          {rules.length === 0 && (
            <p className="p-6 text-sm text-on-surface-variant">
              Aún no hay reglas de notificación configuradas.
            </p>
          )}

          {rules.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <Link
                  href={`/administration/personnel/notifications/${rule.id}`}
                  className="font-semibold text-on-surface hover:underline"
                >
                  {rule.name}
                </Link>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {TRIGGER_TYPE_LABELS[rule.triggerType] ?? rule.triggerType} · Cada{" "}
                  {rule.checkFrequencyMinutes} min ·{" "}
                  {rule.recipientRoles
                    .map((role) => ROLE_LABELS[role as PersonnelRole] ?? role)
                    .join(", ")}
                </p>
              </div>

              <RuleActions id={rule.id} active={rule.active} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
