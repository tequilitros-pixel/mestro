"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addEventPackageItemAction,
  removeEventPackageItemAction,
  updateEventPackageItemAction,
  type ActionResult,
} from "../actions";
import { PRODUCT_CATEGORIES } from "../../products/categories";
import { useToast } from "@/components/ui/Toast";

type Product = {
  id: string;
  name: string;
  unit: string;
  category: string;
};

type PackageItem = {
  id: string;
  productId: string;
  quantity: number;
  calculationType: string;
  isRequired: boolean;
  guestsPerBlock: number | null;
};

const calcTypeLabels: Record<string, string> = {
  FIXED: "Cantidad fija",
  PER_GUEST: "Por invitado",
  PER_GUEST_BLOCK: "Por bloque",
  MANUAL: "Manual",
};

export default function PackageItemsManager({
  packageId,
  products,
  items,
}: {
  packageId: string;
  products: Product[];
  items: PackageItem[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Todos");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const itemsByProductId = useMemo(() => {
    const map = new Map<string, PackageItem>();
    for (const item of items) map.set(item.productId, item);
    return map;
  }, [items]);

  const tabs = useMemo(() => {
    const present = new Set(products.map((p) => p.category));
    const categories = PRODUCT_CATEGORIES.filter((c) => present.has(c));
    return ["Todos", ...categories];
  }, [products]);

  const filtered = products.filter((p) => {
    if (activeTab !== "Todos" && p.category !== activeTab) return false;
    return p.name.toLowerCase().includes(search.toLowerCase());
  });

  function handleResult(productId: string, result: ActionResult) {
    setSavingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setError(null);
    router.refresh();
    showToast("Cambios guardados correctamente.");
  }

  async function handleAdd(productId: string, quantity: string) {
    const qty = Number(quantity);
    if (!qty || qty <= 0) return;

    setSavingId(productId);
    const formData = new FormData();
    formData.set("packageId", packageId);
    formData.set("productId", productId);
    formData.set("calculationType", "FIXED");
    formData.set("quantity", String(qty));
    formData.set("isRequired", "on");
    const result = await addEventPackageItemAction(formData);
    handleResult(productId, result);
  }

  async function handleRemove(item: PackageItem) {
    setSavingId(item.productId);
    await removeEventPackageItemAction(item.id, packageId);
    setSavingId(null);
    setError(null);
    router.refresh();
    showToast("Elemento quitado correctamente.");
  }

  async function handleUpdate(
    item: PackageItem,
    changes: {
      quantity?: string;
      calculationType?: string;
      isRequired?: boolean;
      guestsPerBlock?: string;
    },
  ) {
    setSavingId(item.productId);
    const formData = new FormData();
    formData.set("quantity", changes.quantity ?? String(item.quantity));
    formData.set("calculationType", changes.calculationType ?? item.calculationType);

    const guestsPerBlock = changes.guestsPerBlock ?? (item.guestsPerBlock !== null ? String(item.guestsPerBlock) : "");
    if (guestsPerBlock) formData.set("guestsPerBlock", guestsPerBlock);

    if (changes.isRequired ?? item.isRequired) formData.set("isRequired", "on");

    const result = await updateEventPackageItemAction(item.id, packageId, formData);
    handleResult(item.productId, result);
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-outline-variant">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-3 py-2 text-sm font-semibold transition ${
              activeTab === tab
                ? "border-primary text-on-surface"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Buscar producto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-outline-variant bg-background px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
      />

      <div className="divide-y divide-outline-variant overflow-hidden rounded-2xl border border-outline-variant bg-surface-container">
        {filtered.length === 0 && (
          <p className="p-6 text-sm text-on-surface-variant">
            No hay productos en esta categoría.
          </p>
        )}

        {filtered.map((product) => {
          const item = itemsByProductId.get(product.id);
          const saving = savingId === product.id;

          if (item) {
            return (
              <ExistingRow
                key={product.id}
                product={product}
                item={item}
                saving={saving}
                onUpdate={(changes) => handleUpdate(item, changes)}
                onRemove={() => handleRemove(item)}
              />
            );
          }

          return (
            <AddRow
              key={product.id}
              product={product}
              saving={saving}
              onAdd={(qty) => handleAdd(product.id, qty)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ExistingRow({
  product,
  item,
  saving,
  onUpdate,
  onRemove,
}: {
  product: Product;
  item: PackageItem;
  saving: boolean;
  onUpdate: (changes: {
    quantity?: string;
    calculationType?: string;
    isRequired?: boolean;
    guestsPerBlock?: string;
  }) => void;
  onRemove: () => void;
}) {
  const [calcType, setCalcType] = useState(item.calculationType);

  return (
    <div className="flex flex-wrap items-center gap-3 bg-primary/5 p-4">
      <div className="min-w-[160px] flex-1">
        <p className="font-medium text-on-surface">{product.name}</p>
        <p className="text-xs text-on-surface-variant">{product.unit}</p>
      </div>

      <input
        key={`qty-${item.id}-${item.quantity}`}
        type="number"
        min="0"
        step="0.001"
        defaultValue={item.quantity}
        disabled={saving}
        onBlur={(e) => {
          const value = Number(e.target.value);
          if (value > 0 && value !== item.quantity) {
            onUpdate({ quantity: e.target.value });
          }
        }}
        className="w-24 rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary disabled:opacity-60"
      />

      <select
        value={calcType}
        disabled={saving}
        onChange={(e) => {
          setCalcType(e.target.value);
          if (e.target.value !== "PER_GUEST_BLOCK") {
            onUpdate({ calculationType: e.target.value });
          }
        }}
        className="w-40 rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary disabled:opacity-60"
      >
        {Object.entries(calcTypeLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {calcType === "PER_GUEST_BLOCK" && (
        <input
          key={`gpb-${item.id}-${item.guestsPerBlock}`}
          type="number"
          min="1"
          placeholder="Invitados/bloque"
          defaultValue={item.guestsPerBlock ?? ""}
          disabled={saving}
          onBlur={(e) => {
            if (Number(e.target.value) > 0) {
              onUpdate({ calculationType: "PER_GUEST_BLOCK", guestsPerBlock: e.target.value });
            }
          }}
          className="w-32 rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary disabled:opacity-60"
        />
      )}

      <label className="flex items-center gap-2 text-xs text-on-surface-variant">
        <input
          key={`req-${item.id}-${item.isRequired}`}
          type="checkbox"
          defaultChecked={item.isRequired}
          disabled={saving}
          onChange={(e) => onUpdate({ isRequired: e.target.checked })}
          className="h-4 w-4"
        />
        Obligatorio
      </label>

      <button
        onClick={onRemove}
        disabled={saving}
        className="ml-auto rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-error transition hover:border-error/40 hover:bg-error/10 disabled:opacity-60"
      >
        {saving ? "..." : "Quitar"}
      </button>
    </div>
  );
}

function AddRow({
  product,
  saving,
  onAdd,
}: {
  product: Product;
  saving: boolean;
  onAdd: (quantity: string) => void;
}) {
  const [quantity, setQuantity] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-[160px] flex-1">
        <p className="text-sm text-on-surface-variant">{product.name}</p>
        <p className="text-xs text-outline">{product.unit}</p>
      </div>

      <input
        type="number"
        min="0"
        step="0.001"
        placeholder="Cantidad"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        disabled={saving}
        className="w-24 rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary disabled:opacity-60"
      />

      <button
        onClick={() => onAdd(quantity)}
        disabled={saving || !quantity}
        className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "..." : "Agregar"}
      </button>
    </div>
  );
}
