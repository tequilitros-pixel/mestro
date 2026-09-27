"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  createPosCategoryAction,
  createPosProductAction,
  updatePosCategoryAction,
  updatePosProductAction,
} from "@/app/pospress/catalog/actions";
import { useToast } from "@/components/ui/Toast";

type InventoryProduct = { id: string; code: string; name: string; unit: string; inventoryBaseUnit: string | null };
type Ingredient = { inventoryProductId: string; quantity: string; enabled: boolean };
type Variant = {
  id: string;
  name: string;
  price: number;
  baseUnit: string;
  ingredients: Array<{ inventoryProductId: string; quantity: string; unit: string | null; inventoryProduct: { name: string } }>;
};
type Product = { id: string; name: string; description: string | null; inventoryTracked: boolean; variants: Variant[] };
type Category = { id: string; name: string; products: Product[] };

const BASE_UNITS = [["UNIT", "Pieza"], ["ML", "Mililitros"], ["G", "Gramos"]] as const;

export default function PosCatalogManager({ categories, inventoryProducts }: { categories: Category[]; inventoryProducts: InventoryProduct[] }) {
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [variantName, setVariantName] = useState("Único");
  const [price, setPrice] = useState("");
  const [baseUnit, setBaseUnit] = useState("UNIT");
  const [inventoryTracked, setInventoryTracked] = useState(true);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  function reset() {
    setEditingProductId(null); setEditingProduct(null); setEditingVariantId(null);
    setName(""); setDescription(""); setVariantName("Único"); setPrice("");
    setBaseUnit("UNIT"); setInventoryTracked(true); setIngredients([]);
  }

  function loadVariant(product: Product, variantId?: string) {
    const variant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];
    setEditingVariantId(variant?.id ?? null); setDescription(product.description ?? "");
    setVariantName(variant?.name ?? "Único"); setPrice(String(variant?.price ?? ""));
    setBaseUnit(variant?.baseUnit ?? "UNIT"); setInventoryTracked(product.inventoryTracked);
    setIngredients(variant?.ingredients.map((item) => ({ inventoryProductId: item.inventoryProductId, quantity: String(item.quantity), enabled: true })) ?? []);
  }

  function edit(category: Category, product: Product) {
    setEditingProductId(product.id); setEditingProduct(product); setCategoryId(category.id); setName(product.name);
    loadVariant(product, product.variants[0]?.id); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = editingCategoryId ? await updatePosCategoryAction({ id: editingCategoryId, name: categoryName }) : await createPosCategoryAction({ name: categoryName });
      if (!result.success) return showToast(result.error, "error");
      showToast(result.message, "success"); window.location.reload();
    });
  }

  function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const input = {
        categoryId, name, description, variantName, variantId: editingVariantId ?? undefined,
        price: Number(price), baseUnit, inventoryTracked,
        ingredients: ingredients.filter((item) => item.enabled).map((item) => ({ inventoryProductId: item.inventoryProductId, quantity: Number(item.quantity) })),
      };
      const result = editingProductId ? await updatePosProductAction({ ...input, productId: editingProductId }) : await createPosProductAction(input);
      if (!result.success) return showToast(result.error, "error");
      showToast(result.message, "success"); window.location.reload();
    });
  }

  function changeIngredient(index: number, patch: Partial<Ingredient>) {
    setIngredients((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  return (
    <main className="page-frame text-on-surface"><div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Punto de venta</p><h1 className="mt-1 text-2xl font-bold">Catálogo POS y recetas</h1><p className="mt-1 text-sm text-on-surface-variant">Edita cada producto, presentación e ingrediente de la receta.</p></div><a href="/pospress" className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold">Volver a POSpress</a></div>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <form onSubmit={saveCategory} className="rounded-2xl border border-outline-variant bg-surface-container-low p-4"><h2 className="font-semibold">{editingCategoryId ? "Editar categoría" : "Nueva categoría"}</h2><p className="mt-1 text-sm text-on-surface-variant">Las categorías organizan los botones del punto de venta.</p><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Nombre de categoría" className="mt-4 h-10 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm" /><div className="mt-3 flex gap-2"><button disabled={pending} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary">{editingCategoryId ? "Guardar categoría" : "Crear categoría"}</button>{editingCategoryId && <button type="button" onClick={() => { setEditingCategoryId(null); setCategoryName(""); }} className="rounded-lg border border-outline-variant px-3 py-2 text-sm">Cancelar</button>}</div></form>
        <form onSubmit={saveProduct} className="rounded-2xl border border-outline-variant bg-surface-container-low p-4"><h2 className="font-semibold">{editingProductId ? "Editar producto y receta" : "Nuevo producto para POSpress"}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Categoría<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3"><option value="">Selecciona una categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="text-sm">Producto<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Kimichi" className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3" /></label>{editingProductId && editingProduct && editingProduct.variants.length > 1 && <label className="text-sm sm:col-span-2">Presentación que vas a editar<select value={editingVariantId ?? ""} onChange={(event) => loadVariant(editingProduct, event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3">{editingProduct.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} · ${variant.price.toFixed(2)}</option>)}</select></label>}<label className="text-sm">Precio<input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3" /></label><label className="text-sm">Nombre de presentación<input value={variantName} onChange={(event) => setVariantName(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3" /></label><label className="text-sm">Unidad base<select value={baseUnit} onChange={(event) => setBaseUnit(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-background px-3">{BASE_UNITS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm sm:col-span-2">Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="Descripción para el equipo" className="mt-1 w-full rounded-lg border border-outline-variant bg-background px-3 py-2" /></label></div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={inventoryTracked} onChange={(event) => setInventoryTracked(event.target.checked)} /> Controlar existencias y usar receta</label>
          <div className="mt-4 rounded-xl border border-outline-variant bg-background p-3"><div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Ingredientes de la receta</h3><p className="text-xs text-on-surface-variant">Marca cada ingrediente que lleva y cambia sus mililitros, gramos o piezas.</p></div><button type="button" onClick={() => setIngredients((items) => [...items, { inventoryProductId: "", quantity: "1", enabled: true }])} className="rounded-lg border border-outline-variant px-2 py-1 text-xs font-semibold">+ Ingrediente</button></div><div className="mt-3 space-y-2">{ingredients.map((ingredient, index) => { const selectedProduct = inventoryProducts.find((product) => product.id === ingredient.inventoryProductId); return <div key={`${index}-${ingredient.inventoryProductId}`} className={`rounded-lg border p-2 ${ingredient.enabled ? "border-outline-variant" : "border-outline-variant/60 opacity-60"}`}><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-1.5 text-xs font-semibold"><input type="checkbox" checked={ingredient.enabled} onChange={(event) => changeIngredient(index, { enabled: event.target.checked })} aria-label={`Usar ${selectedProduct?.name ?? "ingrediente"}`} /><span>{ingredient.enabled ? "Usar" : "No usar"}</span></label><select value={ingredient.inventoryProductId} onChange={(event) => changeIngredient(index, { inventoryProductId: event.target.value })} className="h-9 min-w-0 flex-1 rounded-lg border border-outline-variant bg-background px-2 text-sm"><option value="">Selecciona ingrediente</option>{inventoryProducts.map((product) => <option key={product.id} value={product.id}>{product.code} · {product.name} ({product.inventoryBaseUnit ?? product.unit})</option>)}</select><input type="number" min="0.001" step="0.001" value={ingredient.quantity} onChange={(event) => changeIngredient(index, { quantity: event.target.value })} aria-label={`Cantidad de ${selectedProduct?.name ?? "ingrediente"}`} className="h-9 w-24 rounded-lg border border-outline-variant bg-background px-2 text-sm" /><span className="w-10 text-xs font-semibold text-on-surface-variant">{selectedProduct?.inventoryBaseUnit ?? selectedProduct?.unit ?? "—"}</span><button type="button" onClick={() => setIngredients((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="h-9 px-2 text-xs text-error">Eliminar</button></div></div>; })}</div>{ingredients.length === 0 && <p className="mt-3 text-xs text-on-surface-variant">Aún no hay ingredientes. Agrega clamato, limón, sal u otro insumo.</p>}</div><div className="mt-4 flex gap-2"><button disabled={pending || !categories.length} className="flex-1 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-on-primary">{pending ? "Guardando…" : editingProductId ? "Guardar cambios" : "Guardar producto y receta"}</button>{editingProductId && <button type="button" onClick={reset} className="rounded-lg border border-outline-variant px-3 py-2 text-sm">Cancelar</button>}</div></form>
      </section>
      <section className="rounded-2xl border border-outline-variant bg-surface-container-low p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Productos configurados</h2><p className="mt-1 text-sm text-on-surface-variant">Elige Editar receta para cambiar una presentación específica.</p></div><span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-semibold">{categories.reduce((total, category) => total + category.products.length, 0)} productos</span></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{categories.map((category) => <div key={category.id} className="rounded-xl border border-outline-variant bg-background p-3"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{category.name}</h3><button type="button" onClick={() => { setEditingCategoryId(category.id); setCategoryName(category.name); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-xs font-semibold text-primary">Editar categoría</button></div><div className="mt-2 space-y-2">{category.products.length ? category.products.map((product) => <div key={product.id} className="rounded-lg border border-outline-variant/70 p-2.5"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{product.name}</p><button type="button" onClick={() => edit(category, product)} className="text-xs font-semibold text-primary">Editar receta</button></div><span className="text-xs text-on-surface-variant">{product.inventoryTracked ? "Con receta" : "Sin receta"}</span>{product.variants.map((variant) => <div key={variant.id} className="mt-1 text-xs text-on-surface-variant"><p>{variant.name} · ${variant.price.toFixed(2)}</p>{variant.ingredients.length > 0 && <p className="mt-1">{variant.ingredients.map((item) => `${item.inventoryProduct.name} × ${item.quantity} ${item.unit ?? ""}`).join(" · ")}</p>}</div>)}</div>) : <p className="text-xs text-on-surface-variant">Sin productos todavía.</p>}</div></div>)}</div></section>
    </div></main>
  );
}
