"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setModulePermissionAction,
  setGroupPermissionAction,
  setAllPermissionsAction,
} from "@/app/actions/permissions";
import {
  PERMISSION_GROUPS,
  isConfigurablePermissionKey,
  type PermissionGroup,
} from "@/lib/permission-modules";
import {
  ClockIcon,
  CrownIcon,
  FactoryIcon,
  MartiniIcon,
  WalletIcon,
  CashRegisterIcon,
  PackageIcon,
  ReceiptIcon,
  PartyIcon,
  UsersIcon,
  SearchIcon,
  CheckIcon,
  XIcon,
} from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

interface UserSummary {
  id: string;
  name: string;
  username: string;
  role: string;
}

const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Proceso de Producción": FactoryIcon,
  "Elaboración de Licores": MartiniIcon,
  "Cortes de Caja": WalletIcon,
  "Punto de Venta": CashRegisterIcon,
  "Inventario y Eventos": PackageIcon,
  "Contabilidad y Finanzas": ReceiptIcon,
  "Cotizador Tequilitros": PartyIcon,
  "Checador y Asistencia Personal": ClockIcon,
  "Administración de Personal y Horarios (Workforce)": UsersIcon,
};

export default function PermissionsForm({
  userId,
  userName,
  userUsername,
  userRole,
  userBranches = [],
  initialKeys,
  allUsers = [],
}: {
  userId: string;
  userName: string;
  userUsername?: string;
  userRole: string;
  userBranches?: string[];
  initialKeys: string[];
  allUsers?: UserSummary[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { showToast } = useToast();

  const [granted, setGranted] = useState<Set<string>>(
    () => new Set(initialKeys.filter(isConfigurablePermissionKey)),
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "GRANTED" | "REVOKED">("ALL");

  const isAdmin = userRole === "ADMIN";

  const totalModules = useMemo(
    () => PERMISSION_GROUPS.reduce((sum, g) => sum + g.modules.length, 0),
    [],
  );

  const grantedCount = granted.size;
  const revokedCount = totalModules - grantedCount;

  // Filtrado reactivo en tiempo real
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();

    return PERMISSION_GROUPS.map((group) => {
      const filteredModules = group.modules.filter((mod) => {
        const matchesQuery =
          !q ||
          mod.label.toLowerCase().includes(q) ||
          mod.key.toLowerCase().includes(q) ||
          group.group.toLowerCase().includes(q);

        if (!matchesQuery) return false;

        const isChecked = granted.has(mod.key);
        if (statusFilter === "GRANTED") return isChecked;
        if (statusFilter === "REVOKED") return !isChecked;
        return true;
      });

      return {
        ...group,
        modules: filteredModules,
      };
    }).filter((group) => group.modules.length > 0);
  }, [search, statusFilter, granted]);

  async function toggleOne(key: string) {
    const willGrant = !granted.has(key);
    setSavingKey(key);

    setGranted((prev) => {
      const next = new Set(prev);
      if (willGrant) next.add(key);
      else next.delete(key);
      return next;
    });

    const result = await setModulePermissionAction(userId, key, willGrant);
    setSavingKey(null);

    if (!result.success) {
      setGranted((prev) => {
        const next = new Set(prev);
        if (willGrant) next.delete(key);
        else next.add(key);
        return next;
      });
      showToast(result.error ?? "No se pudo guardar el permiso.", "error");
      return;
    }

    showToast(
      willGrant
        ? `Acceso a "${key}" permitido.`
        : `Acceso a "${key}" denegado.`,
      "success",
    );
  }

  async function toggleGroup(keys: string[], willGrant: boolean) {
    if (keys.length === 0) return;
    setSavingKey(keys[0]);

    setGranted((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (willGrant ? next.add(k) : next.delete(k)));
      return next;
    });

    const result = await setGroupPermissionAction(userId, keys, willGrant);
    setSavingKey(null);

    if (!result.success) {
      setGranted((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => (willGrant ? next.delete(k) : next.add(k)));
        return next;
      });
      showToast(result.error ?? "No se pudo actualizar el grupo.", "error");
      return;
    }

    showToast(
      willGrant
        ? `Se autorizaron ${keys.length} páginas del grupo.`
        : `Se revocaron ${keys.length} páginas del grupo.`,
      "success",
    );
  }

  async function handleSetAll(willGrant: boolean) {
    const confirmMsg = willGrant
      ? `¿Deseas conceder acceso a TODAS las ${totalModules} páginas a ${userName}?`
      : `¿Deseas revocar el acceso a todas las páginas a ${userName}?`;

    if (!window.confirm(confirmMsg)) return;

    setSavingKey("ALL");

    const allKeys = PERMISSION_GROUPS.flatMap((g) => g.modules.map((m) => m.key));

    setGranted((prev) => {
      if (willGrant) return new Set(allKeys);
      return new Set();
    });

    const result = await setAllPermissionsAction(userId, willGrant);
    setSavingKey(null);

    if (!result.success) {
      showToast(result.error ?? "No fue posible actualizar todos los permisos.", "error");
      router.refresh();
      return;
    }

    showToast(
      willGrant
        ? `Acceso total concedido a ${userName}.`
        : `Todos los permisos revocados para ${userName}.`,
      "success",
    );
  }

  function handleUserChange(newUserId: string) {
    if (newUserId && newUserId !== userId) {
      startTransition(() => {
        router.push(`/administration/personnel/${newUserId}/permissions`);
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Selector rápido de usuario */}
      {allUsers.length > 1 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-on-surface">
              Configurando permisos de:
            </span>
          </div>

          <div className="relative min-w-[260px]">
            <select
              value={userId}
              onChange={(e) => handleUserChange(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-sm font-semibold text-on-surface focus:border-primary focus:outline-none"
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role}) {u.username ? `· @${u.username}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Tarjeta de usuario */}
      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
        <div className="flex flex-col gap-4 border-b border-outline-variant p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-on-surface">{userName}</h1>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                {userRole}
              </span>
              {userUsername && (
                <span className="text-xs font-mono text-on-surface-variant">
                  @{userUsername}
                </span>
              )}
            </div>

            {userBranches.length > 0 && (
              <p className="text-xs text-on-surface-variant">
                Sucursales asignadas:{" "}
                <span className="font-semibold text-on-surface">
                  {userBranches.join(", ")}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isAdmin && (
              <>
                <button
                  type="button"
                  disabled={savingKey !== null}
                  onClick={() => handleSetAll(true)}
                  className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/20 disabled:opacity-50"
                >
                  Conceder todo
                </button>
                <button
                  type="button"
                  disabled={savingKey !== null}
                  onClick={() => handleSetAll(false)}
                  className="rounded-xl border border-outline-variant bg-surface-container-high px-3 py-2 text-xs font-bold text-on-surface-variant transition hover:bg-error/10 hover:text-error disabled:opacity-50"
                >
                  Revocar todo
                </button>
              </>
            )}
          </div>
        </div>

        {/* Barra de progreso de permisos */}
        {!isAdmin && (
          <div className="bg-surface-container-low px-5 py-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-on-surface-variant">
                Páginas autorizadas:
              </span>
              <span className="font-mono text-on-surface">
                {grantedCount} de {totalModules} ({Math.round((grantedCount / totalModules) * 100)}%)
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${(grantedCount / totalModules) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-3 rounded-2xl border border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tertiary-fixed-dim/15">
            <CrownIcon className="h-6 w-6 text-tertiary-fixed-dim" />
          </span>
          <div>
            <h3 className="font-bold text-on-surface">Acceso Total de Administrador</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              <span className="font-semibold text-on-surface">{userName}</span> tiene el rol{" "}
              <span className="font-bold">ADMIN</span> y puede ver e interactuar con todas las páginas y funciones del sistema automáticamente.
            </p>
          </div>
        </div>
      )}

      {!isAdmin && (
        <>
          {/* Barra de Búsqueda y Filtros */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o ruta (ej. 'licores', 'mesas', 'caja', 'recetas')..."
                className="w-full rounded-xl border border-outline-variant bg-surface-container pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container p-1">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === "ALL"
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Todas ({totalModules})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("GRANTED")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === "GRANTED"
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Autorizadas ({grantedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("REVOKED")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === "REVOKED"
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Bloqueadas ({revokedCount})
              </button>
            </div>
          </div>

          {/* Listado de Grupos y Páginas */}
          <div className="space-y-5">
            {filteredGroups.length === 0 ? (
              <div className="rounded-2xl border border-outline-variant bg-surface-container p-8 text-center">
                <p className="text-sm font-semibold text-on-surface-variant">
                  No se encontraron páginas que coincidan con &ldquo;{search}&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                  }}
                  className="mt-3 text-xs font-bold text-primary hover:underline"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const groupKeys = group.modules.map((m) => m.key);
                const groupGrantedCount = groupKeys.filter((k) => granted.has(k)).length;
                const allGroupGranted = groupGrantedCount === groupKeys.length;
                const someGroupGranted = groupGrantedCount > 0 && !allGroupGranted;
                const GroupGlyph = GROUP_ICONS[group.group] ?? PackageIcon;

                return (
                  <div
                    key={group.group}
                    className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container"
                  >
                    {/* Encabezado del Grupo */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-surface-container-high px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <GroupGlyph className="h-4 w-4" />
                        </span>
                        <div>
                          <h2 className="font-bold text-on-surface">{group.group}</h2>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            allGroupGranted
                              ? "bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim"
                              : someGroupGranted
                                ? "bg-secondary/20 text-secondary"
                                : "bg-surface-container-highest text-outline"
                          }`}
                        >
                          {groupGrantedCount} / {groupKeys.length} autorizadas
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={savingKey !== null}
                          onClick={() => toggleGroup(groupKeys, !allGroupGranted)}
                          className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:border-primary hover:text-primary disabled:opacity-50"
                        >
                          {allGroupGranted ? "Quitar todas del grupo" : "Marcar todas del grupo"}
                        </button>
                      </div>
                    </div>

                    {/* Módulos / Páginas del Grupo */}
                    <div className="grid gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-3">
                      {group.modules.map((mod) => {
                        const isChecked = granted.has(mod.key);
                        const isSaving = savingKey === mod.key || savingKey === "ALL";

                        return (
                          <button
                            key={mod.key}
                            type="button"
                            disabled={isSaving}
                            onClick={() => toggleOne(mod.key)}
                            className={`group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition duration-150 ease-out disabled:opacity-60 ${
                              isChecked
                                ? "border-primary/40 bg-primary/5 hover:border-primary"
                                : "border-outline-variant bg-background hover:border-outline hover:bg-surface-container-low"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={`text-sm font-semibold leading-snug ${
                                  isChecked ? "text-on-surface" : "text-on-surface-variant"
                                }`}
                              >
                                {mod.label}
                              </span>
                              <Switch checked={isChecked} />
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-1 border-t border-outline-variant/50 pt-2 text-[11px]">
                              <code className="font-mono text-outline">{mod.key}</code>
                              <span
                                className={`font-semibold ${
                                  isChecked ? "text-primary" : "text-outline"
                                }`}
                              >
                                {isChecked ? "Permitida" : "Bloqueada"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-in-out ${
        checked ? "bg-primary" : "bg-surface-container-highest"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 flex h-4 w-4 items-center justify-center rounded-full shadow transition-transform duration-200 ease-in-out ${
          checked ? "translate-x-4 bg-on-primary" : "translate-x-0 bg-white"
        }`}
      >
        {checked && <CheckIcon className="h-2.5 w-2.5 text-primary stroke-[3]" />}
      </span>
    </span>
  );
}
