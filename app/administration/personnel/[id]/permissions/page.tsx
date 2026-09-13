import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUserModuleKeys } from "@/app/actions/permissions";
import { ChevronLeftIcon } from "@/components/ui/icons";
import PermissionsForm from "./PermissionsForm";

export default async function UserPermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true },
  });

  if (!user) {
    notFound();
  }

  const moduleKeys = await getUserModuleKeys(id);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/administration/personnel"
          className="inline-flex w-fit items-center gap-2 text-sm text-on-surface-variant transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] hover:text-on-surface"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Regresar a Personal
        </Link>

        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.35em] text-on-surface-variant">
            Control de acceso
          </p>

          <h1 className="mt-2 text-3xl font-bold">Permisos de {user.name}</h1>

          <p className="mt-2 text-on-surface-variant">
            Marca a qué módulos tiene acceso este usuario.
          </p>
        </div>

        <PermissionsForm
          userId={user.id}
          userName={user.name}
          userRole={user.role}
          initialKeys={moduleKeys}
        />
      </div>
    </main>
  );
}
