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
    <main className="mx-auto max-w-md space-y-8 p-6 text-white">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
          MAESTRO
        </p>
        <h1 className="mt-2 text-3xl font-bold">Mi perfil</h1>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-lg font-semibold">{user.name}</p>
        <p className="text-sm text-slate-400">
          {user.role === "ADMIN" ? "Administrador" : "Operador"}
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 text-xl font-semibold">Cambiar contraseña</h2>

        {success && (
          <p className="mb-4 rounded-xl bg-green-500/20 px-4 py-3 text-sm text-green-400">
            Contraseña actualizada correctamente.
          </p>
        )}

        {errorMessage && (
          <p className="mb-4 rounded-xl bg-red-500/20 px-4 py-3 text-sm text-red-400">
            {errorMessage}
          </p>
        )}

        <form action={changePasswordAction} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Contraseña actual
            </label>
            <input
              name="currentPassword"
              type="password"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Nueva contraseña
            </label>
            <input
              name="newPassword"
              type="password"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Confirmar nueva contraseña
            </label>
            <input
              name="confirmPassword"
              type="password"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-amber-400 text-slate-950 font-bold py-3 hover:bg-amber-300 transition"
          >
            Actualizar contraseña
          </button>
        </form>
      </section>
    </main>
  );
}
