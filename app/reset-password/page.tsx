import Image from "next/image";
import { resetPasswordAction } from "@/app/actions/reset-password";

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
            Ingresa tu código
          </h1>

          <p className="mt-3 text-sm text-slate-300">
            Te enviamos un código de 6 dígitos a{" "}
            <span className="text-amber-400">
              {email || "tu correo"}
            </span>
            . Expira en 15 minutos.
          </p>

          {hasError && (
            <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
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
                className="mb-2 block text-sm font-medium text-slate-300"
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
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-center text-2xl tracking-[0.5em] text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-300"
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
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-medium text-slate-300"
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
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-amber-400 py-3 font-bold text-slate-950 transition hover:bg-amber-300"
            >
              Cambiar contraseña
            </button>
          </form>

          <a
            href="/forgot-password"
            className="mt-6 inline-block text-sm text-slate-400 transition hover:text-amber-400"
          >
            ¿No te llegó el código? Reenviar
          </a>
        </div>
      </section>
    </main>
  );
}
