"use client";

import { useState } from "react";
import { XIcon } from "@/components/ui/icons";

export type VariantOption = {
  id: string;
  name: string;
  price: number;
  active: boolean;
  employeePrice?: number | null;
};

export type ProductWithOptions = {
  id: string;
  name: string;
  variants: VariantOption[];
};

export default function PosVariantPickerModal({
  product,
  onSelect,
  onClose,
  formatPrice,
}: {
  product: ProductWithOptions;
  onSelect: (variant: VariantOption) => void;
  onClose: () => void;
  formatPrice?: (value: number) => string;
}) {
  const currency =
    formatPrice ??
    ((val: number) =>
      new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val));

  const [selectedSizeGroup, setSelectedSizeGroup] = useState<"MEDIANO" | "GRANDE" | null>(null);

  // Active variants
  const activeVariants = product.variants.filter((v) => v.active);

  // Mediano con alcohol
  const medianoNormalVariant = activeVariants.find(
    (v) =>
      (v.name.toLowerCase().includes("mediano") || v.name.toLowerCase().includes("mediana")) &&
      !v.name.toLowerCase().includes("sin tequila") &&
      !v.name.toLowerCase().includes("sin alcohol") &&
      !v.name.toLowerCase().includes("doble"),
  );

  const medianoDobleVariant = activeVariants.find(
    (v) =>
      (v.name.toLowerCase().includes("mediano") || v.name.toLowerCase().includes("mediana")) &&
      v.name.toLowerCase().includes("doble"),
  );

  // Grande con alcohol
  const grandeNormalVariant = activeVariants.find(
    (v) =>
      v.name.toLowerCase().includes("grande") &&
      !v.name.toLowerCase().includes("sin tequila") &&
      !v.name.toLowerCase().includes("sin alcohol") &&
      !v.name.toLowerCase().includes("doble"),
  );

  const grandeDobleVariant = activeVariants.find(
    (v) =>
      v.name.toLowerCase().includes("grande") &&
      v.name.toLowerCase().includes("doble"),
  );

  // A double-shot choice is valid only when its persisted variant (and therefore
  // its own inventory recipe) exists. Never relabel the normal variant as double.
  const hasMedianoSubmenu = Boolean(medianoNormalVariant && medianoDobleVariant);
  const hasGrandeSubmenu = Boolean(grandeNormalVariant && grandeDobleVariant);

  // Filter out the explicit "Doble shot" variants from step 1 so they don't clutter the initial sizes menu
  const step1Variants = activeVariants.filter((v) => {
    if (hasMedianoSubmenu && medianoDobleVariant && v.id === medianoDobleVariant.id) return false;
    if (hasGrandeSubmenu && grandeDobleVariant && v.id === grandeDobleVariant.id) return false;
    return true;
  });

  function handleVariantClick(variant: VariantOption) {
    if (hasMedianoSubmenu && variant.id === medianoNormalVariant?.id) {
      setSelectedSizeGroup("MEDIANO");
      return;
    }
    if (hasGrandeSubmenu && variant.id === grandeNormalVariant?.id) {
      setSelectedSizeGroup("GRANDE");
      return;
    }
    onSelect(variant);
  }

  function handleSelectPreparation(isDoble: boolean) {
    if (selectedSizeGroup === "MEDIANO") {
      if (!medianoNormalVariant) return;
      if (!isDoble) {
        onSelect(medianoNormalVariant);
        return;
      }
      if (medianoDobleVariant) onSelect(medianoDobleVariant);
      return;
    }

    if (selectedSizeGroup === "GRANDE") {
      if (!grandeNormalVariant) return;
      if (!isDoble) {
        onSelect(grandeNormalVariant);
        return;
      }
      if (grandeDobleVariant) onSelect(grandeDobleVariant);
      return;
    }
  }

  const activeNormal =
    selectedSizeGroup === "MEDIANO" ? medianoNormalVariant : grandeNormalVariant;
  const activeDoble =
    selectedSizeGroup === "MEDIANO" ? medianoDobleVariant : grandeDobleVariant;
  const groupLabel = selectedSizeGroup === "MEDIANO" ? "Mediano" : "Grande";
  const tequilaNormalMl = selectedSizeGroup === "MEDIANO" ? "30 ml" : "60 ml";
  const tequilaDobleMl = selectedSizeGroup === "MEDIANO" ? "60 ml" : "120 ml";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-dim/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-outline-variant bg-surface-container-high p-5 shadow-2xl sm:max-w-md sm:rounded-2xl">
        {selectedSizeGroup === null ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  Elegir presentación
                </p>
                <h3 className="text-lg font-bold text-on-surface">{product.name}</h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {step1Variants.map((variant) => {
                const isGroupWithSubmenu =
                  (hasMedianoSubmenu && variant.id === medianoNormalVariant?.id) ||
                  (hasGrandeSubmenu && variant.id === grandeNormalVariant?.id);

                return (
                  <button
                    key={variant.id}
                    onClick={() => handleVariantClick(variant)}
                    className="flex w-full items-center justify-between rounded-xl border border-outline-variant bg-surface p-3.5 text-left transition hover:border-primary hover:bg-primary/5"
                  >
                    <div>
                      <span className="text-sm font-bold text-on-surface">{variant.name}</span>
                      {isGroupWithSubmenu && (
                        <p className="mt-0.5 text-[11px] font-medium text-primary">
                          Opciones: Normal o Doble shot →
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-primary">
                        {currency(variant.price)}
                      </span>
                      {isGroupWithSubmenu && (
                        <span className="text-xs font-bold text-on-surface-variant">›</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedSizeGroup(null)}
                  className="mb-1 flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  ← Volver a tamaños
                </button>
                <h3 className="text-lg font-bold text-on-surface">
                  {product.name} — {groupLabel}
                </h3>
                <p className="text-xs text-on-surface-variant">Selecciona la preparación de tequila:</p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Opción 1: Normal */}
              <button
                type="button"
                onClick={() => handleSelectPreparation(false)}
                className="flex w-full items-center justify-between rounded-xl border border-outline-variant bg-surface p-4 text-left transition hover:border-primary hover:bg-primary/5"
              >
                <div>
                  <span className="text-base font-bold text-on-surface">Normal</span>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    1 shot de tequila ({tequilaNormalMl})
                  </p>
                </div>
                <span className="text-base font-bold text-primary">
                  {currency(activeNormal?.price ?? (selectedSizeGroup === "MEDIANO" ? 70 : 99))}
                </span>
              </button>

              {/* Opción 2: Doble shot (Shot extra en $0 por promoción actual) */}
              <button
                type="button"
                onClick={() => handleSelectPreparation(true)}
                className="flex w-full items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-left transition hover:border-amber-500 hover:bg-amber-500/20"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-on-surface">Doble shot</span>
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      Promoción · Shot extra $0
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    Doble shot de tequila ({tequilaDobleMl})
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                    {currency(activeDoble?.price ?? activeNormal?.price ?? (selectedSizeGroup === "MEDIANO" ? 70 : 99))}
                  </span>
                  {activeDoble?.price === activeNormal?.price && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">Sin costo extra</p>
                  )}
                </div>
              </button>
            </div>

            <div className="mt-4 border-t border-outline-variant pt-3">
              <button
                type="button"
                onClick={() => setSelectedSizeGroup(null)}
                className="w-full rounded-xl border border-outline-variant py-2.5 text-xs font-bold text-on-surface-variant hover:bg-surface"
              >
                ← Cambiar a otro tamaño
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
