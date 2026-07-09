import { loginAction } from "@/app/actions/login";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <section className="w-full max-w-md rounded-3xl border border-blue-900/50 bg-slate-900/80 p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-yellow-400 text-3xl font-black">🏭 MAESTRO</div>
          <p className="text-blue-300 text-sm mt-1">Destiladora del Norte</p>
        </div>

        <form action={loginAction} className="space-y-5">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Usuario</label>
            <input
              name="username"
              type="text"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white outline-none focus:border-yellow-400"
              placeholder="adan"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Contraseña</label>
            <input
              name="password"
              type="password"
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-white outline-none focus:border-yellow-400"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-yellow-400 text-slate-950 font-bold py-3 hover:bg-yellow-300 transition"
          >
            Ingresar
          </button>
        </form>

        <div className="mt-8 text-center space-y-2">
          <p className="text-lg font-semibold text-white">
            Lo que no se mide, no se puede mejorar.
          </p>
          <p className="text-sm text-blue-300">
            La información de hoy construye el mejor producto de mañana.
          </p>
        </div>
      </section>
    </main>
  );
}