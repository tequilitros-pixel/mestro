"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
} from "@/app/pos/products/actions";
import { PlusIcon, TrashIcon, UploadIcon, CheckIcon } from "@/components/ui/icons";
import { PRODUCT_COLORS, getProductVisual } from "@/lib/pos/productVisual";

type InventoryProductOption = {
  id: string;
  code: string;
  name: string;
  unit: string;
};

type CategoryOption = { id: string; name: string };

type IngredientRow = {
  key: string;
  inventoryProductId: string;
  quantity: string;
};

type VariantRow = {
  key: string;
  name: string;
  price: string;
  employeePrice: string;
  ingredients: IngredientRow[];
};

type InitialProduct = {
  id: string;
  categoryId: string;
  name: string;
  icon: string | null;
  variants: {
    id: string;
    name: string;
    price: number;
    employeePrice: number | null;
    ingredients: { inventoryProductId: string; quantity: number }[];
  }[];
};

let counter = 0;
function nextKey() {
  counter += 1;
  return `row-${counter}`;
}

function emptyVariant(): VariantRow {
  return { key: nextKey(), name: "Único", price: "0", employeePrice: "", ingredients: [] };
}

export default function ProductForm({
  categories,
  inventoryProducts,
  initialProduct,
}: {
  categories: CategoryOption[];
  inventoryProducts: InventoryProductOption[];
  initialProduct?: InitialProduct;
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(
    initialProduct?.categoryId ?? categories[0]?.id ?? "",
  );
  const [name, setName] = useState(initialProduct?.name ?? "");
  const [icon, setIcon] = useState(initialProduct?.icon ?? "");
  const [variants, setVariants] = useState<VariantRow[]>(
    initialProduct
      ? initialProduct.variants.map((v) => ({
          key: nextKey(),
          name: v.name,
          price: String(v.price),
          employeePrice: v.employeePrice === null ? "" : String(v.employeePrice),
          ingredients: v.ingredients.map((i) => ({
            key: nextKey(),
            inventoryProductId: i.inventoryProductId,
            quantity: String(i.quantity),
          })),
        }))
      : [emptyVariant()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const visual = getProductVisual(icon);

  async function handleImageSelected(file: File) {
    setUploadError(null);
    setUploading(true);

    const formData = new FormData();
    formData.set("file", file);

    try {
      const res = await fetch("/api/pos/products/upload-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error ?? "No fue posible subir la imagen.");
        return;
      }

      setIcon(data.url);
    } catch {
      setUploadError("No fue posible subir la imagen. Revisa tu conexión.");
    } finally {
      setUploading(false);
    }
  }

  function updateVariant(key: string, patch: Partial<VariantRow>) {
    setVariants((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  }

  function addVariant() {
    setVariants((prev) => [...prev, emptyVariant()]);
  }

  function removeVariant(key: string) {
    setVariants((prev) => prev.filter((v) => v.key !== key));
  }

  function addIngredient(variantKey: string) {
    setVariants((prev) =>
      prev.map((v) =>
        v.key === variantKey
          ? {
              ...v,
              ingredients: [
                ...v.ingredients,
                {
                  key: nextKey(),
                  inventoryProductId: inventoryProducts[0]?.id ?? "",
                  quantity: "1",
                },
              ],
            }
          : v,
      ),
    );
  }

  function updateIngredient(
    variantKey: string,
    ingredientKey: string,
    patch: Partial<IngredientRow>,
  ) {
    setVariants((prev) =>
      prev.map((v) =>
        v.key === variantKey
          ? {
              ...v,
              ingredients: v.ingredients.map((i) =>
                i.key === ingredientKey ? { ...i, ...patch } : i,
              ),
            }
          : v,
      ),
    );
  }

  function removeIngredient(variantKey: string, ingredientKey: string) {
    setVariants((prev) =>
      prev.map((v) =>
        v.key === variantKey
          ? { ...v, ingredients: v.ingredients.filter((i) => i.key !== ingredientKey) }
          : v,
      ),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!categoryId) {
      setError("Selecciona una categoría.");
      return;
    }
    if (!name.trim()) {
      setError("El nombre del producto es obligatorio.");
      return;
    }

    const payload = variants.map((v) => ({
      name: v.name.trim(),
      price: Number(v.price),
      employeePrice: v.employeePrice.trim() === "" ? null : Number(v.employeePrice),
      ingredients: v.ingredients
        .filter((i) => i.inventoryProductId)
        .map((i) => ({ inventoryProductId: i.inventoryProductId, quantity: Number(i.quantity) })),
    }));

    const formData = new FormData();
    formData.set("categoryId", categoryId);
    formData.set("name", name.trim());
    formData.set("icon", icon.trim());
    formData.set("variants", JSON.stringify(payload));

    startTransition(async () => {
      const result = initialProduct
        ? await updateProductAction(initialProduct.id, formData)
        : await createProductAction(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push("/pos/products");
      router.refresh();
    });
  }

  async function handleDelete() {
    if (!initialProduct) return;
    if (!confirm("¿Eliminar este producto?")) return;

    const result = await deleteProductAction(initialProduct.id);
    if (!result.success) {
      alert(result.error);
      return;
    }
    router.push("/pos/products");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
            Categoría
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
            Nombre del producto
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="p. ej. Vampiro"
            className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
          Imagen o color del producto
        </label>

        <div className="flex items-start gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-outline-variant"
            style={visual.type === "color" ? { backgroundColor: visual.hex } : undefined}
          >
            {visual.type === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={visual.url} alt="" className="h-full w-full object-cover" />
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageSelected(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant transition hover:border-primary hover:text-on-surface disabled:opacity-40"
              >
                <UploadIcon className="h-3.5 w-3.5" />
                {uploading ? "Subiendo..." : "Subir imagen"}
              </button>

              {visual.type === "image" && (
                <button
                  type="button"
                  onClick={() => setIcon("")}
                  className="text-xs font-semibold text-on-surface-variant hover:text-error"
                >
                  Quitar imagen
                </button>
              )}
            </div>

            {uploadError && <p className="text-xs text-error">{uploadError}</p>}

            <div>
              <p className="mb-1.5 text-xs text-on-surface-variant">
                O elige un color por defecto:
              </p>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setIcon(color)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-outline-variant transition hover:scale-110"
                    style={{ backgroundColor: color }}
                  >
                    {visual.type === "color" && visual.hex === color && (
                      <CheckIcon className="h-3.5 w-3.5 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant">
            Variantes
          </h2>
          <button
            type="button"
            onClick={addVariant}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Agregar variante
          </button>
        </div>

        {variants.map((variant) => (
          <div
            key={variant.key}
            className="space-y-3 rounded-xl border border-outline-variant bg-surface-container/60 p-4"
          >
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
                  Nombre (p. ej. Único, Mediana, Grande)
                </label>
                <input
                  value={variant.name}
                  onChange={(e) => updateVariant(variant.key, { name: e.target.value })}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary"
                />
              </div>
              <div className="w-32">
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
                  Precio
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={variant.price}
                  onChange={(e) => updateVariant(variant.key, { price: e.target.value })}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary"
                />
              </div>
              <div className="w-36">
                <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
                  Precio empleado
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="50% automático"
                  value={variant.employeePrice}
                  onChange={(e) => updateVariant(variant.key, { employeePrice: e.target.value })}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary"
                />
              </div>
              {variants.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeVariant(variant.key)}
                  className="mb-0.5 rounded-lg p-2.5 text-on-surface-variant transition hover:bg-error/10 hover:text-error"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-2 border-t border-outline-variant pt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-on-surface-variant">
                  Receta de ingredientes (opcional — se descuentan del inventario de la sucursal)
                </p>
                <button
                  type="button"
                  onClick={() => addIngredient(variant.key)}
                  disabled={inventoryProducts.length === 0}
                  className="text-xs font-semibold text-primary hover:underline disabled:opacity-40"
                >
                  + Ingrediente
                </button>
              </div>

              {variant.ingredients.map((ingredient) => (
                <div key={ingredient.key} className="flex items-center gap-2">
                  <select
                    value={ingredient.inventoryProductId}
                    onChange={(e) =>
                      updateIngredient(variant.key, ingredient.key, {
                        inventoryProductId: e.target.value,
                      })
                    }
                    className="flex-1 rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                  >
                    {inventoryProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    value={ingredient.quantity}
                    onChange={(e) =>
                      updateIngredient(variant.key, ingredient.key, { quantity: e.target.value })
                    }
                    className="w-24 rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredient(variant.key, ingredient.key)}
                    className="rounded-lg p-2 text-on-surface-variant transition hover:bg-error/10 hover:text-error"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {variant.ingredients.length === 0 && (
                <p className="text-xs text-on-surface-variant">
                  Sin ingredientes — esta variante no descontará inventario al venderse.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        {initialProduct ? (
          <button
            type="button"
            onClick={handleDelete}
            className="text-sm font-semibold text-error hover:underline"
          >
            Eliminar producto
          </button>
        ) : (
          <span />
        )}

        <button
          disabled={pending}
          className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Guardando..." : "Guardar producto"}
        </button>
      </div>
    </form>
  );
}
