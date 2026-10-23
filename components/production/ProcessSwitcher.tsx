import Link from "next/link";

export type ProcessSwitcherItem = {
  id: string;
  label: string;
  detail?: string;
  status: string;
};

export default function ProcessSwitcher({
  title,
  basePath,
  currentId,
  items,
}: {
  title: string;
  basePath: string;
  currentId: string;
  items: ProcessSwitcherItem[];
}) {
  if (items.length < 2) return null;
  return (
    <nav aria-label={title} className="mb-6 rounded-2xl border border-outline-variant bg-surface-container p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">{title}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const current = item.id === currentId;
          return (
            <Link
              key={item.id}
              href={`${basePath}/${item.id}`}
              aria-current={current ? "page" : undefined}
              className={`min-w-40 rounded-xl border px-4 py-3 text-sm transition ${current ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-container-high hover:border-primary"}`}
            >
              <span className="block font-bold">{item.label}</span>
              <span className={`mt-1 block text-xs ${current ? "text-on-primary/80" : "text-on-surface-variant"}`}>
                {[item.detail, item.status].filter(Boolean).join(" · ")}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
