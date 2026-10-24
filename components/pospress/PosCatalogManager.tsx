"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import {
  createPosCategoryAction,
  createPosProductAction,
  createPosVariantAction,
  deletePosProductAction,
  deletePosVariantAction,
  updatePosCategoryAction,
  updatePosProductAction,
  updateRecipeQuantitiesAction,
} from "@/app/pospress/catalog/actions";
import { useToast } from "@/components/ui/Toast";
import {
  BookIcon,
  CheckIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from "@/components/ui/icons";

export type InventoryProduct = {
  id: string;
  code: string;
  name: string;
  unit: string;
  inventoryBaseUnit: string | null;
};

export type IngredientItem = {
  inventoryProductId: string;
  quantity: string;
  unit: string | null;
  inventoryProduct: { name: string };
};

export type VariantItem = {
  id: string;
  name: string;
  price: number;
  baseUnit: string;
  ingredients: IngredientItem[];
};

export type ProductItem = {
  id: string;
  name: string;
  description: string | null;
  inventoryTracked: boolean;
  variants: VariantItem[];
};

export type CategoryItem = {
  id: string;
  name: string;
  products: ProductItem[];
};

const BASE_UNITS = [
  ["UNIT", "Pieza (unidad)"],
  ["ML", "Mililitros (ml)"],
  ["G", "Gramos (g)"],
] as const;

export default function PosCatalogManager({
  categories,
  inventoryProducts,
}: {
  categories: CategoryItem[];
  inventoryProducts: InventoryProduct[];
}) {
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  // Búsqueda y categoría
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");

  // Modales
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAddVariantModalOpen, setIsAddVariantModalOpen] = useState(false);
  const [targetProductForVariant, setTargetProductForVariant] = useState<ProductItem | null>(null);

  // Modal de Receta Rápida
  const [recipeModalVariant, setRecipeModalVariant] = useState<{
    productId: string;
    productName: string;
    variantId: string;
    variantName: string;
    ingredients: Array<{ inventoryProductId: string; quantity: string }>;
  } | null>(null);

  // Formulario Producto Principal
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [prodCategoryId, setProdCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [prodName, setProdName] = useState("");
  const [prodDescription, setProdDescription] = useState("");
  const [prodVariantName, setProdVariantName] = useState("Mediano");
  const [prodPrice, setProdPrice] = useState("");
  const [prodBaseUnit, setProdBaseUnit] = useState("UNIT");
  const [prodInventoryTracked, setProdInventoryTracked] = useState(true);
  const [prodIngredients, setProdIngredients] = useState<
    Array<{ inventoryProductId: string; quantity: string }>
  >([]);

  // Formulario para Agregar una Nueva Variedad a un producto existente
  const [newVarName, setNewVarName] = useState("");
  const [newVarPrice, setNewVarPrice] = useState("");
  const [newVarIngredients, setNewVarIngredients] = useState<
    Array<{ inventoryProductId: string; quantity: string }>
  >([]);

  // Formulario Categoría
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState("");

  // Confirmación de borrado
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<{ id: string; name: string } | null>(null);
  const [confirmDeleteVariant, setConfirmDeleteVariant] = useState<{ id: string; name: string } | null>(null);

  // Map de insumos de inventario
  const inventoryMap = useMemo(() => {
    return new Map(inventoryProducts.map((p) => [p.id, p]));
  }, [inventoryProducts]);

  // Lista agrupada de productos con sus variantes
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result: Array<{ category: CategoryItem; product: ProductItem }> = [];

    for (const cat of categories) {
      if (selectedCategoryId !== "ALL" && cat.id !== selectedCategoryId) continue;

      for (const prod of cat.products) {
        if (!q) {
          result.push({ category: cat, product: prod });
          continue;
        }

        const matchName = prod.name.toLowerCase().includes(q);
        const matchCategory = cat.name.toLowerCase().includes(q);
        const matchVariant = prod.variants.some((v) => v.name.toLowerCase().includes(q));
        const matchIngredient = prod.variants.some((v) =>
          v.ingredients.some((ing) => ing.inventoryProduct.name.toLowerCase().includes(q))
        );

        if (matchName || matchCategory || matchVariant || matchIngredient) {
          result.push({ category: cat, product: prod });
        }
      }
    }
    return result;
  }, [categories, search, selectedCategoryId]);

  // Abrir modal de nuevo producto (limpio)
  function handleOpenNewProduct() {
    setEditingProductId(null);
    setEditingVariantId(null);
    setProdCategoryId(categories[0]?.id ?? "");
    setProdName("");
    setProdDescription("");
    setProdVariantName("Mediano");
    setProdPrice("");
    setProdBaseUnit("UNIT");
    setProdInventoryTracked(true);
    setProdIngredients([]);
    setIsProductModalOpen(true);
  }

  // Abrir modal para agregar una variedad a un producto existente
  function handleOpenAddVariant(product: ProductItem) {
    setTargetProductForVariant(product);
    setNewVarName("");
    setNewVarPrice("");

    // Por defecto sugerir copiar los ingredientes de la primera variedad si existe
    const firstVar = product.variants[0];
    if (firstVar) {
      setNewVarIngredients(
        firstVar.ingredients.map((ing) => ({
          inventoryProductId: ing.inventoryProductId,
          quantity: String(ing.quantity),
        }))
      );
    } else {
      setNewVarIngredients([]);
    }
    setIsAddVariantModalOpen(true);
  }

  // Guardar nueva variedad en un producto existente
  function handleSaveNewVariantSubmit(e: FormEvent) {
    e.preventDefault();
    if (!targetProductForVariant) return;

    startTransition(async () => {
      const result = await createPosVariantAction({
        productId: targetProductForVariant.id,
        name: newVarName,
        price: Number(newVarPrice),
        ingredients: newVarIngredients
          .filter((i) => i.inventoryProductId && Number(i.quantity) > 0)
          .map((i) => ({
            inventoryProductId: i.inventoryProductId,
            quantity: Number(i.quantity),
          })),
      });

      if (!result.success) {
        showToast(result.error, "error");
        return;
      }

      showToast(result.message, "success");
      setIsAddVariantModalOpen(false);
      window.location.reload();
    });
  }

  // Abrir editor enfocado en las cantidades de una receta
  function handleOpenRecipeEditor(product: ProductItem, variant: VariantItem) {
    setRecipeModalVariant({
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      variantName: variant.name,
      ingredients: variant.ingredients.map((ing) => ({
        inventoryProductId: ing.inventoryProductId,
        quantity: String(ing.quantity),
      })),
    });
  }

  // Guardar edición de receta
  function handleSaveRecipeSubmit(e: FormEvent) {
    e.preventDefault();
    if (!recipeModalVariant) return;

    startTransition(async () => {
      const result = await updateRecipeQuantitiesAction({
        variantId: recipeModalVariant.variantId,
        ingredients: recipeModalVariant.ingredients
          .filter((item) => item.inventoryProductId && Number(item.quantity) > 0)
          .map((item) => ({
            inventoryProductId: item.inventoryProductId,
            quantity: Number(item.quantity),
          })),
      });

      if (!result.success) {
        showToast(result.error, "error");
        return;
      }

      showToast(result.message, "success");
      setRecipeModalVariant(null);
      window.location.reload();
    });
  }

  // Editar datos generales de un producto
  function handleEditProduct(category: CategoryItem, product: ProductItem) {
    setEditingProductId(product.id);
    const firstVar = product.variants[0];
    setEditingVariantId(firstVar?.id ?? null);
    setProdCategoryId(category.id);
    setProdName(product.name);
    setProdDescription(product.description ?? "");
    setProdVariantName(firstVar?.name ?? "Único");
    setProdPrice(String(firstVar?.price ?? ""));
    setProdBaseUnit(firstVar?.baseUnit ?? "UNIT");
    setProdInventoryTracked(product.inventoryTracked);
    setProdIngredients(
      firstVar?.ingredients.map((ing) => ({
        inventoryProductId: ing.inventoryProductId,
        quantity: String(ing.quantity),
      })) ?? []
    );
    setIsProductModalOpen(true);
  }

  // Guardar producto nuevo o editado
  function handleSaveProductSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const input = {
        categoryId: prodCategoryId,
        name: prodName,
        description: prodDescription,
        variantName: prodVariantName,
        variantId: editingVariantId ?? undefined,
        price: Number(prodPrice),
        baseUnit: prodBaseUnit,
        inventoryTracked: prodInventoryTracked,
        ingredients: prodIngredients
          .filter((item) => item.inventoryProductId && Number(item.quantity) > 0)
          .map((item) => ({
            inventoryProductId: item.inventoryProductId,
            quantity: Number(item.quantity),
          })),
      };

      const result = editingProductId
        ? await updatePosProductAction({ ...input, productId: editingProductId })
        : await createPosProductAction(input);

      if (!result.success) {
        showToast(result.error, "error");
        return;
      }

      showToast(result.message, "success");
      setIsProductModalOpen(false);
      window.location.reload();
    });
  }

  // Eliminar producto completo
  function handleDeleteProduct(productId: string) {
    startTransition(async () => {
      const result = await deletePosProductAction({ productId });
      if (!result.success) {
        showToast(result.error, "error");
        return;
      }
      showToast(result.message, "success");
      setConfirmDeleteProduct(null);
      window.location.reload();
    });
  }

  // Eliminar una sola variedad
  function handleDeleteVariant(variantId: string) {
    startTransition(async () => {
      const result = await deletePosVariantAction({ variantId });
      if (!result.success) {
        showToast(result.error, "error");
        return;
      }
      showToast(result.message, "success");
      setConfirmDeleteVariant(null);
      window.location.reload();
    });
  }

  // Guardar categoría
  function handleSaveCategorySubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = editingCategoryId
        ? await updatePosCategoryAction({ id: editingCategoryId, name: categoryNameInput })
        : await createPosCategoryAction({ name: categoryNameInput });

      if (!result.success) {
        showToast(result.error, "error");
        return;
      }
      showToast(result.message, "success");
      setIsCategoryModalOpen(false);
      setCategoryNameInput("");
      window.location.reload();
    });
  }

  return (
    <main className="min-h-screen bg-background text-on-surface p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Encabezado */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookIcon className="h-5 w-5" />
              </span>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                Punto de Venta
              </p>
            </div>
            <h1 className="mt-1 text-3xl font-black text-on-surface">
              Recetario POS & Variedades de Producto
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Crea un producto (ej. Charro Negro) y define sus variedades (Mediano, Grande, con/sin tequila) con recetas independientes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/pospress"
              className="rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container transition"
            >
              ← Ir a Cobrar
            </Link>

            <button
              onClick={() => {
                setEditingCategoryId(null);
                setCategoryNameInput("");
                setIsCategoryModalOpen(true);
              }}
              className="rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container transition"
            >
              + Nueva Categoría
            </button>

            <button
              onClick={handleOpenNewProduct}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 hover:opacity-95 active:scale-95 transition"
            >
              <PlusIcon className="h-4 w-4" />
              Nuevo Producto
            </button>
          </div>
        </header>

        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por producto (Charro Negro, Vampiro...) o insumo..."
              className="w-full rounded-xl border border-outline-variant bg-surface-container px-10 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant hover:text-on-surface"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCategoryId("ALL")}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${
                selectedCategoryId === "ALL"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Todas ({categories.reduce((acc, c) => acc + c.products.length, 0)} productos)
            </button>
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`rounded-lg px-3 py-1.5 font-bold transition flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className="opacity-70 text-[10px]">({cat.products.length})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabla Agrupada de Productos y Variedades */}
        <div className="space-y-4">
          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant p-12 text-center text-on-surface-variant">
              <p className="text-base font-semibold">No se encontraron productos.</p>
              <p className="text-xs mt-1">
                Haz clic en "+ Nuevo Producto" para comenzar.
              </p>
            </div>
          ) : (
            filteredProducts.map(({ category, product }) => (
              <div
                key={product.id}
                className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low shadow-sm"
              >
                {/* Cabecera del Producto Padre */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-surface-container px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-black text-sm">
                      {product.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-black text-on-surface">{product.name}</h2>
                        <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-on-surface-variant border border-outline-variant/60">
                          {category.name}
                        </span>
                        <span className="text-xs font-semibold text-on-surface-variant">
                          · {product.variants.length} {product.variants.length === 1 ? "variedad" : "variedades"}
                        </span>
                      </div>
                      {product.description && (
                        <p className="text-xs text-on-surface-variant mt-0.5">{product.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenAddVariant(product)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition"
                      title="Agregar otra variedad (tamaño o receta) a este mismo producto"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      + Agregar Variedad / Tamaño
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEditProduct(category, product)}
                      className="rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container transition"
                      title="Editar nombre general o categoría"
                    >
                      Editar Producto
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteProduct({ id: product.id, name: product.name })}
                      className="rounded-lg p-1.5 text-on-surface-variant hover:bg-error/10 hover:text-error transition"
                      title="Quitar este producto del POS"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Sub-tabla con las Variedades y sus Recetas Exactas */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/50 text-[11px] uppercase tracking-wider font-bold text-on-surface-variant bg-surface/50">
                        <th className="py-2.5 px-4 w-44">Variedad / Tamaño</th>
                        <th className="py-2.5 px-4 w-28">Precio</th>
                        <th className="py-2.5 px-4">Receta de Inventario (Cantidades Exactas)</th>
                        <th className="py-2.5 px-4 text-right w-44">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/40">
                      {product.variants.map((variant) => {
                        const hasIngredients = variant.ingredients.length > 0;
                        return (
                          <tr key={variant.id} className="hover:bg-surface-container/40 transition">
                            {/* Nombre de la Variedad */}
                            <td className="py-2.5 px-4 font-bold text-on-surface">
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-2.5 py-1 text-xs">
                                <span>{variant.name}</span>
                              </span>
                            </td>

                            {/* Precio */}
                            <td className="py-2.5 px-4 font-mono font-bold text-emerald-500">
                              ${variant.price.toFixed(2)}
                            </td>

                            {/* Receta */}
                            <td className="py-2.5 px-4">
                              {hasIngredients ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {variant.ingredients.map((ing, idx) => {
                                    const inv = inventoryMap.get(ing.inventoryProductId);
                                    const unitLabel = ing.unit ?? inv?.inventoryBaseUnit ?? inv?.unit ?? "";
                                    return (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 rounded-md bg-surface border border-outline-variant/80 px-2 py-0.5 text-xs text-on-surface"
                                      >
                                        <span className="font-medium">
                                          {ing.inventoryProduct?.name ?? inv?.name ?? "Insumo"}
                                        </span>
                                        <span className="font-mono font-bold text-primary">
                                          {ing.quantity} {unitLabel}
                                        </span>
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-xs font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                                  ⚠️ Sin receta (no descuenta insumos)
                                </span>
                              )}
                            </td>

                            {/* Acciones por Variedad */}
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenRecipeEditor(product, variant)}
                                  className="rounded-lg bg-primary/10 border border-primary/30 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition"
                                  title="Editar las cantidades e insumos de esta variedad"
                                >
                                  🧪 Receta
                                </button>

                                {product.variants.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmDeleteVariant({
                                        id: variant.id,
                                        name: `${product.name} (${variant.name})`,
                                      })
                                    }
                                    className="rounded-lg p-1 text-on-surface-variant hover:bg-error/10 hover:text-error transition"
                                    title="Quitar esta variedad"
                                  >
                                    <TrashIcon className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal: Agregar Variedad a Producto Existente */}
        {isAddVariantModalOpen && targetProductForVariant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-outline-variant bg-surface-container p-6 shadow-2xl space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    Nueva Presentación
                  </p>
                  <h2 className="text-xl font-black text-on-surface">
                    Agregar Variedad a "{targetProductForVariant.name}"
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Ejemplos: "Grande", "Mediano sin tequila", "Doble Tequila", etc.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddVariantModalOpen(false)}
                  className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-high"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveNewVariantSubmit} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Nombre de la Variedad *
                    <input
                      type="text"
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value)}
                      placeholder="Ej. Grande, Sin Tequila, Litro..."
                      required
                      className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                    />
                  </label>

                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Precio ($ MXN) *
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newVarPrice}
                      onChange={(e) => setNewVarPrice(e.target.value)}
                      placeholder="0.00"
                      required
                      className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm font-mono font-bold text-on-surface"
                    />
                  </label>
                </div>

                {/* Receta para esta variedad */}
                <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                        Insumos para esta variedad
                      </h3>
                      <p className="text-[11px] text-on-surface-variant">
                        Cantidades que se descontarán al vender esta presentación.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setNewVarIngredients((prev) => [
                          ...prev,
                          { inventoryProductId: "", quantity: "30" },
                        ])
                      }
                      className="rounded-lg border border-outline-variant bg-surface px-2.5 py-1 text-xs font-bold text-primary hover:bg-surface-container transition"
                    >
                      + Ingrediente
                    </button>
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-1.5">
                    {newVarIngredients.map((ing, index) => {
                      const inv = inventoryMap.get(ing.inventoryProductId);
                      const unitLabel = inv?.inventoryBaseUnit ?? inv?.unit ?? "—";
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 rounded-xl bg-surface p-2 border border-outline-variant"
                        >
                          <select
                            value={ing.inventoryProductId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewVarIngredients((items) =>
                                items.map((it, i) =>
                                  i === index ? { ...it, inventoryProductId: val } : it
                                )
                              );
                            }}
                            className="flex-1 rounded-lg border border-outline-variant bg-background px-2.5 py-1 text-xs text-on-surface"
                            required
                          >
                            <option value="">Selecciona ingrediente...</option>
                            {inventoryProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.inventoryBaseUnit ?? p.unit})
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={ing.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewVarIngredients((items) =>
                                items.map((it, i) =>
                                  i === index ? { ...it, quantity: val } : it
                                )
                              );
                            }}
                            className="w-20 rounded-lg border border-outline-variant bg-background px-2 py-1 text-xs font-mono text-center font-bold"
                            required
                          />
                          <span className="w-10 text-[11px] font-bold text-on-surface-variant">
                            {unitLabel}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setNewVarIngredients((items) =>
                                items.filter((_, i) => i !== index)
                              )
                            }
                            className="rounded-lg p-1 text-on-surface-variant hover:text-error"
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}

                    {newVarIngredients.length === 0 && (
                      <p className="text-xs text-on-surface-variant text-center py-2">
                        Sin ingredientes. Haz clic en "+ Ingrediente" para armar su receta.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddVariantModalOpen(false)}
                    className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-on-primary hover:opacity-95"
                  >
                    {pending ? "Guardando..." : "Guardar Variedad"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Editar Receta y Cantidades */}
        {recipeModalVariant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-xl rounded-3xl border border-outline-variant bg-surface-container p-6 shadow-2xl space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    Receta de Inventario
                  </p>
                  <h2 className="text-xl font-black text-on-surface">
                    {recipeModalVariant.productName} — {recipeModalVariant.variantName}
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Cantidades exactas que descuenta esta presentación al venderse en caja.
                  </p>
                </div>
                <button
                  onClick={() => setRecipeModalVariant(null)}
                  className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-high"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRecipeSubmit} className="space-y-4">
                <div className="max-h-72 overflow-y-auto space-y-2 border-y border-outline-variant py-3">
                  {recipeModalVariant.ingredients.map((ing, idx) => {
                    const inv = inventoryMap.get(ing.inventoryProductId);
                    const unitLabel = inv?.inventoryBaseUnit ?? inv?.unit ?? "—";
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-xl bg-surface p-2.5 border border-outline-variant"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-on-surface truncate">
                            {inv?.name ?? "Insumo de inventario"}
                          </p>
                          <p className="text-[11px] text-on-surface-variant font-mono">
                            {inv?.code ?? ""} · Unidad: {unitLabel}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={ing.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRecipeModalVariant((prev) => {
                                if (!prev) return null;
                                const copy = [...prev.ingredients];
                                copy[idx] = { ...copy[idx], quantity: val };
                                return { ...prev, ingredients: copy };
                              });
                            }}
                            className="w-24 rounded-lg border border-outline-variant bg-background px-3 py-1.5 text-sm font-mono text-center font-bold text-on-surface focus:border-primary outline-none"
                            required
                          />
                          <span className="w-12 text-xs font-bold text-on-surface-variant">
                            {unitLabel}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              setRecipeModalVariant((prev) => {
                                if (!prev) return null;
                                return {
                                  ...prev,
                                  ingredients: prev.ingredients.filter((_, i) => i !== idx),
                                };
                              });
                            }}
                            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-error/10 hover:text-error transition"
                            title="Quitar este insumo"
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {recipeModalVariant.ingredients.length === 0 && (
                    <p className="text-xs text-on-surface-variant text-center py-4">
                      Esta variedad no tiene ingredientes asignados.
                    </p>
                  )}
                </div>

                {/* Agregar insumo a la receta */}
                <div className="rounded-xl border border-dashed border-outline-variant p-3 bg-surface-container-low space-y-2">
                  <span className="text-xs font-bold text-on-surface-variant block">
                    + Añadir otro insumo a esta receta
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      id="edit-recipe-ing-select"
                      className="flex-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                      defaultValue=""
                    >
                      <option value="">Selecciona ingrediente de almacén...</option>
                      {inventoryProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.inventoryBaseUnit ?? p.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      id="edit-recipe-ing-qty"
                      type="number"
                      min="0.1"
                      step="any"
                      placeholder="Cant."
                      defaultValue="30"
                      className="w-20 rounded-lg border border-outline-variant bg-surface px-2 py-2 text-sm font-mono text-center"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const sel = document.getElementById(
                          "edit-recipe-ing-select"
                        ) as HTMLSelectElement;
                        const qty = document.getElementById(
                          "edit-recipe-ing-qty"
                        ) as HTMLInputElement;
                        if (!sel.value || Number(qty.value) <= 0) return;

                        setRecipeModalVariant((prev) => {
                          if (!prev) return null;
                          if (prev.ingredients.some((i) => i.inventoryProductId === sel.value)) {
                            showToast("El ingrediente ya está en la receta.", "error");
                            return prev;
                          }
                          return {
                            ...prev,
                            ingredients: [
                              ...prev.ingredients,
                              { inventoryProductId: sel.value, quantity: qty.value },
                            ],
                          };
                        });
                        sel.value = "";
                      }}
                      className="rounded-lg bg-surface-container-high border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-highest transition"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRecipeModalVariant(null)}
                    className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-on-primary hover:opacity-95"
                  >
                    {pending ? "Guardando..." : "Guardar Receta"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Crear / Editar Producto General */}
        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-outline-variant bg-surface-container p-6 shadow-2xl space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    {editingProductId ? "Actualizar Producto" : "Nuevo Producto POS"}
                  </p>
                  <h2 className="text-2xl font-black text-on-surface">
                    {editingProductId ? `Editar ${prodName}` : "Crear Producto & Presentación"}
                  </h2>
                </div>
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-high"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProductSubmit} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Categoría *
                    <select
                      value={prodCategoryId}
                      onChange={(e) => setProdCategoryId(e.target.value)}
                      required
                      className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                    >
                      <option value="">Selecciona categoría</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Nombre del Producto *
                    <input
                      type="text"
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      placeholder="Ej. Charro Negro, Vampiro, Paloma..."
                      required
                      className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                    />
                  </label>

                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Primera Presentación / Tamaño *
                    <input
                      type="text"
                      value={prodVariantName}
                      onChange={(e) => setProdVariantName(e.target.value)}
                      placeholder="Ej. Mediano, Grande, Único"
                      required
                      className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                    />
                  </label>

                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Precio ($ MXN) *
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      placeholder="0.00"
                      required
                      className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm font-mono font-bold text-on-surface"
                    />
                  </label>

                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant sm:col-span-2">
                    Descripción
                    <input
                      type="text"
                      value={prodDescription}
                      onChange={(e) => setProdDescription(e.target.value)}
                      placeholder="Descripción de la bebida"
                      className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                    />
                  </label>
                </div>

                {/* Receta */}
                <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                        Insumos de la Receta
                      </h3>
                      <p className="text-[11px] text-on-surface-variant">
                        Indica las cantidades exactas para esta presentación. Luego podrás agregar más variedades.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setProdIngredients((prev) => [
                          ...prev,
                          { inventoryProductId: "", quantity: "30" },
                        ])
                      }
                      className="rounded-lg border border-outline-variant bg-surface px-2.5 py-1 text-xs font-bold text-primary hover:bg-surface-container transition"
                    >
                      + Ingrediente
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {prodIngredients.map((ing, index) => {
                      const inv = inventoryMap.get(ing.inventoryProductId);
                      const unitLabel = inv?.inventoryBaseUnit ?? inv?.unit ?? "—";
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 rounded-xl bg-surface p-2 border border-outline-variant"
                        >
                          <select
                            value={ing.inventoryProductId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProdIngredients((items) =>
                                items.map((it, i) =>
                                  i === index ? { ...it, inventoryProductId: val } : it
                                )
                              );
                            }}
                            className="flex-1 rounded-lg border border-outline-variant bg-background px-2.5 py-1 text-xs text-on-surface"
                            required
                          >
                            <option value="">Selecciona ingrediente...</option>
                            {inventoryProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.inventoryBaseUnit ?? p.unit})
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={ing.quantity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProdIngredients((items) =>
                                items.map((it, i) =>
                                  i === index ? { ...it, quantity: val } : it
                                )
                              );
                            }}
                            className="w-20 rounded-lg border border-outline-variant bg-background px-2 py-1 text-xs font-mono text-center font-bold"
                            required
                          />
                          <span className="w-10 text-[11px] font-bold text-on-surface-variant">
                            {unitLabel}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setProdIngredients((items) =>
                                items.filter((_, i) => i !== index)
                              )
                            }
                            className="rounded-lg p-1 text-on-surface-variant hover:text-error"
                          >
                            <XIcon className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-xl bg-primary px-6 py-2 text-sm font-bold text-on-primary hover:opacity-95"
                  >
                    {pending ? "Guardando..." : "Guardar Producto"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Crear / Editar Categoría */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md rounded-3xl border border-outline-variant bg-surface-container p-6 shadow-2xl space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-black text-on-surface">
                    {editingCategoryId ? "Editar Categoría" : "Nueva Categoría"}
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Organiza los botones en la pantalla de cobro de POSpress.
                  </p>
                </div>
                <button
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-high"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCategorySubmit} className="space-y-4">
                <input
                  type="text"
                  value={categoryNameInput}
                  onChange={(e) => setCategoryNameInput(e.target.value)}
                  placeholder="Nombre de la categoría (ej. Tequilitros, Cerveza...)"
                  required
                  className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-sm text-on-surface"
                />

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-on-primary hover:opacity-95"
                  >
                    {pending ? "Guardando..." : "Guardar Categoría"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirmar Borrado de Producto Padre */}
        {confirmDeleteProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm rounded-3xl border border-outline-variant bg-surface-container p-6 shadow-2xl space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error/15 text-error">
                <TrashIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">
                  ¿Retirar "{confirmDeleteProduct.name}"?
                </h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  Se retirará este producto y todas sus variedades del punto de venta.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteProduct(null)}
                  className="flex-1 rounded-xl border border-outline-variant py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(confirmDeleteProduct.id)}
                  disabled={pending}
                  className="flex-1 rounded-xl bg-error py-2.5 text-xs font-bold text-on-error hover:opacity-90"
                >
                  {pending ? "Retirando..." : "Sí, retirar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmar Borrado de Variedad Individual */}
        {confirmDeleteVariant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-sm rounded-3xl border border-outline-variant bg-surface-container p-6 shadow-2xl space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error/15 text-error">
                <TrashIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">
                  ¿Retirar "{confirmDeleteVariant.name}"?
                </h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  Esta variedad específica ya no estará disponible para cobrar en el POS.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteVariant(null)}
                  className="flex-1 rounded-xl border border-outline-variant py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteVariant(confirmDeleteVariant.id)}
                  disabled={pending}
                  className="flex-1 rounded-xl bg-error py-2.5 text-xs font-bold text-on-error hover:opacity-90"
                >
                  {pending ? "Retirando..." : "Sí, retirar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
