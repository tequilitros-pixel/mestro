"use client";

import { useMemo, useState } from "react";
import {
  setModulePermissionAction,
  setGroupPermissionAction,
} from "@/app/actions/permissions";
import { PERMISSION_GROUPS } from "@/lib/permission-modules";
import { CrownIcon } from "@/components/ui/icons";

export default function PermissionsForm({
  userId,
  userName,
  userRole,
  initialKeys,
}: {
  userId: string;
  userName: string;
  userRole: string;
  initialKeys: string[];
}) {
  const [granted, setGranted] = useState<Set<string>>(new Set(initialKeys));
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const isAdmin = userRole === "ADMIN";

  const totalModules = useMemo(
    () => PERMISSION_GROUPS.reduce((sum, g) => sum + g.modules.length, 0),
    []
  );

  async function toggleOne(key: string) {
    const willGrant = !granted.has(key);
    setSavingKey(key);

    setGranted((prev) => {
      const next = new Set(prev);
      if (willGrant) next.add(key);
      else next.delete(key);
      return next;
    });

    await setModulePermissionAction(userId, key, willGrant);
    setSavingKey(null);
  }

  async function toggleGroup(keys: string[], willGrant: boolean) {
    setSavingKey(keys[0]);

    setGranted((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (willGrant ? next.add(k) : next.delete(k)));
      return next;
    });

    await setGroupPermissionAction(userId, keys, willGrant);
    setSavingKey(null);
  }

  if (isAdmin) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 p-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tertiary-fixed-dim/15">
          <CrownIcon className="h-6 w-6" />
        </span>
        <p className="text-tertiary-fixed-dim">
          <span className="font-bold">{userName}</span> es Administrador y
          tiene acceso total a todos los módulos automáticamente. No
          necesita permisos individuales.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container px-6 py-4">
        <p className="text-sm text-on-surface-variant">Acceso concedido</p>
        <p className="text-lg font-bold text-on-surface">
          {granted.size}
          <span className="text-on-surface-variant"> / {totalModules}</span>
        </p>
      </div>

      {PERMISSION_GROUPS.map((group) => {
        const groupKeys = group.modules.map((m) => m.key);
        const grantedCount = groupKeys.filter((k) => granted.has(k)).length;
        const allGranted = grantedCount === groupKeys.length;
        const someGranted = grantedCount > 0 && !allGranted;

        return (
          <div
            key={group.group}
            className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container"
          >
            <div className="flex items-center justify-between gap-3 border-b border-outline-variant bg-surface-container-high px-6 py-4">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-on-surface">{group.group}</h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    allGranted
                      ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"
                      : someGranted
                        ? "bg-secondary/15 text-secondary"
                        : "bg-surface-container-highest text-outline"
                  }`}
                >
                  {grantedCount}/{groupKeys.length}
                </span>
              </div>

              <button
                onClick={() => toggleGroup(groupKeys, !allGranted)}
                className="text-xs font-semibold text-on-surface-variant transition hover:text-primary"
              >
                {allGranted ? "Quitar todos" : "Marcar todos"}
              </button>
            </div>

            <div className="grid gap-2 p-4 sm:grid-cols-2">
              {group.modules.map((mod) => {
                const isChecked = granted.has(mod.key);
                const isSaving = savingKey === mod.key;

                return (
                  <button
                    key={mod.key}
                    type="button"
                    disabled={isSaving}
                    onClick={() => toggleOne(mod.key)}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition disabled:opacity-60 ${
                      isChecked
                        ? "border-primary/30 bg-primary/5"
                        : "border-outline-variant bg-background hover:border-outline"
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${
                        isChecked ? "text-on-surface" : "text-on-surface-variant"
                      }`}
                    >
                      {mod.label}
                    </span>

                    <Switch checked={isChecked} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition ${
        checked ? "bg-primary" : "bg-surface-container-highest"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 transform rounded-full shadow transition-transform ${
          checked ? "translate-x-4 bg-on-primary" : "translate-x-0 bg-white"
        }`}
      />
    </span>
  );
}
