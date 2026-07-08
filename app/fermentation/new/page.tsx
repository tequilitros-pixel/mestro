import { prisma } from "@/lib/prisma";
import MainNav from "@/components/MainNav";
import { redirect } from "next/navigation";

export default async function NewFermentationPage() {
  const lots = await prisma.lot.findMany({
    orderBy: { createdAt: "desc" },
  });

  async function createFermentation(formData: FormData) {
    "use server";

    const lotId = formData.get("lotId") as string;
    const tank = formData.get("tank") as string;
    const mustLiters = Number(formData.get("mustLiters"));
    const initialBrix = Number(formData.get("initialBrix"));
    const initialPh = Number(formData.get("initialPh"));
    const initialTemperature = Number(formData.get("initialTemperature"));
    const yeast = formData.get("yeast") as string;

    await prisma.fermentation.create({
      data: {
        lotId,
        tank,
        mustLiters,
        initialBrix,
        initialPh,
        initialTemperature,
        yeast: yeast || null,
        inoculatedAt: new Date(),
      },
    });

    redirect("/fermentation");
  }

  return (
    <main className="min-h-screen bg-slate-950 p-10 text-white">
      <div className="mx-auto max-w-4xl">
        <MainNav />

        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
          MAESTRO
        </p>

        <h1 className="mt-3 text-4xl font-bold">Nueva fermentación</h1>

        <form
          action={createFermentation}
          className="mt-8 grid gap-5 rounded-2xl bg-slate-900 p-8"
        >
          <select name="lotId" required className="rounded-xl bg-slate-800 p-3">
            <option value="">Selecciona un lote</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.code}
              </option>
            ))}
          </select>

          <input
            name="tank"
            placeholder="Tina / Tanque"
            required
            className="rounded-xl bg-slate-800 p-3"
          />

          <input
            name="mustLiters"
            type="number"
            step="0.01"
            placeholder="Litros de mosto"
            required
            className="rounded-xl bg-slate-800 p-3"
          />

          <input
            name="initialBrix"
            type="number"
            step="0.01"
            placeholder="°Brix inicial"
            required
            className="rounded-xl bg-slate-800 p-3"
          />

          <input
            name="initialPh"
            type="number"
            step="0.01"
            placeholder="pH inicial"
            required
            className="rounded-xl bg-slate-800 p-3"
          />

          <input
            name="initialTemperature"
            type="number"
            step="0.01"
            placeholder="Temperatura inicial °C"
            required
            className="rounded-xl bg-slate-800 p-3"
          />

          <input
            name="yeast"
            placeholder="Levadura utilizada"
            className="rounded-xl bg-slate-800 p-3"
          />

          <button className="rounded-xl bg-amber-400 px-6 py-3 font-bold text-black">
            Crear fermentación
          </button>
        </form>
      </div>
    </main>
  );
}