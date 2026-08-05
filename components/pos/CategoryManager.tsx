"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createCategoryAction,
  updateCategoryAction,
  toggleCategoryActiveAction,
  deleteCategoryAction,
  moveProductToCategoryAction,
} from "@/app/pos/categories/actions";
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";
import { getProductVisual } from "@/lib/pos/productVisual";

type ProductRow = {
  id: string;
  name: string;
  active: boolean;
  icon: string | null;
  variants: { name: string; price: number }[];
};

type CategoryRow = {
  id: string;
  name: string;
  active: boolean;
  products: ProductRow[];
};

function formatVariants(variants: { name: string; price: number }[]) {
  if (variants.length === 1) return `$${variants[0].price.toFixed(2)}`;
  return variants.map((v) => `${v.name} $${v.price.toFixed(2)}`).join(", ");
}

export default function CategoryManager({
  categories,
}: {
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addSelection, setAddSelection] = useState<Record<string, string>>({});

  const allProducts = categories.flatMap((c) =>
    c.products.map((p) => ({ ...p, categoryId: c.id, categoryName: c.name })),
  );

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);

    const formData = new FormData();
    formData.set("name", name.trim());

    startTransition(async () => {
      const result = await createCategoryAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setName("");
      router.refresh();
    });
  }

  async function handleToggle(id: string, active: boolean) {
    setBusyId(id);
    await toggleCategoryActiveAction(id, active);
    setBusyId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    setBusyId(id);
    const result = await deleteCategoryAction(id);
    setBusyId(null);
    if (!result.success) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  function startEditing(cat: CategoryRow) {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  async function saveEditing(id: string) {
    if (!editName.trim()) return;
    setBusyId(id);

    const formData = new FormData();
    formData.set("name", editName.trim());
    const result = await updateCategoryAction(id, formData);

    setBusyId(null);
    if (!result.success) {
      alert(result.error);
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function handleMoveProduct(productId: string, categoryId: string) {
    setBusyId(productId);
    const result = await moveProductToCategoryAction(productId, categoryId);
    setBusyId(null);
    if (!result.success) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la categoría (p. ej. Cocteles)"
          className="flex-1 rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        />
        <button
          disabled={pending || !name.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition duration-150 ease-out hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon className="h-4 w-4" />
          Agregar
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {categories.length === 0 && (
          <p className="rounded-2xl border border-outline-variant bg-surface-container p-6 text-sm text-on-surface-variant">
            Aún no hay categorías.
          </p>
        )}

        {categories.map((cat) => {
          const isExpanded = expandedId === cat.id;
          const isEditing = editingId === cat.id;
          const otherProducts = allProducts.filter((p) => p.categoryId !== cat.id);
          const selectedToAdd = addSelection[cat.id] ?? "";

          return (
            <div
              key={cat.id}
              className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container"
            >
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : cat.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ChevronRightIcon
                    className={`h-3.5 w-3.5 shrink-0 text-on-surface-variant transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                  <p
                    className={`truncate text-sm font-semibold ${
                      cat.active ? "text-on-surface" : "text-outline"
                    }`}
                  >
                    {cat.name}
                  </p>
                  <span className="shrink-0 text-xs text-on-surface-variant">
                    {cat.products.length} producto{cat.products.length === 1 ? "" : "s"}
                  </span>
                </div>

                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(cat.id, !cat.active);
                  }}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    cat.active
                      ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"
                      : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {cat.active ? "Activa" : "Inactiva"}
                </span>
              </button>

              {isExpanded && (
                <div className="space-y-4 border-t border-outline-variant p-4">
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 rounded-xl border border-outline-variant bg-surface-container-high px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                        />
                        <button
                          disabled={busyId === cat.id}
                          onClick={() => saveEditing(cat.id)}
                          className="rounded-lg p-2 text-tertiary-fixed-dim transition hover:bg-tertiary-fixed-dim/10"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg p-2 text-on-surface-variant transition hover:bg-surface-container-high"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEditing(cat)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant transition hover:text-on-surface"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          Renombrar
                        </button>
                        {cat.products.length === 0 && (
                          <button
                            disabled={busyId === cat.id}
                            onClick={() => handleDelete(cat.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant transition hover:text-error"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                            Eliminar categoría
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    {cat.products.length === 0 && (
                      <p className="text-sm text-on-surface-variant">
                        Sin productos en esta categoría todavía.
                      </p>
                    )}

                    {cat.products.map((product) => {
                      const visual = getProductVisual(product.icon);
                      return (
                        <div
                          key={product.id}
                          className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-high/60 p-3"
                        >
                          {visual.type === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={visual.url}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white/90"
                              style={{ backgroundColor: visual.hex }}
                            >
                              {product.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}

                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/pos/products/${product.id}`}
                              className={`block truncate text-sm font-semibold hover:underline ${
                                product.active ? "text-on-surface" : "text-outline"
                              }`}
                            >
                              {product.name}
                            </Link>
                            <p className="truncate text-xs text-on-surface-variant">
                              {formatVariants(product.variants)}
                            </p>
                          </div>

                          <select
                            disabled={busyId === product.id}
                            value={cat.id}
                            onChange={(e) => handleMoveProduct(product.id, e.target.value)}
                            className="shrink-0 rounded-lg border border-outline-variant bg-surface-container px-2 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.id === cat.id ? "En esta categoría" : `Mover a: ${c.name}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  {otherProducts.length > 0 && (
                    <div className="flex items-center gap-2 border-t border-outline-variant pt-3">
                      <select
                        value={selectedToAdd}
                        onChange={(e) =>
                          setAddSelection((prev) => ({ ...prev, [cat.id]: e.target.value }))
                        }
                        className="flex-1 rounded-xl border border-outline-variant bg-surface-container-high px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                      >
                        <option value="">Agregar un producto existente...</option>
                        {otherProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (en {p.categoryName})
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!selectedToAdd || busyId === selectedToAdd}
                        onClick={() => {
                          handleMoveProduct(selectedToAdd, cat.id);
                          setAddSelection((prev) => ({ ...prev, [cat.id]: "" }));
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant transition hover:border-primary hover:text-on-surface disabled:opacity-40"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Agregar
                      </button>
                    </div>
                  )}

                  <Link
                    href={`/pos/products/new`}
                    className="block text-center text-xs font-semibold text-primary hover:underline"
                  >
                    + Crear un producto nuevo
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
