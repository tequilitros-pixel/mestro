import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getUserModuleKeys } from "@/app/actions/permissions";
import { ChevronLeftIcon } from "@/components/ui/icons";
import PermissionsForm from "./PermissionsForm";

export default async function UserPermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [user, allUsers, moduleKeys] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        active: true,
        branches: {
          select: {
            branch: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
      },
      orderBy: { name: "asc" },
    }),
    getUserModuleKeys(id),
  ]);

  if (!user) {
    notFound();
  }

  const branchNames = user.branches.map((b) => b.branch.name);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/administration/personnel"
          className="inline-flex w-fit items-center gap-2 text-sm text-on-surface-variant transition duration-150 ease-out hover:scale-[1.02] hover:text-on-surface active:scale-[0.98]"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Regresar al directorio de personal
        </Link>

        <PermissionsForm
          userId={user.id}
          userName={user.name}
          userUsername={user.username}
          userRole={user.role}
          userBranches={branchNames}
          initialKeys={moduleKeys}
          allUsers={allUsers}
        />
      </div>
    </main>
  );
}
