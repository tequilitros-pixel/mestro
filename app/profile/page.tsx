import { getCurrentUser } from "@/lib/auth";
import { changePasswordAction } from "@/app/actions/changePassword";
import { redirect } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  campos: "Completa todos los campos.",
  actual: "La contraseña actual no es correcta.",
  confirmacion: "La nueva contraseña y la confirmación no coinciden.",
  corta: "La nueva contraseña debe tener al menos 6 caracteres.",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] : null;
  const success = params.success === "1";

  return (
    <main className="mx-auto max-w-md space-y-8 p-6 text-on-surface">
      <div>
        <p className="font-mono text-sm uppercase tracking-[0.3em] text-on-surface-variant">
          MAESTRO
        </p>
        <h1 className="mt-2 text-3xl font-bold text-primary">Mi perfil</h1>
      </div>

      <section className="rounded-xl border border-outline-variant bg-surface-container p-6">
        <p className="text-lg font-semibold text-primary">{user.name}</p>
        <p className="text-sm text-on-surface-variant">
          {user.role === "ADMIN" ? "Administrador" : "Operador"}
        </p>
      </section>

      <section className="rounded-xl border border-outline-variant bg-surface-container p-6">
        <h2 className="mb-4 text-xl font-semibold text-primary">Cambiar contraseña</h2>

        {success && (
          <p className="mb-4 rounded-xl bg-tertiary-fixed-dim/20 px-4 py-3 text-sm text-tertiary-fixed-dim">
            Contraseña actualizada correctamente.
          </p>
        )}

        {errorMessage && (
          <p className="mb-4 rounded-xl bg-error/20 px-4 py-3 text-sm text-error">
            {errorMessage}
          </p>
        )}

        <form action={changePasswordAction} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
              Contraseña actual
            </label>
            <input
              name="currentPassword"
              type="password"
              className="w-full rounded-xl border border-outline-variant bg-surface-dim px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
              Nueva contraseña
            </label>
            <input
              name="newPassword"
              type="password"
              className="w-full rounded-xl border border-outline-variant bg-surface-dim px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-on-surface-variant">
              Confirmar nueva contraseña
            </label>
            <input
              name="confirmPassword"
              type="password"
              className="w-full rounded-xl border border-outline-variant bg-surface-dim px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-primary text-on-primary font-bold py-3 transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            Actualizar contraseña
          </button>
        </form>
      </section>
    </main>
  );
}
