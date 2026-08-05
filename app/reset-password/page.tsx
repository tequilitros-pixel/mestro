import { resetPasswordAction } from "@/app/actions/reset-password";
import AgaveBackdrop from "@/components/ui/AgaveBackdrop";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{
    email?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const email = params?.email ?? "";
  const hasError = params?.error === "1";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 text-on-surface sm:px-6">
      <div className="absolute inset-0 -z-10 bg-surface">
        <AgaveBackdrop className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-dim/80 via-surface-dim/70 to-surface-dim/90" />
      </div>

      <section className="w-full max-w-md overflow-hidden rounded-xl border border-outline-variant bg-surface-dim/50 shadow-2xl backdrop-blur-xl">
        <div className="p-6 text-center sm:p-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.45em] text-on-surface-variant">
            Destiladora del Norte
          </p>

          <h1 className="mt-4 text-2xl font-black text-primary">
            Ingresa tu código
          </h1>

          <p className="mt-3 text-sm text-on-surface-variant">
            Te enviamos un código de 6 dígitos a{" "}
            <span className="text-primary">
              {email || "tu correo"}
            </span>
            . Expira en 15 minutos.
          </p>

          {hasError && (
            <div className="mt-5 rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">
              Código inválido, expirado, o las contraseñas no
              coinciden.
            </div>
          )}

          <form
            action={resetPasswordAction}
            className="mt-8 space-y-5 text-left"
          >
            <input type="hidden" name="email" value={email} />

            <div>
              <label
                htmlFor="code"
                className="mb-2 block text-sm font-semibold text-on-surface-variant"
              >
                Código
              </label>

              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="123456"
                className="w-full rounded-xl border border-outline-variant bg-surface-dim/60 px-4 py-3 text-center text-2xl tracking-[0.5em] text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-on-surface-variant"
              >
                Nueva contraseña
              </label>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-xl border border-outline-variant bg-surface-dim/60 px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-semibold text-on-surface-variant"
              >
                Confirma la contraseña
              </label>

              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Repite la contraseña"
                className="w-full rounded-xl border border-outline-variant bg-surface-dim/60 px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-primary py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
            >
              Cambiar contraseña
            </button>
          </form>

          <a
            href="/forgot-password"
            className="mt-6 inline-block text-sm text-on-surface-variant transition hover:text-primary"
          >
            ¿No te llegó el código? Reenviar
          </a>
        </div>
      </section>
    </main>
  );
}
