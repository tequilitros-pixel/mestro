const menuItems = [
  { icon: "🏠", label: "Centro de Control" },
  { icon: "📦", label: "Lotes" },
  { icon: "🔥", label: "Cocción" },
  { icon: "⚙️", label: "Molienda" },
  { icon: "🧪", label: "Fermentación" },
  { icon: "🥃", label: "Destilación" },
  { icon: "🧫", label: "Laboratorio" },
  { icon: "📦", label: "Inventario" },
  { icon: "💰", label: "Costos" },
  { icon: "📈", label: "Reportes" },
  { icon: "🛠️", label: "Mantenimiento" },
  { icon: "⚙️", label: "Configuración" },
];

export function Sidebar() {
  return (
    <aside className="min-h-screen w-72 border-r border-slate-800 bg-slate-950 p-5 text-white">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.35em] text-amber-400">
          Destiladora
        </p>
        <h1 className="mt-2 text-2xl font-bold">MAESTRO</h1>
      </div>

      <nav className="space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.label}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-900 hover:text-white"
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}