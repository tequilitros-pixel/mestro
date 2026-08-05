import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import LotMenu from "@/components/LotMenu";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LotCostsPage({ params }: Props) {
  const { id } = await params;

  const lot = await prisma.lot.findUnique({
    where: { id },
    include: {
      expenses: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!lot) notFound();

  const totalCost = lot.expenses.reduce((sum, e) => sum + e.amount, 0);

  // Igual que en el Centro de Costos: usamos el total autoritativo
  // fijado en "Finalizar lote", no la suma de lecturas intermedias
  // de litros registradas durante la destilación.
  const totalLiters = lot.totalLitersObtained ?? 0;
  const isFinished = lot.totalLitersObtained !== null;

  const costPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;

  async function addExpense(formData: FormData) {
    "use server";

    const category = formData.get("category") as string;
    const concept = formData.get("concept") as string;
    const amount = Number(formData.get("amount") || 0);
    const notes = formData.get("notes") as string;

    await prisma.lotExpense.create({
      data: {
        lotId: id,
        category,
        concept,
        amount,
        notes: notes || null,
      },
    });

    redirect(`/lots/${id}/costs`);
  }

  return (
    <main className="min-h-screen bg-background p-10 text-on-surface">
      <div className="mx-auto max-w-6xl">
        
        <p className="font-mono text-sm uppercase tracking-[0.4em] text-on-surface-variant">
          MAESTRO
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Costos del lote {lot.code}
        </h1>
        <LotMenu id={lot.id} />

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Card title="Costo total" value={`$${totalCost.toLocaleString()}`} />
          <Card
            title="Litros obtenidos"
            value={
              isFinished ? `${totalLiters.toFixed(2)} L` : "Pendiente"
            }
          />
          <Card
            title="Costo por litro"
            value={costPerLiter > 0 ? `$${costPerLiter.toFixed(2)}` : "-"}
          />
        </section>

        <section className="mt-8 rounded-2xl bg-surface-container p-8">
          <h2 className="mb-6 text-2xl font-bold">Agregar gasto</h2>

          <form action={addExpense} className="grid gap-3 md:grid-cols-2">
            <select name="category" className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary">
              <option>Materia prima</option>
              <option>Cocción</option>
              <option>Molienda</option>
              <option>Fermentación</option>
              <option>Destilación</option>
              <option>Envasado</option>
              <option>Transporte</option>
              <option>Mano de obra</option>
              <option>Otros</option>
            </select>

            <input
              name="concept"
              placeholder="Concepto"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              required
            />

            <input
              name="amount"
              type="number"
              step="0.01"
              placeholder="Monto $"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              required
            />

            <input
              name="notes"
              placeholder="Observaciones"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
            />

            <button className="rounded-xl bg-primary py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97] md:col-span-2">
              Guardar gasto
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-2xl bg-surface-container p-8">
          <h2 className="mb-6 text-2xl font-bold">Gastos registrados</h2>

          <div className="space-y-3">
            {lot.expenses.map((expense) => (
              <div
                key={expense.id}
                className="grid gap-2 rounded-xl bg-surface-container-high p-4 md:grid-cols-4"
              >
                <p>{expense.category}</p>
                <p>{expense.concept}</p>
                <p className="font-bold text-primary">
                  ${expense.amount.toLocaleString()}
                </p>
                <p className="text-on-surface-variant">{expense.notes ?? "-"}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-container p-6">
      <p className="text-sm text-on-surface-variant">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}