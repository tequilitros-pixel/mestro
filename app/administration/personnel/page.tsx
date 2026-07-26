"use client";

import { useEffect, useState, startTransition } from "react";
import {
  getPersonnel,
  getBranchesForAssignment,
  createPersonnel,
  updatePersonnelActive,
} from "@/app/actions/personnel";

type UserRole = "ADMIN" | "OPERATOR" | "GERENTE" | "ENCARGADO" | "CONSULTA";

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  OPERATOR: "Operador",
  GERENTE: "Gerente",
  ENCARGADO: "Encargado",
  CONSULTA: "Consulta",
};

const ROLES_CON_SUCURSAL: UserRole[] = ["GERENTE", "ENCARGADO"];

interface Branch {
  id: string;
  name: string;
}

interface PersonnelUser {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: UserRole;
  active: boolean;
  branches: { branch: Branch }[];
}

export default function PersonnelPage() {
  const [users, setUsers] = useState<PersonnelUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("ENCARGADO");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setPassword("");
    setRole("ENCARGADO");
    setBranchIds([]);
    await loadAll();
  }

  async function handleToggleActive(userId: string, active: boolean) {
    await updatePersonnelActive(userId, !active);
    await loadAll();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Personal</h1>
        <p className="text-sm text-gray-500">
          Crea usuarios y asígnales rol y sucursales.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-md p-3 border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-600">Nuevo usuario</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            placeholder="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="Email (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="border rounded-md px-3 py-2 text-sm"
          >
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {ROLES_CON_SUCURSAL.includes(role) && (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">
              Sucursales asignadas
            </div>
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => (
                <label
                  key={b.id}
                  className="flex items-center gap-1 border rounded-md px-2 py-1 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={branchIds.includes(b.id)}
                    onChange={() => toggleBranch(b.id)}
                  />
                  {b.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {formError && <p className="text-red-600 text-sm">{formError}</p>}

        <button
          onClick={handleCreate}
          disabled={submitting}
          className="bg-yellow-400 text-slate-900 font-semibold rounded-lg px-4 py-2 text-sm"
        >
          {submitting ? "Creando..." : "Crear usuario"}
        </button>
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy-900 text-white text-left">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Sucursales</th>
              <th className="px-4 py-3">Estatus</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  Sin usuarios registrados.
                </td>
              </tr>
            )}
            {!loading &&
              users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3">{u.username}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[u.role]}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {u.branches.length > 0
                      ? u.branches.map((b) => b.branch.name).join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <span className="text-green-700 font-medium">Activo</span>
                    ) : (
                      <span className="text-gray-400">Inactivo</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(u.id, u.active)}
                      className="text-xs text-navy-900 underline"
                    >
                      {u.active ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
