"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { todayDateOnly } from "@/lib/dateOnly";
import { updatePersonnel, updateHourlyRate, updateBranchHourlyRate, updatePayrollSupplementPercent } from "@/app/actions/personnel";
import { setEmployeePinAction, clearEmployeePinAction } from "@/app/actions/kiosk";
import { calculateCompositeSalary } from "@/lib/payroll/compositeSalary";
import {
  ROLE_LABELS,
  ROLES_CON_SUCURSAL,
  ROLE_ICON,
  ROLE_BADGE_CLASS,
  type PersonnelRole,
} from "@/lib/personnelRoles";
import {
  UsersIcon,
  LockIcon,
  DollarIcon,
  GridIcon,
  type IconProps,
} from "@/components/ui/icons";

type UserRole = PersonnelRole;

interface Branch {
  id: string;
  name: string;
}

interface UserData {
  id: string;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  hourlyRate: number | null;
  payrollSupplementPercent: number;
  salaryRates: { branchId: string; amount: number }[];
  hasPin: boolean;
  branches: { branch: Branch }[];
}

export default function EditPersonnelForm({
  user,
  allBranches,
}: {
  user: UserData;
  allBranches: Branch[];
}) {
  const router = useRouter();

  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState<UserRole>(user.role);
  const [branchIds, setBranchIds] = useState<string[]>(
    user.branches.map((b) => b.branch.id),
  );
  const [newPassword, setNewPassword] = useState("");
  const [hourlyRate, setHourlyRate] = useState(user.hourlyRate?.toString() ?? "");
  const [supplementPercent, setSupplementPercent] = useState(String(user.payrollSupplementPercent));
  const [supplementEffectiveDate, setSupplementEffectiveDate] = useState(todayDateOnly());
  const [savingSupplement, setSavingSupplement] = useState(false);
  const [supplementMessage, setSupplementMessage] = useState<string | null>(null);
  const [savingRate, setSavingRate] = useState(false);
  const [rateMessage, setRateMessage] = useState<string | null>(null);
  const [branchRates, setBranchRates] = useState<Record<string, string>>(
    Object.fromEntries(user.salaryRates.map((rate) => [rate.branchId, String(rate.amount)])),
  );
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null);
  const [branchRateMessage, setBranchRateMessage] = useState<string | null>(null);

  const numericRate = parseFloat(hourlyRate) || 0;
  const composite = calculateCompositeSalary(numericRate, 40);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasPin, setHasPin] = useState(user.hasPin);
  const [newPin, setNewPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  function toggleBranch(branchId: string) {
    setBranchIds((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId],
    );
  }

  async function handleSaveRate() {
    setSavingRate(true);
    setRateMessage(null);

    const value = hourlyRate.trim() === "" ? null : Number(hourlyRate);

    const result = await updateHourlyRate(user.id, value);

    setSavingRate(false);

    if (result.error) {
      setRateMessage(result.error);
      return;
    }

    setRateMessage("Tarifa guardada.");
    router.refresh();
  }

  async function handleSaveSupplement() {
    setSavingSupplement(true);
    setSupplementMessage(null);
    const result = await updatePayrollSupplementPercent(user.id, Number(supplementPercent), supplementEffectiveDate);
    setSavingSupplement(false);
    setSupplementMessage(result.error ?? "Adicional contractual guardado para las horas futuras.");
    if (!result.error) router.refresh();
  }

  async function handleSaveBranchRate(branchId: string) {
    setSavingBranchId(branchId);
    setBranchRateMessage(null);
    const raw = (branchRates[branchId] ?? "").trim();
    const result = await updateBranchHourlyRate(user.id, branchId, raw === "" ? null : Number(raw));
    setSavingBranchId(null);
    setBranchRateMessage(result.error ?? "Tarifa de sucursal guardada.");
    if (!result.error) router.refresh();
  }

  async function handleSetPin() {
    setPinMessage(null);

    if (!/^\d{4}$/.test(newPin)) {
      setPinMessage("El PIN debe ser de exactamente 4 dígitos.");
      return;
    }

    setPinBusy(true);
    const result = await setEmployeePinAction(user.id, newPin);
    setPinBusy(false);

    if (result?.error) {
      setPinMessage(result.error);
      return;
    }

    setHasPin(true);
    setNewPin("");
    setPinMessage("PIN guardado.");
    router.refresh();
  }

  async function handleClearPin() {
    if (!confirm("¿Quitar el PIN? Ya no podrá usar el checador de kiosco.")) return;

    setPinBusy(true);
    setPinMessage(null);
    const result = await clearEmployeePinAction(user.id);
    setPinBusy(false);

    if (result?.error) {
      setPinMessage(result.error);
      return;
    }

    setHasPin(false);
    setPinMessage("PIN eliminado.");
    router.refresh();
  }

  async function handleSave() {
    setError(null);
    setSuccess(false);

    if (!name || !username) {
      setError("Nombre y usuario son obligatorios.");
      return;
    }

    if (ROLES_CON_SUCURSAL.includes(role) && branchIds.length === 0) {
      setError("Selecciona al menos una sucursal para este rol.");
      return;
    }

    setSaving(true);

    const result = await updatePersonnel({
      userId: user.id,
      name,
      username,
      email: email || undefined,
      phone: phone || undefined,
      role,
      branchIds: ROLES_CON_SUCURSAL.includes(role) ? branchIds : [],
      newPassword: newPassword || undefined,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    // Si también se modificó la tarifa por hora, se guarda automáticamente
    const rateValue = hourlyRate.trim() === "" ? null : Number(hourlyRate);
    if (rateValue !== user.hourlyRate && !Number.isNaN(rateValue)) {
      await updateHourlyRate(user.id, rateValue);
    }

    setSuccess(true);
    setNewPassword("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 p-3 text-sm text-tertiary-fixed-dim">
          Cambios guardados correctamente.
        </div>
      )}

      <section className="compact-form-panel space-y-4 rounded-xl border border-outline-variant bg-surface-container">
        <SectionHeader icon={UsersIcon} title="Identidad" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nombre completo">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </Field>

          <Field label="Usuario">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </Field>

          <Field label="Email (opcional)">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </Field>

          <Field label="Teléfono para acceso por SMS">
            <input
              type="tel"
              inputMode="tel"
              placeholder="494 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </Field>
        </div>

        <Field label="Rol">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ROLE_LABELS) as UserRole[]).map((key) => {
              const RoleIcon = ROLE_ICON[key];

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRole(key)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    role === key
                      ? ROLE_BADGE_CLASS[key]
                      : "border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
                  }`}
                >
                  <RoleIcon className="h-4 w-4" />
                  {ROLE_LABELS[key]}
                </button>
              );
            })}
          </div>
        </Field>

        {ROLES_CON_SUCURSAL.includes(role) && (
          <Field label="Sucursales asignadas">
            <div className="flex flex-wrap gap-2">
              {allBranches.map((b) => (
                <label
                  key={b.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    branchIds.includes(b.id)
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-outline-variant bg-background text-on-surface-variant hover:border-primary/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={branchIds.includes(b.id)}
                    onChange={() => toggleBranch(b.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  {b.name}
                </label>
              ))}
            </div>
          </Field>
        )}
      </section>

      <section className="compact-form-panel space-y-4 rounded-xl border border-outline-variant bg-surface-container">
        <SectionHeader icon={LockIcon} title="Seguridad" />

        <Field label="Nueva contraseña (déjalo vacío para no cambiarla)">
          <input
            type="password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </Field>
      </section>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="compact-action bg-primary font-semibold text-on-primary transition duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>

      <section className="compact-form-panel space-y-4 rounded-xl border border-outline-variant bg-surface-container">
        <SectionHeader icon={DollarIcon} title="Sueldo Base y Salario Compuesto" />

        <p className="text-sm text-on-surface-variant">
          Captura el <strong>sueldo base por hora</strong>. El sistema recalcula en tiempo real el desglose proporcional de ley (aguinaldo, vacaciones y prima vacacional) y aplicará esta tarifa de hoy en adelante, manteniendo intactas las nóminas de semanas pasadas.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-on-surface-variant">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="w-44 rounded-xl border border-outline-variant bg-background pl-8 pr-4 py-3 text-base font-bold text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
            />
          </div>
          <button
            onClick={handleSaveRate}
            disabled={savingRate}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-sm transition duration-150 ease-out hover:opacity-90 active:scale-[0.97] disabled:opacity-60"
          >
            {savingRate ? "Guardando..." : "Actualizar tarifa"}
          </button>
        </div>

        {rateMessage && (
          <p className={`text-xs font-semibold ${rateMessage.includes("error") || rateMessage.includes("válida") ? "text-error" : "text-primary"}`}>
            {rateMessage}
          </p>
        )}

        {numericRate > 0 && (
          <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-1 border-b border-primary/15 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Desglose de Salario Compuesto (en vivo)
              </span>
              <span className="text-xs font-semibold text-on-surface-variant">
                Jornada estimada: 40 hrs / sem.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-outline-variant/60 bg-surface p-2.5">
                <p className="text-[11px] font-semibold text-on-surface-variant">Sueldo Base</p>
                <p className="mt-0.5 text-base font-bold text-on-surface">${composite.baseHourlyRate.toFixed(2)}/h</p>
                <p className="mt-0.5 font-mono text-[10px] text-on-surface-variant">${composite.basePay.toFixed(2)} sem.</p>
              </div>

              <div className="rounded-xl border border-outline-variant/60 bg-surface p-2.5">
                <p className="text-[11px] font-semibold text-on-surface-variant">Aguinaldo (15 días)</p>
                <p className="mt-0.5 text-base font-bold text-primary">+${composite.aguinaldoHourly.toFixed(2)}/h</p>
                <p className="mt-0.5 font-mono text-[10px] text-on-surface-variant">+${composite.aguinaldoPay.toFixed(2)} sem.</p>
              </div>

              <div className="rounded-xl border border-outline-variant/60 bg-surface p-2.5">
                <p className="text-[11px] font-semibold text-on-surface-variant">Vacaciones (12 días)</p>
                <p className="mt-0.5 text-base font-bold text-primary">+${composite.vacacionesHourly.toFixed(2)}/h</p>
                <p className="mt-0.5 font-mono text-[10px] text-on-surface-variant">+${composite.vacacionesPay.toFixed(2)} sem.</p>
              </div>

              <div className="rounded-xl border border-outline-variant/60 bg-surface p-2.5">
                <p className="text-[11px] font-semibold text-on-surface-variant">Prima Vac. (25%)</p>
                <p className="mt-0.5 text-base font-bold text-primary">+${composite.primaVacacionalHourly.toFixed(2)}/h</p>
                <p className="mt-0.5 font-mono text-[10px] text-on-surface-variant">+${composite.primaVacacionalPay.toFixed(2)} sem.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/10 px-3.5 py-2.5 text-primary">
              <span className="text-xs font-bold">
                Tarifa Integrada Total: ${composite.totalHourlyRate.toFixed(2)} / hora
              </span>
              <span className="text-sm font-black">
                Total por 40 hrs: ${composite.totalPay.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <div className="border-t border-outline-variant pt-4">
          <p className="mb-2 text-sm font-semibold text-on-surface">Adicional contractual por hora (%)</p>
          <p className="mb-2 text-xs text-on-surface-variant">
            Por empleado; ejemplo 12% ($40 base + $4.80 adicional = $44.80/h).
            Es un pago adicional contractual, no una liquidación automática de derechos como vacaciones o aguinaldo.
            La fecha seleccionada define cuándo comienza la vigencia. 0% desactiva nuevos adicionales.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="Porcentaje adicional contractual" type="number" min="0" max="30" step="0.01"
              value={supplementPercent} onChange={(e) => setSupplementPercent(e.target.value)}
              className="w-28 rounded-xl border border-outline-variant bg-background px-3 py-2 text-sm" />
            <span className="text-sm">%</span>
            <input aria-label="Vigente desde" title="Vigente desde" type="date" value={supplementEffectiveDate}
              onChange={(e) => setSupplementEffectiveDate(e.target.value)}
              className="rounded-xl border border-outline-variant bg-background px-3 py-2 text-sm" />
            <button type="button" onClick={handleSaveSupplement} disabled={savingSupplement}
              className="rounded-xl border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-60">
              {savingSupplement ? "Guardando..." : "Guardar adicional"}
            </button>
          </div>
          {supplementMessage && <p className="mt-2 text-xs text-on-surface-variant">{supplementMessage}</p>}
        </div>
        <div className="border-t border-outline-variant pt-4">
          <p className="mb-3 text-sm font-semibold text-on-surface">Tarifa por sucursal</p>
          <p className="mb-3 text-xs text-on-surface-variant">Deja el campo vacío para usar la tarifa general. Los cambios aplican a las entradas posteriores y conservan el historial anterior.</p>
          <div className="space-y-2">
            {allBranches.map((branch) => (
              <div key={branch.id} className="flex flex-wrap items-center gap-2">
                <label htmlFor={`rate-${branch.id}`} className="w-40 text-sm text-on-surface">{branch.name}</label>
                <input
                  id={`rate-${branch.id}`}
                  type="number" min="0" step="0.01" placeholder={hourlyRate || "Tarifa general"}
                  value={branchRates[branch.id] ?? ""}
                  onChange={(event) => setBranchRates((current) => ({ ...current, [branch.id]: event.target.value }))}
                  className="w-40 rounded-xl border border-outline-variant bg-background px-4 py-2 text-sm text-on-surface outline-none focus:border-primary"
                />
                <button type="button" onClick={() => handleSaveBranchRate(branch.id)} disabled={savingBranchId !== null}
                  className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface hover:border-primary disabled:opacity-60">
                  {savingBranchId === branch.id ? "Guardando..." : "Guardar"}
                </button>
              </div>
            ))}
          </div>
          {branchRateMessage && <p className="mt-2 text-xs text-on-surface-variant">{branchRateMessage}</p>}
        </div>
      </section>

      <section className="compact-form-panel space-y-4 rounded-xl border border-outline-variant bg-surface-container">
        <SectionHeader icon={GridIcon} title="Checador de kiosco" />

        <p className="text-sm text-on-surface-variant">
          PIN de 4 dígitos para checar entrada/salida en un dispositivo compartido de la
          sucursal, sin usar su contraseña.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
              hasPin
                ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"
                : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {hasPin ? "PIN configurado" : "Sin PIN"}
          </span>

          {hasPin && (
            <button
              onClick={handleClearPin}
              disabled={pinBusy}
              className="rounded-xl border border-error/40 px-3 py-1.5 text-xs font-bold text-error transition hover:bg-error/10 disabled:opacity-60"
            >
              Quitar PIN
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="0000"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-28 rounded-xl border border-outline-variant bg-background px-4 py-3 text-center text-sm tracking-[0.3em] text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
          <button
            onClick={handleSetPin}
            disabled={pinBusy}
            className="rounded-xl border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface transition hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {pinBusy ? "Guardando..." : hasPin ? "Cambiar PIN" : "Asignar PIN"}
          </button>
        </div>

        {pinMessage && <p className="text-xs text-on-surface-variant">{pinMessage}</p>}
      </section>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: ComponentType<IconProps>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-on-surface-variant" />
      <h2 className="text-lg font-bold text-on-surface">{title}</h2>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-on-surface-variant">
        {label}
      </span>
      {children}
    </label>
  );
}
