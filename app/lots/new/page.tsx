import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default function NewLotPage() {
  async function createLot(formData: FormData) {
    "use server";

    const code = formData.get("code") as string;
    const agaveKg = Number(formData.get("agaveKg"));
    const artValue = formData.get("art") as string;
    const observations = formData.get("observations") as string;

    const user = await prisma.user.findFirst();

    if (!user) {
      throw new Error("No existe ningún usuario registrado.");
    }

    await prisma.lot.create({
      data: {
        code,
        stage: "RECEPCION",
        agaveKg,
        art: artValue ? Number(artValue) : null,
        startedAt: new Date(),
        observations,
        ownerId: user.id,
      },
    });

    redirect("/lots");
  }

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
          MAESTRO
        </p>

        <h1 className="mt-3 text-4xl font-bold">Nuevo lote</h1>

        <form
          action={createLot}
          className="mt-8 space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-8"
        >
          <div>
            <label className="block text-sm text-slate-400">Código del lote</label>
            <input
              name="code"
              placeholder="AG-2026-002"
              required
              className="mt-2 w-full rounded-xl bg-slate-800 p-3 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400">Kg de agave</label>
            <input
              name="agaveKg"
              type="number"
              required
              className="mt-2 w-full rounded-xl bg-slate-800 p-3 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400">ART</label>
            <input
              name="art"
              type="number"
              step="0.01"
              className="mt-2 w-full rounded-xl bg-slate-800 p-3 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400">Observaciones</label>
            <textarea
              name="observations"
              rows={4}
              className="mt-2 w-full rounded-xl bg-slate-800 p-3 text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 hover:bg-amber-300"
          >
            Crear lote
          </button>
        </form>
      </div>
    </main>
  );
}