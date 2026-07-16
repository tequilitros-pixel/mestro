import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function LiquorsPage() {
  const products = await prisma.liquorProduct.findMany({
    where: {
      active: true,
    },
    include: {
      _count: {
        select: {
          batches: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <section className="mx-auto max-w-7xl">

      <header className="mb-10">
        <p className="text-sm uppercase tracking-[0.35em] text-purple-400">
          MAESTRO
        </p>

        <h1 className="mt-2 text-4xl font-black text-white">
          🍹 Elaboración de Licores
        </h1>

        <p className="mt-4 max-w-3xl text-slate-400 text-lg">
          Selecciona el producto que deseas elaborar.
          MAESTRO calculará automáticamente la receta,
          generará el lote y te guiará paso a paso durante
          toda la producción.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">

        {products.map((product) => (

          <Link
            key={product.id}
            href={`/liquors/products/${product.slug}`}
            className="group rounded-3xl border border-slate-800 bg-slate-900 p-7 transition hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/10"
          >
            <div className="text-5xl">
              {product.icon}
            </div>

            <h2 className="mt-5 text-2xl font-bold">
              {product.name}
            </h2>

            <p className="mt-3 text-slate-400">
              {product.description}
            </p>

            <div className="mt-8 flex items-center justify-between">

              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Lotes
                </p>

                <p className="text-3xl font-black text-purple-300">
                  {product._count.batches}
                </p>
              </div>

              <div className="rounded-2xl bg-purple-500 px-5 py-3 font-bold text-white transition group-hover:bg-purple-400">
                Elaborar →
              </div>

            </div>

          </Link>

        ))}

      </div>

    </section>
  );
}