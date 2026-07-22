import Image from "next/image";
import { forgotPasswordAction } from "@/app/actions/forgot-password";

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 text-white sm:px-6">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/agave-field.jpg"
          alt="Campo de agave, Destiladora del Norte"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/70 to-slate-950/90" />
      </div>

      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-950/50 shadow-2xl backdrop-blur-xl">
        <div className="p-6 text-center sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-amber-400">
            MAESTRO
          </p>

          <h1 className="mt-4 text-2xl font-black text-white">
            Recupera tu contraseña
          </h1>

          <p className="mt-3 text-sm text-slate-300">
            Escribe tu correo y te enviaremos un código para
            restablecerla.
          </p>

          {hasError && (
            <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
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
                className="mb-2 block text-sm font-medium text-slate-300"
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
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-amber-400 py-3 font-bold text-slate-950 transition hover:bg-amber-300"
            >
              Enviar código
            </button>
          </form>

          <a
            href="/login"
            className="mt-6 inline-block text-sm text-slate-400 transition hover:text-amber-400"
          >
            ← Volver a iniciar sesión
          </a>
        </div>
      </section>
    </main>
  );
}
