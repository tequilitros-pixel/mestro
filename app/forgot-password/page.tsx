import { forgotPasswordAction } from "@/app/actions/forgot-password";
import AgaveBackdrop from "@/components/ui/AgaveBackdrop";
import { ChevronLeftIcon } from "@/components/ui/icons";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string;
  }>;
}) {
  const params = await searchParams;
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
            Recupera tu contraseña
          </h1>

          <p className="mt-3 text-sm text-on-surface-variant">
            Escribe tu correo y te enviaremos un código para
            restablecerla.
          </p>

          {hasError && (
            <div className="mt-5 rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">
              Escribe un correo válido.
            </div>
          )}

          <form
            action={forgotPasswordAction}
            className="mt-8 space-y-5 text-left"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-on-surface-variant"
              >
                Correo electrónico
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="tu@correo.com"
                className="w-full rounded-xl border border-outline-variant bg-surface-dim/60 px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-primary py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
            >
              Enviar código
            </button>
          </form>

          <a
            href="/login"
            className="mt-6 inline-flex items-center gap-1 text-sm text-on-surface-variant transition hover:text-primary"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Volver a iniciar sesión
          </a>
        </div>
      </section>
    </main>
  );
}
