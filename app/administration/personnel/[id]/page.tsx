import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getPersonnelById,
  getBranchesForAssignment,
} from "@/app/actions/personnel";
import {
  ROLE_LABELS,
  ROLE_ICON,
  ROLE_BADGE_CLASS,
  ROLE_AVATAR_CLASS,
  getInitials,
  type PersonnelRole,
} from "@/lib/personnelRoles";
import { ChevronLeftIcon, LockIcon, ChevronRightIcon } from "@/components/ui/icons";
import EditPersonnelForm from "./EditPersonnelForm";

export default async function EditPersonnelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, branches] = await Promise.all([
    getPersonnelById(id),
    getBranchesForAssignment(),
  ]);

  if (!user) {
    notFound();
  }

  const role = user.role as PersonnelRole;
  const RoleIcon = ROLE_ICON[role];

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/administration/personnel"
          className="inline-flex w-fit items-center gap-2 text-sm text-on-surface-variant transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] hover:text-on-surface"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Regresar a Personal
        </Link>

        <div className="overflow-hidden rounded-3xl border border-primary/25 bg-surface-container">
          <div className="flex flex-col gap-5 border-b border-outline-variant bg-primary/[0.06] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-center gap-4">
              <span
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black ring-2 ${ROLE_AVATAR_CLASS[role]}`}
              >
                {getInitials(user.name)}
              </span>

              <div>
                <p className="font-mono text-xs font-black uppercase tracking-[0.3em] text-on-surface-variant">
                  Ficha de personal
                </p>

                <h1 className="mt-2 text-3xl font-bold text-on-surface">
                  {user.name}
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${ROLE_BADGE_CLASS[role]}`}
                  >
                    <RoleIcon className="h-3.5 w-3.5" />
                    {ROLE_LABELS[role]}
                  </span>

                  <span className="text-xs text-on-surface-variant">
                    @{user.username}
                  </span>

                  {user.active ? (
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
                </div>
              </div>
            </div>

            <Link
              href={`/administration/personnel/${user.id}/permissions`}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-outline-variant bg-background px-5 py-3 text-sm font-bold text-on-surface transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] hover:border-primary/40 hover:text-primary"
            >
              <LockIcon className="h-4 w-4" />
              Ver permisos
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <EditPersonnelForm
          user={{
            ...user,
            hourlyRate: user.hourlyRate !== null ? Number(user.hourlyRate) : null,
          }}
          allBranches={branches}
        />
      </div>
    </main>
  );
}
