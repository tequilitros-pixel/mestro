"use client";

import Link from "next/link";
import { logoutAction } from "@/app/actions/login";
import PushNotificationSetup from "@/components/PushNotificationSetup";
import { formatRole } from "@/components/layout/navigation";

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
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-xl">
            🤖
          </div>

          <div className="min-w-0">
            <p className="text-xl font-black tracking-wide text-amber-400 transition group-hover:text-amber-300">
              MAESTRO
            </p>

            <p className="hidden truncate text-xs text-slate-400 sm:block">
              Sistema Inteligente de Destiladora del Norte
            </p>
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-400 lg:block">
          ● Sistema activo
        </div>

        <PushNotificationSetup />

        <Link
          href="/profile"
          className="hidden rounded-xl px-3 py-2 text-right transition hover:bg-slate-900 sm:block"
        >
          <p className="max-w-40 truncate text-sm font-semibold text-white">
            {user.name}
          </p>

          <p className="text-xs text-slate-400">
            {formatRole(user.role)}
          </p>
        </Link>

        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
          >
            Salir
          </button>
        </form>
      </div>
    </div>
  );
}