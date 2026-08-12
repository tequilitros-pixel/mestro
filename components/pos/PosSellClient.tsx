"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PlusIcon,
  XIcon,
  TrashIcon,
  CashRegisterIcon,
  GridIcon,
  AlertIcon,
  CheckIcon,
  GearIcon,
  ReceiptIcon,
} from "@/components/ui/icons";
import { getProductVisual } from "@/lib/pos/productVisual";
import { useToast } from "@/components/ui/Toast";
import { enqueueOperation } from "@/lib/offline/queue";
import { syncOfflineQueue } from "@/lib/offline/sync";

type Variant = {
  id: string;
  name: string;
  price: number;
  active: boolean;
  employeePrice: number | null;
};

type Employee = { id: string; name: string };

type Product = {
  id: string;
  name: string;
  icon: string | null;
  active: boolean;
  variants: Variant[];
};

type Category = {
  id: string;
  name: string;
  active: boolean;
  products: Product[];
};

type BranchOption = {
  id: string;
  name: string;
  openCashCutId: string | null;
};

type LineDiscount = {
  kind: "DESCUENTO_NORMAL" | "CORTESIA";
  type: "PERCENT" | "AMOUNT";
  value: number;
  reason: string;
  reasonNote: string;
};

type CartLine =
  | {
      key: string;
      isCustom: false;
      variantId: string;
      productName: string;
      variantName: string;
      unitPrice: number;
      employeePrice: number | null;
      quantity: number;
      discount: LineDiscount | null;
    }
  | {
      key: string;
      isCustom: true;
      description: string;
      amount: number;
    };

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "CLIENTE_FRECUENTE", label: "Cliente frecuente" },
  { value: "PROMOCION", label: "Promoción" },
  { value: "COMPENSACION", label: "Compensación" },
  { value: "CONVENIO", label: "Convenio" },
  { value: "AUTORIZACION_GERENTE", label: "Autorización gerente" },
  { value: "CUMPLEANOS", label: "Cumpleaños" },
  { value: "EVENTO", label: "Evento" },
  { value: "INVITADO", label: "Invitado" },
  { value: "OTRO", label: "Otro" },
];

const QUICK_PERCENTS = [5, 10, 15, 20];

function effectiveUnitPrice(unitPrice: number, discount: LineDiscount | null): number {
  if (!discount) return unitPrice;
  if (discount.kind === "CORTESIA") return 0;
  const raw =
    discount.type === "PERCENT"
      ? unitPrice * (1 - discount.value / 100)
      : unitPrice - discount.value;
  return Math.max(0, Math.round(raw * 100) / 100);
}

function employeePriceFor(line: CartLine & { isCustom: false }, employeeDiscountPercent: number) {
  const raw = line.employeePrice ?? line.unitPrice * (1 - employeeDiscountPercent / 100);
  return Math.max(0, Math.round(raw * 100) / 100);
}

// El precio de empleado y un descuento manual nunca se combinan: si
// el cajero ya puso un descuento a esa línea, se respeta ese y no se
// vuelve a aplicar el beneficio de empleado encima.
function lineUnitPrice(
  line: CartLine & { isCustom: false },
  employeeMode: boolean,
  employeeDiscountPercent: number,
): number {
  if (line.discount) return effectiveUnitPrice(line.unitPrice, line.discount);
  if (employeeMode) return employeePriceFor(line, employeeDiscountPercent);
  return line.unitPrice;
}

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "DIDI", label: "DiDi" },
  { value: "UBER", label: "Uber" },
  { value: "RAPPI", label: "Rappi" },
  { value: "VALES", label: "Vales" },
  { value: "OTRO", label: "Otro" },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    value,
  );

export default function PosSellClient({
  branchOptions,
  canManageCatalog,
}: {
  branchOptions: BranchOption[];
  canManageCatalog: boolean;
}) {
  const [branchId, setBranchId] = useState(branchOptions[0]?.id ?? "");
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [variantPicker, setVariantPicker] = useState<Product | null>(null);
  const [showKeypad, setShowKeypad] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReasonCode, setDiscountReasonCode] = useState("");
  const [discountReasonNote, setDiscountReasonNote] = useState("");
  const [itemDiscountKey, setItemDiscountKey] = useState<string | null>(null);
  const [itemDiscountInitialKind, setItemDiscountInitialKind] = useState<
    "DESCUENTO_NORMAL" | "CORTESIA"
  >("DESCUENTO_NORMAL");
  const [employeeMode, setEmployeeMode] = useState(false);
  const [employeeBuyerId, setEmployeeBuyerId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeDiscountPercent, setEmployeeDiscountPercent] = useState(50);
  const [discountLimitPercent, setDiscountLimitPercent] = useState<number | null>(null);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [localOpenBranches, setLocalOpenBranches] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    window.setTimeout(() => {
      const open = new Set(branchOptions.filter((branch) => localStorage.getItem(`maestro:open-cash-cut:${branch.id}`)).map((branch) => branch.id));
      if (!cancelled) setLocalOpenBranches(open);
    }, 0);
    const cachedCatalog = localStorage.getItem("maestro:pos-catalog");
    if (cachedCatalog) {
      window.setTimeout(() => {
        try {
          const data = JSON.parse(cachedCatalog) as Category[];
          if (!cancelled) {
            setCategories(data);
            setActiveCategoryId(data[0]?.id ?? null);
          }
        } catch {
          localStorage.removeItem("maestro:pos-catalog");
        }
      }, 0);
    }

    fetch("/api/pos/products")
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo cargar el catálogo.");
        return r.json();
      })
      .then((data: Category[]) => {
        if (cancelled) return;
        setCategories(data);
        setActiveCategoryId(data[0]?.id ?? null);
        localStorage.setItem("maestro:pos-catalog", JSON.stringify(data));
      })
      .catch((err) => {
        if (cancelled) return;
        if (!cachedCatalog) setLoadError(err.message ?? "Error al cargar el catálogo.");
      });

    fetch("/api/pos/employees")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            employees: Employee[];
            employeeDiscountPercent: number;
            discountLimitPercent: number | null;
            managers: Employee[];
          } | null,
        ) => {
          if (cancelled || !data) return;
          setEmployees(data.employees);
          setEmployeeDiscountPercent(data.employeeDiscountPercent);
          setDiscountLimitPercent(data.discountLimitPercent);
          setManagers(data.managers);
        },
      )
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [branchOptions]);

  const branch = branchOptions.find((b) => b.id === branchId) ?? null;
  const hasOpenCut = Boolean(branch?.openCashCutId) || localOpenBranches.has(branchId);

  const activeCategory = categories?.find((c) => c.id === activeCategoryId) ?? null;

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, line) =>
          sum +
          (line.isCustom
            ? line.amount
            : lineUnitPrice(line, employeeMode, employeeDiscountPercent) * line.quantity),
        0,
      ),
    [cart, employeeMode, employeeDiscountPercent],
  );

  const clampedDiscount = Math.min(Math.max(discountAmount, 0), subtotal);
  const total = subtotal - clampedDiscount;

  // Refleja del lado del cliente el mismo cálculo que hace el
  // servidor, solo para decidir si mostrar de una vez el campo de
  // autorización — el servidor sigue siendo quien valida de verdad.
  const needsAuthorization = useMemo(() => {
    if (discountLimitPercent === null) return false;

    const itemOverLimit = cart.some((line) => {
      if (line.isCustom || !line.discount) return false;
      const finalPrice = effectiveUnitPrice(line.unitPrice, line.discount);
      if (line.unitPrice <= 0) return false;
      const pct = ((line.unitPrice - finalPrice) / line.unitPrice) * 100;
      return pct > discountLimitPercent;
    });

    const salePct = subtotal > 0 ? (clampedDiscount / subtotal) * 100 : 0;
    const saleOverLimit = clampedDiscount > 0 && salePct > discountLimitPercent;

    return itemOverLimit || saleOverLimit;
  }, [cart, discountLimitPercent, subtotal, clampedDiscount]);

  function addVariant(product: Product, variant: Variant) {
    setCart((prev) => {
      const key = `variant:${variant.id}`;
      const existing = prev.find((l) => !l.isCustom && l.key === key);
      if (existing && !existing.isCustom) {
        return prev.map((l) =>
          l.key === key && !l.isCustom
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        );
      }
      return [
        ...prev,
        {
          key,
          isCustom: false,
          variantId: variant.id,
          productName: product.name,
          variantName: variant.name,
          unitPrice: variant.price,
          employeePrice: variant.employeePrice,
          quantity: 1,
          discount: null,
        },
      ];
    });
  }

  function setLineDiscount(key: string, discount: LineDiscount | null) {
    setCart((prev) =>
      prev.map((l) => (l.key === key && !l.isCustom ? { ...l, discount } : l)),
    );
  }

  function handleProductClick(product: Product) {
    const activeVariants = product.variants.filter((v) => v.active);
    if (activeVariants.length === 0) return;
    if (activeVariants.length === 1) {
      addVariant(product, activeVariants[0]);
      return;
    }
    setVariantPicker(product);
  }

  function changeQuantity(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.key === key && !l.isCustom
            ? { ...l, quantity: l.quantity + delta }
            : l,
        )
        .filter((l) => l.isCustom || l.quantity > 0),
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  function addCustomCharge(description: string, amount: number) {
    setCart((prev) => [
      ...prev,
      { key: `custom:${Date.now()}`, isCustom: true, description, amount },
    ]);
    setShowKeypad(false);
  }

  function resetSale() {
    setCart([]);
    setDiscountAmount(0);
    setDiscountReasonCode("");
    setDiscountReasonNote("");
    setEmployeeMode(false);
    setEmployeeBuyerId("");
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
      <div className="flex flex-1 flex-col overflow-hidden border-b border-outline-variant lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant p-4">
          <div className="flex items-center gap-2">
            <CashRegisterIcon className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-on-surface">Punto de Venta</h1>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
            >
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {canManageCatalog && (
              <Link
                href="/pos/products"
                className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-on-surface"
              >
                <GearIcon className="h-4 w-4" />
                Catálogo
              </Link>
            )}

            {canManageCatalog && (
              <Link
                href="/pos/settings"
                className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-on-surface"
              >
                Configuración
              </Link>
            )}

            <Link
              href="/pos/sales"
              className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-on-surface"
            >
              <ReceiptIcon className="h-4 w-4" />
              Ventas
            </Link>
          </div>
        </div>

        {!hasOpenCut && branch && (
          <div className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-secondary/30 bg-secondary/10 p-4">
            <AlertIcon className="h-5 w-5 shrink-0 text-secondary" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-on-surface">
                {branch.name} no tiene un corte de caja abierto.
              </p>
              <p className="text-xs text-on-surface-variant">
                Ábrelo antes de cobrar en esta sucursal.
              </p>
            </div>
            <Link
              href="/cash-cuts/daily/new"
              className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-on-primary transition hover:scale-[1.04]"
            >
              Abrir corte
            </Link>
          </div>
        )}

        {loadError && (
          <div className="mx-4 mt-4 rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-error">
            {loadError}
          </div>
        )}

        {categories && categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-b border-outline-variant p-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeCategoryId === cat.id
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {categories && categories.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <GridIcon className="h-8 w-8 text-on-surface-variant" />
              <p className="text-sm text-on-surface-variant">
                Aún no hay categorías ni productos en el catálogo.
              </p>
              {canManageCatalog && (
                <Link
                  href="/pos/categories"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Crear la primera categoría
                </Link>
              )}
            </div>
          )}

          {activeCategory && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {activeCategory.products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className="flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container/60 text-left transition hover:border-primary/40 hover:scale-[1.02]"
                >
                  {(() => {
                    const visual = getProductVisual(product.icon);
                    return visual.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={visual.url}
                        alt={product.name}
                        className="h-20 w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-20 w-full items-center justify-center text-lg font-bold text-white/90"
                        style={{ backgroundColor: visual.hex }}
                      >
                        {product.name.slice(0, 1).toUpperCase()}
                      </div>
                    );
                  })()}
                  <div className="flex flex-1 flex-col items-start justify-between gap-1 p-3">
                    <span className="text-sm font-semibold text-on-surface">
                      {product.name}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {product.variants.filter((v) => v.active).length > 1
                        ? "Varias opciones"
                        : formatCurrency(product.variants[0]?.price ?? 0)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-outline-variant p-4">
          <button
            onClick={() => setShowKeypad(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant py-3 text-sm font-semibold text-on-surface-variant transition hover:border-primary hover:text-on-surface"
          >
            <PlusIcon className="h-4 w-4" />
            Cobro personalizado
          </button>
        </div>
      </div>

      <div className="flex w-full flex-col lg:w-96">
        <div className="flex items-center justify-between border-b border-outline-variant p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant">
            Carrito
          </h2>
          {cart.length > 0 && (
            <button
              onClick={resetSale}
              className="text-xs font-semibold text-on-surface-variant hover:text-error"
            >
              Vaciar
            </button>
          )}
        </div>

        <div className="space-y-2 border-b border-outline-variant p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            <input
              type="checkbox"
              checked={employeeMode}
              onChange={(e) => {
                setEmployeeMode(e.target.checked);
                if (!e.target.checked) setEmployeeBuyerId("");
              }}
              className="h-4 w-4"
            />
            Venta a empleado
          </label>

          {employeeMode && (
            <select
              value={employeeBuyerId}
              onChange={(e) => setEmployeeBuyerId(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
            >
              <option value="">Selecciona un empleado</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 && (
            <p className="text-center text-sm text-on-surface-variant">
              Toca un producto para agregarlo.
            </p>
          )}

          <div className="space-y-2">
            {cart.map((line) => {
              const finalUnitPrice = !line.isCustom
                ? lineUnitPrice(line, employeeMode, employeeDiscountPercent)
                : null;
              const hasEmployeeBenefit =
                !line.isCustom && !line.discount && employeeMode && finalUnitPrice !== line.unitPrice;

              return (
                <div
                  key={line.key}
                  className="rounded-xl border border-outline-variant bg-surface-container/60 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-on-surface">
                        {line.isCustom ? line.description : line.productName}
                      </p>
                      {!line.isCustom && line.variantName !== "Único" && (
                        <p className="text-xs text-on-surface-variant">
                          {line.variantName}
                        </p>
                      )}
                      {line.isCustom ? (
                        <p className="text-xs text-on-surface-variant">
                          {formatCurrency(line.amount)}
                        </p>
                      ) : line.discount?.kind === "CORTESIA" ? (
                        <p className="text-xs">
                          <span className="text-on-surface-variant line-through">
                            {formatCurrency(line.unitPrice)}
                          </span>{" "}
                          <span className="rounded-full bg-secondary/15 px-2 py-0.5 font-bold text-secondary">
                            CORTESÍA
                          </span>
                        </p>
                      ) : line.discount || hasEmployeeBenefit ? (
                        <p className="text-xs">
                          <span className="text-on-surface-variant line-through">
                            {formatCurrency(line.unitPrice)}
                          </span>{" "}
                          <span className="font-semibold text-tertiary-fixed-dim">
                            {formatCurrency(finalUnitPrice!)} c/u
                          </span>
                          {hasEmployeeBenefit && !line.discount && (
                            <span className="ml-1 text-on-surface-variant">(empleado)</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-on-surface-variant">
                          {formatCurrency(line.unitPrice)} c/u
                        </p>
                      )}
                    </div>

                    {line.isCustom ? (
                      <button
                        onClick={() => removeLine(line.key)}
                        className="shrink-0 rounded-lg p-2 text-on-surface-variant transition hover:bg-error/10 hover:text-error"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={() => changeQuantity(line.key, -1)}
                          className="h-7 w-7 rounded-lg border border-outline-variant text-sm font-bold text-on-surface transition hover:border-primary"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-semibold text-on-surface">
                          {line.quantity}
                        </span>
                        <button
                          onClick={() => changeQuantity(line.key, 1)}
                          className="h-7 w-7 rounded-lg border border-outline-variant text-sm font-bold text-on-surface transition hover:border-primary"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>

                  {!line.isCustom && (
                    <div className="mt-1.5 flex items-center gap-3">
                      <button
                        onClick={() => {
                          setItemDiscountInitialKind("DESCUENTO_NORMAL");
                          setItemDiscountKey(line.key);
                        }}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        {line.discount?.kind === "CORTESIA"
                          ? "Editar cortesía"
                          : line.discount
                            ? "Editar descuento"
                            : "Aplicar descuento"}
                      </button>
                      {!line.discount && (
                        <button
                          onClick={() => {
                            setItemDiscountInitialKind("CORTESIA");
                            setItemDiscountKey(line.key);
                          }}
                          className="text-xs font-semibold text-secondary hover:underline"
                        >
                          Marcar como cortesía
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 border-t border-outline-variant p-4">
          <button
            onClick={() => setShowDiscount(true)}
            className="w-full text-left text-xs font-semibold text-primary hover:underline"
          >
            {clampedDiscount > 0
              ? `Descuento aplicado: −${formatCurrency(clampedDiscount)}`
              : "Aplicar descuento"}
          </button>

          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-on-surface-variant">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {clampedDiscount > 0 && (
              <div className="flex justify-between text-on-surface-variant">
                <span>Descuento</span>
                <span>−{formatCurrency(clampedDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-on-surface">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <button
            disabled={cart.length === 0 || !hasOpenCut || (employeeMode && !employeeBuyerId)}
            onClick={() => setShowPayment(true)}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cobrar {cart.length > 0 ? formatCurrency(total) : ""}
          </button>
          {employeeMode && !employeeBuyerId && (
            <p className="text-center text-xs text-secondary">
              Selecciona qué empleado está comprando.
            </p>
          )}
        </div>
      </div>

      {variantPicker && (
        <VariantPickerModal
          product={variantPicker}
          onSelect={(variant) => {
            addVariant(variantPicker, variant);
            setVariantPicker(null);
          }}
          onClose={() => setVariantPicker(null)}
        />
      )}

      {showKeypad && (
        <CustomChargeModal
          onAdd={addCustomCharge}
          onClose={() => setShowKeypad(false)}
        />
      )}

      {showDiscount && (
        <DiscountModal
          subtotal={subtotal}
          initialAmount={discountAmount}
          initialReasonCode={discountReasonCode}
          initialReasonNote={discountReasonNote}
          onApply={(amount, reasonCode, reasonNote) => {
            setDiscountAmount(amount);
            setDiscountReasonCode(reasonCode);
            setDiscountReasonNote(reasonNote);
            setShowDiscount(false);
          }}
          onClose={() => setShowDiscount(false)}
        />
      )}

      {itemDiscountKey &&
        (() => {
          const line = cart.find((l) => l.key === itemDiscountKey);
          if (!line || line.isCustom) return null;
          return (
            <ItemDiscountModal
              productLabel={
                line.variantName !== "Único"
                  ? `${line.productName} (${line.variantName})`
                  : line.productName
              }
              unitPrice={line.unitPrice}
              initialDiscount={line.discount}
              initialKind={itemDiscountInitialKind}
              onApply={(discount) => {
                setLineDiscount(itemDiscountKey, discount);
                setItemDiscountKey(null);
              }}
              onClose={() => setItemDiscountKey(null)}
            />
          );
        })()}

      {showPayment && branch && (
        <PaymentModal
          total={total}
          branchId={branch.id}
          cart={cart}
          discountAmount={clampedDiscount}
          discountReasonCode={discountReasonCode}
          discountReasonNote={discountReasonNote}
          employeeBuyerId={employeeMode ? employeeBuyerId : ""}
          needsAuthorization={needsAuthorization}
          managers={managers}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false);
            resetSale();
            showToast("Venta registrada correctamente.");
          }}
        />
      )}
    </div>
  );
}

function VariantPickerModal({
  product,
  onSelect,
  onClose,
}: {
  product: Product;
  onSelect: (variant: Variant) => void;
  onClose: () => void;
}) {
  return (
    <ModalShell title={product.name} onClose={onClose}>
      <div className="space-y-2">
        {product.variants
          .filter((v) => v.active)
          .map((variant) => (
            <button
              key={variant.id}
              onClick={() => onSelect(variant)}
              className="flex w-full items-center justify-between rounded-xl border border-outline-variant p-3 text-left transition hover:border-primary"
            >
              <span className="text-sm font-semibold text-on-surface">
                {variant.name}
              </span>
              <span className="text-sm text-on-surface-variant">
                {formatCurrency(variant.price)}
              </span>
            </button>
          ))}
      </div>
    </ModalShell>
  );
}

function CustomChargeModal({
  onAdd,
  onClose,
}: {
  onAdd: (description: string, amount: number) => void;
  onClose: () => void;
}) {
  const [amountStr, setAmountStr] = useState("0");
  const [description, setDescription] = useState("");

  function pressKey(key: string) {
    setAmountStr((prev) => {
      if (key === "back") return prev.length > 1 ? prev.slice(0, -1) : "0";
      if (key === ".") return prev.includes(".") ? prev : `${prev}.`;
      if (prev === "0") return key;
      return prev + key;
    });
  }

  const amount = Number(amountStr) || 0;
  const canAdd = amount > 0 && description.trim().length > 0;

  return (
    <ModalShell title="Cobro personalizado" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-center text-3xl font-bold text-on-surface">
          {formatCurrency(amount)}
        </p>

        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción (obligatoria)"
          className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        />

        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map(
            (key) => (
              <button
                key={key}
                onClick={() => pressKey(key)}
                className="rounded-xl border border-outline-variant py-3 text-lg font-semibold text-on-surface transition hover:border-primary"
              >
                {key === "back" ? "⌫" : key}
              </button>
            ),
          )}
        </div>

        <button
          disabled={!canAdd}
          onClick={() => onAdd(description.trim(), amount)}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-on-primary transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Agregar al carrito
        </button>
      </div>
    </ModalShell>
  );
}

function ReasonFields({
  reasonCode,
  setReasonCode,
  reasonNote,
  setReasonNote,
}: {
  reasonCode: string;
  setReasonCode: (v: string) => void;
  reasonNote: string;
  setReasonNote: (v: string) => void;
}) {
  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
          Motivo
        </label>
        <select
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value)}
          className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        >
          <option value="">Selecciona un motivo</option>
          {REASON_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
          {reasonCode === "OTRO" ? "Escribe el motivo" : "Descripción (opcional)"}
        </label>
        <input
          value={reasonNote}
          onChange={(e) => setReasonNote(e.target.value)}
          className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
        />
      </div>
    </>
  );
}

function DiscountModal({
  subtotal,
  initialAmount,
  initialReasonCode,
  initialReasonNote,
  onApply,
  onClose,
}: {
  subtotal: number;
  initialAmount: number;
  initialReasonCode: string;
  initialReasonNote: string;
  onApply: (amount: number, reasonCode: string, reasonNote: string) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(initialAmount || 0);
  const [reasonCode, setReasonCode] = useState(initialReasonCode);
  const [reasonNote, setReasonNote] = useState(initialReasonNote);

  const canApply =
    amount > 0 ? Boolean(reasonCode) && (reasonCode !== "OTRO" || reasonNote.trim().length > 0) : true;

  return (
    <ModalShell title="Descuento" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
            Monto de descuento
          </label>
          <input
            type="number"
            min={0}
            max={subtotal}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
          <p className="mt-1 text-xs text-on-surface-variant">
            Máximo {formatCurrency(subtotal)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_PERCENTS.map((pct) => (
            <button
              key={pct}
              onClick={() => setAmount(Math.round(subtotal * (pct / 100) * 100) / 100)}
              className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:border-primary"
            >
              {pct}%
            </button>
          ))}
        </div>

        {amount > 0 && (
          <ReasonFields
            reasonCode={reasonCode}
            setReasonCode={setReasonCode}
            reasonNote={reasonNote}
            setReasonNote={setReasonNote}
          />
        )}

        <div className="flex gap-2">
          <button
            onClick={() => onApply(0, "", "")}
            className="flex-1 rounded-xl border border-outline-variant py-3 text-sm font-semibold text-on-surface-variant transition hover:border-error hover:text-error"
          >
            Quitar
          </button>
          <button
            disabled={!canApply}
            onClick={() =>
              onApply(Math.min(Math.max(amount, 0), subtotal), reasonCode, reasonNote)
            }
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Aplicar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ItemDiscountModal({
  productLabel,
  unitPrice,
  initialDiscount,
  initialKind,
  onApply,
  onClose,
}: {
  productLabel: string;
  unitPrice: number;
  initialDiscount: LineDiscount | null;
  initialKind: "DESCUENTO_NORMAL" | "CORTESIA";
  onApply: (discount: LineDiscount | null) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"DESCUENTO_NORMAL" | "CORTESIA">(
    initialDiscount?.kind ?? initialKind,
  );
  const [type, setType] = useState<"PERCENT" | "AMOUNT">(initialDiscount?.type ?? "PERCENT");
  const [value, setValue] = useState(initialDiscount?.value ?? 0);
  const [reasonCode, setReasonCode] = useState(initialDiscount?.reason ?? "");
  const [reasonNote, setReasonNote] = useState(initialDiscount?.reasonNote ?? "");

  const isCortesia = kind === "CORTESIA";
  const finalPrice = isCortesia
    ? 0
    : effectiveUnitPrice(
        unitPrice,
        value > 0 ? { kind, type, value, reason: reasonCode, reasonNote } : null,
      );

  const canApply = isCortesia
    ? Boolean(reasonCode) && (reasonCode !== "OTRO" || reasonNote.trim().length > 0)
    : value > 0
      ? Boolean(reasonCode) && (reasonCode !== "OTRO" || reasonNote.trim().length > 0)
      : true;

  return (
    <ModalShell title={`${isCortesia ? "Cortesía" : "Descuento"} — ${productLabel}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-container-high p-3 text-center">
          <p className="text-xs text-on-surface-variant">Precio original</p>
          <p className="text-lg font-bold text-on-surface">{formatCurrency(unitPrice)}</p>
          {(isCortesia || value > 0) && (
            <p className="mt-1 text-sm font-semibold text-tertiary-fixed-dim">
              Precio final: {formatCurrency(finalPrice)}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setKind("DESCUENTO_NORMAL")}
            className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${
              kind === "DESCUENTO_NORMAL"
                ? "border-primary bg-primary/10 text-primary"
                : "border-outline-variant text-on-surface-variant"
            }`}
          >
            Descuento
          </button>
          <button
            onClick={() => setKind("CORTESIA")}
            className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${
              kind === "CORTESIA"
                ? "border-secondary bg-secondary/10 text-secondary"
                : "border-outline-variant text-on-surface-variant"
            }`}
          >
            Cortesía
          </button>
        </div>

        {isCortesia ? (
          <p className="rounded-xl border border-secondary/30 bg-secondary/10 p-3 text-xs text-on-surface-variant">
            El producto se entrega sin costo. El inventario se descuenta igual que cualquier
            venta — solo cambia que no se cobra.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => setType("PERCENT")}
                className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${
                  type === "PERCENT"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant text-on-surface-variant"
                }`}
              >
                Porcentaje
              </button>
              <button
                onClick={() => setType("AMOUNT")}
                className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${
                  type === "AMOUNT"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant text-on-surface-variant"
                }`}
              >
                Cantidad fija
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-on-surface-variant">
                {type === "PERCENT" ? "Porcentaje de descuento" : "Monto de descuento"}
              </label>
              <input
                type="number"
                min={0}
                max={type === "PERCENT" ? 100 : unitPrice}
                step="0.01"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
              />
            </div>

            {type === "PERCENT" && (
              <div className="flex flex-wrap gap-2">
                {QUICK_PERCENTS.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setValue(pct)}
                    className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:border-primary"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {(isCortesia || value > 0) && (
          <ReasonFields
            reasonCode={reasonCode}
            setReasonCode={setReasonCode}
            reasonNote={reasonNote}
            setReasonNote={setReasonNote}
          />
        )}

        <div className="flex gap-2">
          <button
            onClick={() => onApply(null)}
            className="flex-1 rounded-xl border border-outline-variant py-3 text-sm font-semibold text-on-surface-variant transition hover:border-error hover:text-error"
          >
            Quitar
          </button>
          <button
            disabled={!canApply}
            onClick={() =>
              onApply(
                isCortesia
                  ? { kind: "CORTESIA", type: "PERCENT", value: 100, reason: reasonCode, reasonNote }
                  : value > 0
                    ? { kind: "DESCUENTO_NORMAL", type, value, reason: reasonCode, reasonNote }
                    : null,
              )
            }
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Aplicar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function PaymentModal({
  total,
  branchId,
  cart,
  discountAmount,
  discountReasonCode,
  discountReasonNote,
  employeeBuyerId,
  needsAuthorization,
  managers,
  onClose,
  onSuccess,
}: {
  total: number;
  branchId: string;
  cart: CartLine[];
  discountAmount: number;
  discountReasonCode: string;
  discountReasonNote: string;
  employeeBuyerId: string;
  needsAuthorization: boolean;
  managers: Employee[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isFree = total <= 0;
  const [rows, setRows] = useState<{ method: string; amount: number }[]>(
    isFree ? [] : [{ method: "EFECTIVO", amount: total }],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authManagerId, setAuthManagerId] = useState("");
  const [authPin, setAuthPin] = useState("");
  const authReady = !needsAuthorization || (Boolean(authManagerId) && authPin.length === 4);

  const paid = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const remaining = Math.round((total - paid) * 100) / 100;

  function updateRow(index: number, patch: Partial<{ method: string; amount: number }>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { method: "TARJETA", amount: Math.max(remaining, 0) },
    ]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);

    const salePayload = {
      branchId,
      discountAmount,
      discountReasonCode,
      discountReason: discountReasonNote,
      employeeBuyerId: employeeBuyerId || undefined,
      ...(needsAuthorization ? { authorization: { managerId: authManagerId, pin: authPin } } : {}),
      items: cart.map((line) =>
        line.isCustom
          ? { isCustom: true, description: line.description, amount: line.amount }
          : {
              variantId: line.variantId,
              quantity: line.quantity,
              ...(line.discount ? { discount: { ...line.discount } } : {}),
            },
      ),
      payments: isFree ? [] : rows.map((r) => ({ method: r.method, amount: Number(r.amount) })),
    };

    if (!navigator.onLine) {
      if (needsAuthorization) {
        setError("Las ventas que requieren autorización de gerente necesitan conexión.");
        setSubmitting(false);
        return;
      }
      await enqueueOperation({
        id: crypto.randomUUID(),
        kind: "pos.sale.create",
        payload: salePayload,
        createdAt: new Date().toISOString(),
      });
      onSuccess();
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/pos/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(salePayload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No fue posible completar el cobro.");
        setSubmitting(false);
        return;
      }

      onSuccess();
    } catch {
      if (needsAuthorization) {
        setError("No fue posible verificar la autorización. Revisa tu conexión.");
      } else {
        await enqueueOperation({ id: crypto.randomUUID(), kind: "pos.sale.create", payload: salePayload, createdAt: new Date().toISOString() });
        await syncOfflineQueue();
        onSuccess();
      }
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Cobrar" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-center text-3xl font-bold text-on-surface">
          {formatCurrency(total)}
        </p>

        {needsAuthorization && (
          <div className="space-y-3 rounded-xl border border-secondary/40 bg-secondary/10 p-3">
            <p className="text-xs font-semibold text-secondary">
              Este descuento/cortesía supera tu límite. Un gerente o administrador debe
              autorizarlo con su PIN en este dispositivo.
            </p>
            <select
              value={authManagerId}
              onChange={(e) => setAuthManagerId(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
            >
              <option value="">Selecciona quién autoriza</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="PIN de 4 dígitos"
              value={authPin}
              onChange={(e) => setAuthPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-center text-sm tracking-[0.5em] text-on-surface outline-none focus:border-primary"
            />
          </div>
        )}

        {isFree ? (
          <p className="rounded-xl border border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 p-3 text-center text-sm font-semibold text-tertiary-fixed-dim">
            Sin cobro — el descuento cubre el total de la venta.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {rows.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    value={row.method}
                    onChange={(e) => updateRow(index, { method: e.target.value })}
                    className="flex-1 rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => updateRow(index, { amount: Number(e.target.value) })}
                    className="w-28 rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                  />
                  {rows.length > 1 && (
                    <button
                      onClick={() => removeRow(index)}
                      className="rounded-lg p-2 text-on-surface-variant transition hover:bg-error/10 hover:text-error"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addRow}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-outline-variant py-2 text-xs font-semibold text-on-surface-variant transition hover:border-primary hover:text-on-surface"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Dividir pago
            </button>

            <div
              className={`flex items-center justify-between rounded-xl p-3 text-sm font-semibold ${
                Math.abs(remaining) < 0.01
                  ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"
                  : "bg-secondary/10 text-secondary"
              }`}
            >
              <span>{Math.abs(remaining) < 0.01 ? "Pago completo" : "Falta por cubrir"}</span>
              <span>{formatCurrency(Math.max(remaining, 0))}</span>
            </div>
          </>
        )}

        {error && (
          <p className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">
            {error}
          </p>
        )}

        <button
          disabled={(!isFree && Math.abs(remaining) >= 0.01) || submitting || !authReady}
          onClick={submit}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckIcon className="h-4 w-4" />
          {submitting ? "Cobrando..." : "Confirmar cobro"}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-dim/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-outline-variant bg-surface-container-high p-5 sm:max-w-md sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-on-surface">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
