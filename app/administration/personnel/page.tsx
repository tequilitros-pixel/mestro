"use client";

import { useEffect, useMemo, useState, startTransition } from "react";
import Link from "next/link";
import {
  getPersonnel,
  getBranchesForAssignment,
  createPersonnel,
  updatePersonnelActive,
} from "@/app/actions/personnel";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import { PlusIcon, UsersIcon } from "@/components/ui/icons";
import PageTabs from "@/components/ui/PageTabs";
import {
  ROLE_LABELS,
  ROLES_CON_SUCURSAL,
  ROLE_ICON,
  ROLE_BADGE_CLASS,
  ROLE_AVATAR_CLASS,
  getInitials,
  type PersonnelRole,
} from "@/lib/personnelRoles";

interface Branch {
  id: string;
  name: string;
}

interface PersonnelUser {
  id: string;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: PersonnelRole;
  active: boolean;
  branches: { branch: Branch }[];
}

export default function PersonnelPage() {
  const [users, setUsers] = useState<PersonnelUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<PersonnelRole | "TODOS">(
    "TODOS"
  );

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<PersonnelRole>("ENCARGADO");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [usersData, branchesData] = await Promise.all([
        getPersonnel(),
        getBranchesForAssignment(),
      ]);
      startTransition(() => {
        setUsers(usersData as PersonnelUser[]);
        setBranches(branchesData);
        setLoading(false);
      });
    } catch (err) {
      startTransition(() => {
        setError(err instanceof Error ? err.message : "Error desconocido");
        setLoading(false);
      });
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function toggleBranch(branchId: string) {
    setBranchIds((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId]
    );
  }

  async function handleCreate() {
    setFormError(null);
    if (!name || !username || !password) {
      setFormError("Nombre, usuario y contraseña son obligatorios.");
      return;
    }
    if (ROLES_CON_SUCURSAL.includes(role) && branchIds.length === 0) {
      setFormError("Selecciona al menos una sucursal para este rol.");
      return;
    }

    setSubmitting(true);
    const result = await createPersonnel({
      name,
      username,
      email: email || undefined,
      phone: phone || undefined,
      password,
      role,
      branchIds: ROLES_CON_SUCURSAL.includes(role) ? branchIds : [],
    });
    setSubmitting(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    setName("");
    setUsername("");
    setEmail("");
    setPhone("");
    setPassword("");
    setRole("ENCARGADO");
    setBranchIds([]);
    await loadAll();
  }

  async function handleToggleActive(userId: string, active: boolean) {
    await updatePersonnelActive(userId, !active);
    await loadAll();
  }

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.active).length;
    const admins = users.filter((u) => u.role === "ADMIN").length;
    const branchesCovered = new Set(
      users.flatMap((u) => u.branches.map((b) => b.branch.id))
    ).size;

    return { total, active, inactive: total - active, admins, branchesCovered };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((u) => {
      const matchesRole = roleFilter === "TODOS" || u.role === roleFilter;
      const matchesQuery =
        query === "" ||
        u.name.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query);

      return matchesRole && matchesQuery;
    });
  }, [users, search, roleFilter]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs font-black uppercase tracking-[0.35em] text-on-surface-variant">
              Administración
            </p>

            <h1 className="mt-2 text-4xl font-bold text-on-surface">
              Personal
            </h1>

            <p className="mt-2 text-sm text-on-surface-variant">
              Crea usuarios y asígnales rol, sucursales y permisos.
            </p>
          </div>

        </div>

        {error && (
          <div className="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error">
            {error}
          </div>
        )}

        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardLabel>Personal total</CardLabel>
            <CardValue>{stats.total}</CardValue>
          </Card>

          <Card highlight>
            <CardLabel>Activos</CardLabel>
            <CardValue>{stats.active}</CardValue>
          </Card>

          <Card>
            <CardLabel>Inactivos</CardLabel>
            <CardValue>{stats.inactive}</CardValue>
          </Card>

          <Card>
            <CardLabel>Sucursales cubiertas</CardLabel>
            <CardValue>{stats.branchesCovered}</CardValue>
          </Card>
        </section>

        <PageTabs
          tabs={[
            {
              key: "equipo",
              label: "Equipo",
              icon: <UsersIcon className="h-4 w-4" />,
              content: (
                <>
                          <section className="space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="relative w-full sm:max-w-xs">
                                <input
                                  value={search}
                                  onChange={(e) => setSearch(e.target.value)}
                                  placeholder="Buscar por nombre o usuario..."
                                  className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                                />
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => setRoleFilter("TODOS")}
                                  className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                                    roleFilter === "TODOS"
                                      ? "bg-primary text-on-primary"
                                      : "border border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
                                  }`}
                                >
                                  Todos
                                </button>

                                {(Object.keys(ROLE_LABELS) as PersonnelRole[]).map((key) => (
                                  <button
                                    key={key}
                                    onClick={() => setRoleFilter(key)}
                                    className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                                      roleFilter === key
                                        ? ROLE_BADGE_CLASS[key]
                                        : "border border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-on-surface"
                                    }`}
                                  >
                                    {ROLE_LABELS[key]}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-outline-variant bg-surface-container-high text-left">
                                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-on-surface-variant">
                                        Nombre
                                      </th>
                                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-on-surface-variant">
                                        Rol
                                      </th>
                                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-on-surface-variant">
                                        Sucursales
                                      </th>
                                      <th className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-on-surface-variant">
                                        Estatus
                                      </th>
                                      <th className="px-4 py-3" />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {loading && (
                                      <tr>
                                        <td colSpan={5} className="px-4 py-10 text-center text-outline">
                                          Cargando...
                                        </td>
                                      </tr>
                                    )}
                                    {!loading && filteredUsers.length === 0 && (
                                      <tr>
                                        <td colSpan={5} className="px-4 py-10 text-center text-outline">
                                          {users.length === 0
                                            ? "Sin usuarios registrados."
                                            : "Ningún usuario coincide con la búsqueda."}
                                        </td>
                                      </tr>
                                    )}
                                    {!loading &&
                                      filteredUsers.map((u) => {
                                        const RoleIcon = ROLE_ICON[u.role];

                                        return (
                                        <tr
                                          key={u.id}
                                          className="border-b border-outline-variant transition last:border-0 hover:bg-surface-container-high/60"
                                        >
                                          <td className="px-4 py-3">
                                            <Link
                                              href={`/administration/personnel/${u.id}`}
                                              className="group flex items-center gap-3"
                                            >
                                              <span
                                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black ring-2 ${ROLE_AVATAR_CLASS[u.role]}`}
                                              >
                                                {getInitials(u.name)}
                                              </span>

                                              <span className="min-w-0">
                                                <span className="block truncate font-semibold text-on-surface group-hover:text-primary">
                                                  {u.name}
                                                </span>
                                                <span className="block truncate text-xs text-on-surface-variant">
                                                  @{u.username}
                                                </span>
                                              </span>
                                            </Link>
                                          </td>

                                          <td className="px-4 py-3">
                                            <span
                                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${ROLE_BADGE_CLASS[u.role]}`}
                                            >
                                              <RoleIcon className="h-3.5 w-3.5" />
                                              {ROLE_LABELS[u.role]}
                                            </span>
                                          </td>

                                          <td className="px-4 py-3">
                                            {u.branches.length > 0 ? (
                                              <div className="flex flex-wrap gap-1.5">
                                                {u.branches.map((b) => (
                                                  <span
                                                    key={b.branch.id}
                                                    className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs text-on-surface-variant"
                                                  >
                                                    {b.branch.name}
                                                  </span>
                                                ))}
                                              </div>
                                            ) : (
                                              <span className="text-outline">—</span>
                                            )}
                                          </td>

                                          <td className="px-4 py-3">
                                            {u.active ? (
                                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-tertiary-fixed-dim">
                                                <span className="h-1.5 w-1.5 rounded-full bg-tertiary-fixed-dim" />
                                                Activo
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-outline">
                                                <span className="h-1.5 w-1.5 rounded-full bg-outline" />
                                                Inactivo
                                              </span>
                                            )}
                                          </td>

                                          <td className="px-4 py-3">
                                            <div className="flex justify-end gap-3">
                                              <button
                                                onClick={() => handleToggleActive(u.id, u.active)}
                                                className="text-xs font-semibold text-on-surface-variant transition hover:text-primary"
                                              >
                                                {u.active ? "Desactivar" : "Activar"}
                                              </button>
                                              <Link
                                                href={`/administration/personnel/${u.id}/permissions`}
                                                className="text-xs font-semibold text-on-surface-variant transition hover:text-primary"
                                              >
                                                Permisos
                                              </Link>
                                            </div>
                                          </td>
                                        </tr>
                                        );
                                      })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </section>
                </>
              ),
            },
            {
              key: "alta",
              label: "Alta de personal",
              icon: <PlusIcon className="h-4 w-4" />,
              content: (
                <>
                            <section className="overflow-hidden rounded-3xl border border-primary/25 bg-surface-container">
                              <div className="border-b border-outline-variant bg-primary/[0.06] p-6 sm:p-8">
                                <p className="font-mono text-xs font-black uppercase tracking-[0.3em] text-on-surface-variant">
                                  Alta de personal
                                </p>

                                <h2 className="mt-2 text-2xl font-bold text-on-surface">
                                  Nuevo usuario
                                </h2>

                                <p className="mt-1 text-sm text-on-surface-variant">
                                  Define su identidad, rol y las sucursales donde puede operar.
                                </p>
                              </div>

                              <div className="space-y-5 p-6 sm:p-8">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <Field label="Nombre completo">
                                    <input
                                      placeholder="Ej. Juana Pérez"
                                      value={name}
                                      onChange={(e) => setName(e.target.value)}
                                      className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                                    />
                                  </Field>

                                  <Field label="Usuario">
                                    <input
                                      placeholder="jperez"
                                      value={username}
                                      onChange={(e) => setUsername(e.target.value)}
                                      className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                                    />
                                  </Field>

                                  <Field label="Email (opcional)">
                                    <input
                                      placeholder="correo@ejemplo.com"
                                      value={email}
                                      onChange={(e) => setEmail(e.target.value)}
                                      className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                                    />
                                  </Field>

                                  <Field label="Teléfono para acceso por SMS">
                                    <input
                                      type="tel"
                                      inputMode="tel"
                                      placeholder="494 123 4567"
                                      value={phone}
                                      onChange={(e) => setPhone(e.target.value)}
                                      className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                                    />
                                  </Field>

                                  <Field label="Contraseña">
                                    <input
                                      type="password"
                                      placeholder="••••••••"
                                      value={password}
                                      onChange={(e) => setPassword(e.target.value)}
                                      className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
                                    />
                                  </Field>
                                </div>

                                <Field label="Rol">
                                  <div className="flex flex-wrap gap-2">
                                    {(Object.keys(ROLE_LABELS) as PersonnelRole[]).map((key) => {
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
                                      {branches.map((b) => (
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

                                {formError && <p className="text-sm text-error">{formError}</p>}

                                <div className="flex flex-wrap gap-3 border-t border-outline-variant pt-5">
                                  <button
                                    onClick={handleCreate}
                                    disabled={submitting}
                                    className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
                                  >
                                    {submitting ? "Creando..." : "Crear usuario"}
                                  </button>

                                </div>
                              </div>
                            </section>
                </>
              ),
            },
          ]}
        />
      </div>
    </main>
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
