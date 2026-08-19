"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { updatePersonnel, updateHourlyRate } from "@/app/actions/personnel";
import { setEmployeePinAction, clearEmployeePinAction } from "@/app/actions/kiosk";
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
  const [savingRate, setSavingRate] = useState(false);
  const [rateMessage, setRateMessage] = useState<string | null>(null);
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
        <SectionHeader icon={DollarIcon} title="Pago por hora" />

        <p className="text-sm text-on-surface-variant">
          Se usa para calcular la nómina desde el checador.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            className="w-40 rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
          <button
            onClick={handleSaveRate}
            disabled={savingRate}
            className="rounded-xl border border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] hover:border-primary hover:text-primary disabled:opacity-60 disabled:hover:scale-100"
          >
            {savingRate ? "Guardando..." : "Guardar tarifa"}
          </button>
        </div>

        {rateMessage && (
          <p className="text-xs text-on-surface-variant">{rateMessage}</p>
        )}
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
