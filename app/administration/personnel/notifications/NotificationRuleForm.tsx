"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createNotificationRuleAction,
  updateNotificationRuleAction,
  type ActionResult,
} from "@/app/actions/notificationRules";
import { ROLE_LABELS, type PersonnelRole } from "@/lib/personnelRoles";

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  STOCK_BAJO: "Stock bajo en sucursales",
  LICOR_CADUCIDAD: "Botellas de licor por caducar",
  RECONTEO_PENDIENTE: "Reconteo de evento sin surtir",
  CORTE_DIFERENCIA: "Diferencias al cerrar un corte de caja",
  PROCESO_ATRASADO: "Procesos de producción atrasados",
};

const TRIGGER_TYPE_HELP: Record<string, string> = {
  STOCK_BAJO:
    "Avisa cuando un insumo cae debajo de su mínimo configurado en cualquier sucursal.",
  LICOR_CADUCIDAD: "Avisa sobre botellas disponibles que se acercan a su fecha de caducidad.",
  RECONTEO_PENDIENTE:
    "Avisa cuando un reconteo de evento generó una lista de faltantes que nadie marcó como surtida.",
  CORTE_DIFERENCIA:
    "Avisa cuando un corte de caja cerrado tiene una diferencia mayor al mínimo indicado.",
  PROCESO_ATRASADO:
    "Avisa cuando un proceso de producción (cocción, molienda, fermentación, destilación) lleva más de 1 hora sin registro.",
};

const ROLE_OPTIONS: PersonnelRole[] = ["ADMIN", "GERENTE", "ENCARGADO", "OPERATOR", "CONSULTA"];

type ThresholdConfig = { daysBeforeExpiration?: number; minDifference?: number };

type InitialValues = {
  id: string;
  name: string;
  triggerType: string;
  checkFrequencyMinutes: number;
  recipientRoles: string[];
  thresholdConfig: ThresholdConfig | null;
};

export default function NotificationRuleForm({
  initialValues,
}: {
  initialValues?: InitialValues;
}) {
  const router = useRouter();
  const isEditing = !!initialValues;

  const [result, setResult] = useState<ActionResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [triggerType, setTriggerType] = useState(initialValues?.triggerType ?? "STOCK_BAJO");

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setResult(null);

    const response = isEditing
      ? await updateNotificationRuleAction(initialValues!.id, formData)
      : await createNotificationRuleAction(formData);

    setSaving(false);
    setResult(response);

    if (response.success) {
      router.push("/administration/personnel/notifications");
    }
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-6 rounded-2xl border border-outline-variant bg-surface-container p-6"
    >
      {result && !result.success && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
          {result.error}
        </div>
      )}

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-on-surface-variant">Nombre de la regla</span>
        <input
          name="name"
          required
          defaultValue={initialValues?.name}
          className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          placeholder="Ej. Stock bajo en sucursales"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-on-surface-variant">Tipo de notificación</span>
        <select
          name="triggerType"
          required
          value={triggerType}
          onChange={(e) => setTriggerType(e.target.value)}
          className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        >
          {Object.entries(TRIGGER_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="text-xs text-on-surface-variant">{TRIGGER_TYPE_HELP[triggerType]}</p>
      </label>

      {triggerType === "LICOR_CADUCIDAD" && (
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">
            Días antes de caducar
          </span>
          <input
            name="daysBeforeExpiration"
            type="number"
            min="1"
            step="1"
            defaultValue={initialValues?.thresholdConfig?.daysBeforeExpiration ?? 7}
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>
      )}

      {triggerType === "CORTE_DIFERENCIA" && (
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-on-surface-variant">
            Diferencia mínima ($)
          </span>
          <input
            name="minDifference"
            type="number"
            min="0"
            step="0.01"
            defaultValue={initialValues?.thresholdConfig?.minDifference ?? 10}
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>
      )}

      <label className="block space-y-2">
        <span className="text-sm font-semibold text-on-surface-variant">
          Revisar cada (minutos)
        </span>
        <input
          name="checkFrequencyMinutes"
          type="number"
          min="15"
          step="1"
          required
          defaultValue={initialValues?.checkFrequencyMinutes ?? 60}
          className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        />
        <p className="text-xs text-on-surface-variant">
          Mínimo 15 minutos. El sistema revisa cada hora; esta regla solo se evalúa cuando ya pasó
          este tiempo desde la última revisión.
        </p>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-on-surface-variant">
          ¿Quién debe recibirla?
        </legend>
        <div className="flex flex-wrap gap-3">
          {ROLE_OPTIONS.map((role) => (
            <label
              key={role}
              className="flex items-center gap-2 rounded-xl border border-outline-variant bg-background px-4 py-2.5 text-sm text-on-surface"
            >
              <input
                type="checkbox"
                name="recipientRoles"
                value={role}
                defaultChecked={
                  initialValues
                    ? initialValues.recipientRoles.includes(role)
                    : role === "ADMIN" || role === "GERENTE"
                }
              />
              {ROLE_LABELS[role]}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear regla"}
      </button>
    </form>
  );
}
