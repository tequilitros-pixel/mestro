import Link from "next/link";

export default function LotMenu({ id }: { id: string }) {
  const items = [
    {
      href: `/lots/${id}`,
      label: "📋 Resumen",
    },
    {
      href: `/cooking/${id}`,
      label: "🔥 Cocción",
    },
    {
      href: `/milling/${id}`,
      label: "⚙️ Molienda",
    },
    {
      href: `/fermentation/${id}`,
      label: "🧪 Fermentación",
    },
    {
      href: `/distillation`,
      label: "🥃 Destilación",
    },
    {
      href: `/lots/${id}/costs`,
      label: "💰 Costos",
    },
    {
      href: `/lots/${id}/stats`,
      label: "📊 Estadísticas",
    },
    {
      href: `/lots/${id}/report`,
      label: "📄 Reporte",
    },
  ];

  return (
    <div className="mb-8 flex flex-wrap gap-3">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-xl bg-slate-800 px-4 py-2 hover:bg-amber-500 hover:text-black transition"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}