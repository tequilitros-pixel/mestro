"use client";

import Link from "next/link";
import { logoutAction } from "@/app/actions/login";
import { formatRole } from "@/components/layout/navigation";
import { StillIcon, LogoutIcon } from "@/components/ui/icons";

type AppHeaderUser = {
  name: string;
  role: string;
};

export default function AppHeader({
  user,
}: {
  user: AppHeaderUser;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <Link href="/" className="group min-w-0">
        <div className="flex items-center gap-3 transition duration-150 ease-out group-hover:scale-[1.02]">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.06] text-primary transition duration-150 ease-out group-hover:border-primary/30 group-hover:bg-primary/10">
            <StillIcon className="h-6 w-6" />
          </div>

          <div className="min-w-0">
            <p className="text-xl font-black tracking-wide text-primary">
              Destiladora del Norte
            </p>

            <p className="hidden truncate text-xs text-on-surface-variant sm:block">
              Sistema Operativo de Destiladora del Norte
            </p>
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-2 sm:gap-4">
        <Link
          href="/profile"
          className="hidden rounded-xl px-3 py-2 text-right transition hover:bg-surface-container sm:block"
        >
          <p className="max-w-40 truncate text-sm font-semibold text-on-surface">
            {user.name}
          </p>

          <p className="text-xs text-on-surface-variant">
            {formatRole(user.role)}
          </p>
        </Link>

        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] hover:border-outline hover:bg-surface-container-high hover:text-on-surface"
          >
            <LogoutIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </form>
      </div>
    </div>
  );
}