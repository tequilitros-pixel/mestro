"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  AlertIcon,
  CheckIcon,
  CashRegisterIcon,
  ReceiptIcon,
  TrashIcon,
  XIcon,
  TagIcon,
} from "@/components/ui/icons";
import { getProductVisual } from "@/lib/pos/productVisual";
import { enqueueOperation } from "@/lib/offline/queue";
import {
  deleteLocalTableOrder,
  listLocalTableOrders,
  saveLocalTableOrder,
  type LocalTableLine,
  type LocalTableOrder,
} from "@/lib/offline/table-orders";
import PosVariantPickerModal from "@/components/pos/PosVariantPickerModal";
import PostSaleModal from "@/components/pos/PostSaleModal";
import type { ReceiptData } from "@/components/pos/ReceiptTicket";

type Variant = { id: string; name: string; price: number; active: boolean };
type Product = { id: string; name: string; icon: string | null; active: boolean; variants: Variant[] };
type Category = { id: string; name: string; active: boolean; products: Product[] };
type Branch = { id: string; name: string; openCashCutId: string | null };

const PAYMENT_METHODS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "DIDI", label: "DiDi" },
  { value: "UBER", label: "Uber" },
  { value: "RAPPI", label: "Rappi" },
  { value: "VALES", label: "Vales" },
  { value: "OTRO", label: "Otro" },
];

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "CORTESIA", label: "Cortesía de la casa / Gerencia" },
  { value: "CLIENTE_FRECUENTE", label: "Cliente frecuente / VIP" },
  { value: "PROMOCION", label: "Promoción de sucursal" },
  { value: "COMPENSACION", label: "Compensación / Atención a cliente" },
  { value: "CONVENIO", label: "Convenio comercial" },
  { value: "AUTORIZACION_GERENTE", label: "Autorización de gerente" },
  { value: "CUMPLEANOS", label: "Cumpleaños" },
  { value: "EVENTO", label: "Evento especial" },
  { value: "INVITADO", label: "Invitado especial" },
  { value: "OTRO", label: "Otro motivo" },
];

const QUICK_PERCENTS = [5, 10, 15, 20, 50];

const currency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

const TABLES = Array.from({ length: 16 }, (_, index) => ({
  id: `mesa-${index + 1}`,
  label: `Mesa ${index + 1}`,
}));

export default function PospressTablesClient({ branches }: { branches: Branch[] }) {
  const initialBranchId = branches[0]?.id ?? "";
  const [branchId, setBranchId] = useState(initialBranchId);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<LocalTableOrder[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [localOpenCut, setLocalOpenCut] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setIsOnline(navigator.onLine);
      if (initialBranchId) {
        setLocalOpenCut(Boolean(localStorage.getItem(`maestro:open-cash-cut:${initialBranchId}`)));
      }
    });

    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);

    void listLocalTableOrders()
      .then(setOrders)
      .catch(() => setLoadError("No se pudieron leer las mesas guardadas en este dispositivo."));

    const cachedCatalog = localStorage.getItem("maestro:pos-catalog");
    if (cachedCatalog) {
      try {
        const data = JSON.parse(cachedCatalog) as Category[];
        queueMicrotask(() => {
          if (cancelled) return;
          setCategories(data);
          setCategoryId(data[0]?.id ?? null);
        });
      } catch {
        localStorage.removeItem("maestro:pos-catalog");
      }
    }

    fetch("/api/pos/products")
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el catálogo.");
        return response.json();
      })
      .then((data: Category[]) => {
        setCategories(data);
        setCategoryId(data[0]?.id ?? null);
        localStorage.setItem("maestro:pos-catalog", JSON.stringify(data));
      })
      .catch((error) => {
        if (!cachedCatalog) setLoadError(error.message);
      });

    const changed = () => void listLocalTableOrders().then(setOrders);
    window.addEventListener("maestro:tables-changed", changed);

    return () => {
      cancelled = true;
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("maestro:tables-changed", changed);
    };
  }, [initialBranchId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLocalOpenCut(Boolean(branchId && localStorage.getItem(`maestro:open-cash-cut:${branchId}`)));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const branch = branches.find((item) => item.id === branchId) ?? null;
  const selectedTable = TABLES.find((table) => table.id === selectedTableId) ?? null;
  const activeOrder = orders.find((order) => order.branchId === branchId && order.tableId === selectedTableId) ?? null;
  const activeCategory = categories.find((category) => category.id === categoryId) ?? null;
  const total = activeOrder?.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) ?? 0;
  const hasOpenCut = Boolean(branch?.openCashCutId) || (!isOnline && localOpenCut);

  async function refreshOrders() {
    setOrders(await listLocalTableOrders());
  }

  async function addVariant(product: Product, variant: Variant) {
    if (!branch || !selectedTable) return;
    const current = activeOrder ?? {
      id: crypto.randomUUID(),
      branchId: branch.id,
      tableId: selectedTable.id,
      tableLabel: selectedTable.label,
      lines: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const key = `variant:${variant.id}`;
    const existing = current.lines.find((line) => line.key === key);
    const lines = existing
      ? current.lines.map((line) => (line.key === key ? { ...line, quantity: line.quantity + 1 } : line))
      : [
          ...current.lines,
          {
            key,
            variantId: variant.id,
            productName: product.name,
            variantName: variant.name,
            unitPrice: variant.price,
            quantity: 1,
          },
        ];
    await saveLocalTableOrder({ ...current, lines });
    await refreshOrders();
  }

  async function chooseProduct(product: Product) {
    const variants = product.variants.filter((variant) => variant.active);
    if (variants.length === 1) return addVariant(product, variants[0]);
    setVariantProduct(product);
  }

  async function changeQuantity(line: LocalTableLine, delta: number) {
    if (!activeOrder) return;
    const lines = activeOrder.lines
      .map((item) => (item.key === line.key ? { ...item, quantity: item.quantity + delta } : item))
      .filter((item) => item.quantity > 0);
    if (!lines.length) await deleteLocalTableOrder(activeOrder.id);
    else await saveLocalTableOrder({ ...activeOrder, lines });
    await refreshOrders();
  }

  async function closeTable() {
    if (!activeOrder) return;
    if (!window.confirm(`¿Cerrar ${activeOrder.tableLabel} sin cobrar? La cuenta se eliminará de este dispositivo.`))
      return;
    await deleteLocalTableOrder(activeOrder.id);
    await refreshOrders();
    setSelectedTableId(null);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">POSpress</p>
          <h1 className="text-3xl font-bold text-on-surface">Mesas y Cuentas</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Agrega rondas y consumos a una mesa, aplica descuentos o cortesías y cobra al instante.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/pospress"
            className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant hover:border-primary hover:text-on-surface"
          >
            Nueva venta
          </Link>
          <Link
            href="/pospress/pending-tabs"
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
          >
            Cuentas pendientes
          </Link>
          <Link
            href="/pospress/transactions"
            className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant hover:border-primary hover:text-on-surface"
          >
            <ReceiptIcon className="mr-1 inline h-4 w-4" />
            Transacciones
          </Link>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface-container p-3">
        {branches.length === 1 ? (
          <div className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3.5 py-2 text-sm font-bold text-on-surface">
            <span>📍</span>
            <span>{branches[0].name}</span>
            {branches[0].openCashCutId ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                Corte Activo
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                Sin Corte Abierto
              </span>
            )}
          </div>
        ) : (
          <select
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value);
              setSelectedTableId(null);
            }}
            className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface font-semibold"
          >
            {branches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        )}
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            isOnline ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim" : "bg-secondary/15 text-secondary"
          }`}
        >
          {isOnline ? "En línea" : "Sin conexión"}
        </span>
        <span className="text-sm font-medium text-on-surface-variant">
          {orders.filter((order) => order.branchId === branchId).length} cuentas abiertas
        </span>
      </section>

      {!hasOpenCut && branch && (
        <div className="flex items-center gap-3 rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-sm">
          <AlertIcon className="h-5 w-5 shrink-0 text-secondary" />
          <span className="flex-1 text-on-surface font-medium">Abre el corte de caja antes de cobrar una mesa.</span>
          <Link href="/cash-cuts/daily/new" className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary">
            Abrir corte
          </Link>
        </div>
      )}

      {loadError && (
        <p className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{loadError}</p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-on-surface-variant">Selecciona una mesa</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {TABLES.map((table) => {
              const order = orders.find((item) => item.branchId === branchId && item.tableId === table.id);
              const amount =
                order?.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) ?? 0;
              return (
                <button
                  key={table.id}
                  onClick={() => setSelectedTableId(table.id)}
                  className={`min-h-28 rounded-2xl border p-4 text-left transition ${
                    selectedTableId === table.id
                      ? "border-primary bg-primary/10 shadow-sm"
                      : order
                      ? "border-amber-500/40 bg-amber-500/10"
                      : "border-outline-variant bg-surface-container hover:border-primary/50"
                  }`}
                >
                  <span className="text-lg font-bold text-on-surface">{table.label}</span>
                  <span className="mt-2 block text-xs font-semibold text-on-surface-variant">
                    {order
                      ? `${order.lines.reduce((sum, line) => sum + line.quantity, 0)} artículos · ${currency(amount)}`
                      : "Libre"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Cuenta activa</p>
              <h2 className="text-xl font-bold text-on-surface">{selectedTable?.label ?? "Elige una mesa"}</h2>
            </div>
            {activeOrder && (
              <button
                onClick={() => void closeTable()}
                className="rounded-lg p-2 text-on-surface-variant hover:bg-error/10 hover:text-error"
                title="Cerrar cuenta sin cobrar"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          {!activeOrder ? (
            <p className="mt-8 text-center text-sm text-on-surface-variant">
              Selecciona una mesa para consultar su cuenta o empezar a agregar pedidos.
            </p>
          ) : (
            <>
              <div className="mt-4 space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {activeOrder.lines.map((line) => (
                  <div key={line.key} className="flex items-center justify-between gap-2 rounded-xl bg-surface p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-on-surface">{line.productName}</p>
                      {line.variantName !== "Único" && (
                        <p className="text-xs text-on-surface-variant">{line.variantName}</p>
                      )}
                      <p className="text-xs font-medium text-on-surface-variant">{currency(line.unitPrice)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => void changeQuantity(line, -1)}
                        className="h-7 w-7 rounded-lg border border-outline-variant font-bold text-on-surface hover:bg-surface-container"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm font-bold">{line.quantity}</span>
                      <button
                        onClick={() => void changeQuantity(line, 1)}
                        className="h-7 w-7 rounded-lg border border-outline-variant font-bold text-on-surface hover:bg-surface-container"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-outline-variant pt-3">
                <div className="flex justify-between text-lg font-bold text-on-surface">
                  <span>Subtotal consumido</span>
                  <span>{currency(total)}</span>
                </div>
                <button
                  disabled={!hasOpenCut || !activeOrder.lines.length}
                  onClick={() => setPaymentOpen(true)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary transition hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CashRegisterIcon className="h-4 w-4" />
                  Cobrar / Aplicar Descuento o Cortesía
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {selectedTable && (
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-on-surface">Agregar a {selectedTable.label}</h2>
              <p className="text-xs text-on-surface-variant">Agrega bebidas, platillos o botellas a esta mesa.</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setCategoryId(category.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    category.id === categoryId ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {activeCategory && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {activeCategory.products.map((product) => {
                const visual = getProductVisual(product.icon);
                return (
                  <button
                    key={product.id}
                    onClick={() => void chooseProduct(product)}
                    className="overflow-hidden rounded-xl border border-outline-variant bg-surface text-left transition hover:border-primary hover:shadow-xs"
                  >
                    {visual.type === "image" ? (
                      <Image
                        unoptimized
                        width={240}
                        height={64}
                        src={visual.url}
                        alt={product.name}
                        className="h-16 w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-16 items-center justify-center text-lg font-bold text-white"
                        style={{ backgroundColor: visual.hex }}
                      >
                        {product.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="p-2">
                      <p className="truncate text-xs font-bold text-on-surface">{product.name}</p>
                      <p className="text-[11px] font-semibold text-on-surface-variant">
                        {product.variants.length > 1
                          ? "Varias opciones"
                          : currency(product.variants[0]?.price ?? 0)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {variantProduct && (
        <PosVariantPickerModal
          product={variantProduct}
          formatPrice={currency}
          onSelect={(variant) => {
            void addVariant(variantProduct, variant);
            setVariantProduct(null);
          }}
          onClose={() => setVariantProduct(null)}
        />
      )}

      {paymentOpen && activeOrder && (
        <TablePaymentModal
          subtotal={total}
          branchId={branchId}
          branchName={branch?.name ?? "Sucursal"}
          order={activeOrder}
          isOnline={isOnline}
          onClose={() => setPaymentOpen(false)}
          onSuccess={async (receipt) => {
            await deleteLocalTableOrder(activeOrder.id);
            await refreshOrders();
            setSelectedTableId(null);
            setPaymentOpen(false);
            if (receipt) setCompletedReceipt(receipt);
          }}
        />
      )}

      {completedReceipt && (
        <PostSaleModal
          receipt={completedReceipt}
          onClose={() => setCompletedReceipt(null)}
        />
      )}
    </main>
  );
}

function TablePaymentModal({
  subtotal,
  branchId,
  branchName,
  order,
  isOnline,
  onClose,
  onSuccess,
}: {
  subtotal: number;
  branchId: string;
  branchName: string;
  order: LocalTableOrder;
  isOnline: boolean;
  onClose: () => void;
  onSuccess: (receipt?: ReceiptData) => Promise<void>;
}) {
  const [method, setMethod] = useState("EFECTIVO");
  const [discountType, setDiscountType] = useState<"NONE" | "PERCENT" | "AMOUNT" | "CORTESIA">("NONE");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReasonCode, setDiscountReasonCode] = useState("");
  const [discountReasonNote, setDiscountReasonNote] = useState("");
  const [configuredDiscounts, setConfiguredDiscounts] = useState<
    Array<{ id: string; name: string; percent: number }>
  >([]);
  const [discountBlockedBy, setDiscountBlockedBy] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationId] = useState(() => crypto.randomUUID());
  const [createdAt] = useState(() => new Date().toISOString());

  // Cargar reglas configuradas de descuento de la sucursal (mismas del Punto de Venta)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pos/discount-rules?branchId=${encodeURIComponent(branchId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setDiscountBlockedBy(data.blockedBy ?? null);
        setConfiguredDiscounts(data.discounts?.filter((r: any) => typeof r.percent === "number") ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  // Cálculo del descuento
  let discountAmount = 0;
  if (discountType === "CORTESIA") {
    discountAmount = subtotal;
  } else if (discountType === "PERCENT") {
    discountAmount = Math.round(subtotal * (discountValue / 100) * 100) / 100;
  } else if (discountType === "AMOUNT") {
    discountAmount = Math.round(discountValue * 100) / 100;
  }
  discountAmount = Math.min(Math.max(discountAmount, 0), subtotal);
  const finalTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  const isFree = finalTotal <= 0;

  const [cashTendered, setCashTendered] = useState<string>("");

  function applyPresetDiscount(percent: number, name?: string) {
    setDiscountType("PERCENT");
    setDiscountValue(percent);
    if (!discountReasonCode) setDiscountReasonCode("PROMOCION");
    if (name && !discountReasonNote) setDiscountReasonNote(name);
  }

  function applyCortesia() {
    setDiscountType("CORTESIA");
    setDiscountValue(100);
    setDiscountReasonCode("CORTESIA");
    if (!discountReasonNote) setDiscountReasonNote(`Cortesía en ${order.tableLabel}`);
  }

  function clearDiscount() {
    setDiscountType("NONE");
    setDiscountValue(0);
    setDiscountReasonCode("");
    setDiscountReasonNote("");
  }

  async function submit() {
    if (discountType !== "NONE" && discountAmount > 0) {
      if (!discountReasonCode) {
        setError("Por favor selecciona el motivo del descuento o cortesía.");
        return;
      }
      if (discountReasonCode === "OTRO" && !discountReasonNote.trim()) {
        setError("Escribe una breve descripción del motivo.");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    const paid = isFree ? 0 : finalTotal;
    const tenderedNumber = Number(cashTendered);
    const change = method === "EFECTIVO" && tenderedNumber > paid ? tenderedNumber - paid : 0;

    const payload = {
      clientOperationId: operationId,
      clientCreatedAt: createdAt,
      displayTotal: finalTotal,
      subtotal,
      discountAmount,
      discountReasonCode: discountAmount > 0 ? discountReasonCode : undefined,
      discountReason: discountAmount > 0 ? discountReasonNote : undefined,
      branchId,
      inventoryMode: "v2" as const,
      tableId: order.tableId,
      tableLabel: order.tableLabel,
      items: order.lines.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
      })),
      payments: isFree ? [] : [{ method, amount: paid }],
    };

    const receiptData: ReceiptData = {
      saleId: operationId,
      saleCode: `MESA-${order.tableLabel.replace(/\s+/g, "")}-${operationId.slice(0, 6).toUpperCase()}`,
      branchName,
      branchAddress: null,
      date: new Date().toLocaleTimeString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      cashierName: null,
      items: order.lines.map((l) => ({
        name: `${l.productName} (${order.tableLabel})`,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.quantity * l.unitPrice,
      })),
      subtotal,
      discountAmount,
      total: finalTotal,
      payments: isFree ? [] : [{ method, amount: paid }],
      cashReceived: method === "EFECTIVO" && tenderedNumber > 0 ? tenderedNumber : undefined,
      change: change > 0 ? change : undefined,
      isOffline: !navigator.onLine,
    };

    try {
      if (!navigator.onLine) {
        await enqueueOperation({
          id: operationId,
          kind: "pos.sale.create",
          payload,
          createdAt,
        });
        await onSuccess(receiptData);
        return;
      }

      const response = await fetch("/api/pos/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? data?.message ?? "No fue posible cobrar la mesa.");
      }

      if (data?.id) receiptData.saleId = data.id;
      if (data?.code) receiptData.saleCode = data.code;

      await onSuccess(receiptData);
    } catch (caught) {
      if (caught instanceof TypeError || !navigator.onLine) {
        try {
          await enqueueOperation({
            id: operationId,
            kind: "pos.sale.create",
            payload,
            createdAt,
          });
          await onSuccess(receiptData);
          return;
        } catch {
          // fallback
        }
      }
      setError(caught instanceof Error ? caught.message : "No fue posible guardar el cobro.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-dim/75 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg max-h-[95vh] overflow-y-auto rounded-t-2xl border border-outline-variant bg-surface-container-high p-5 sm:rounded-2xl shadow-2xl">
        <div className="mb-3 flex items-center justify-between border-b border-outline-variant pb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">{order.tableLabel}</p>
            <h2 className="text-xl font-bold text-on-surface">Cobro y Liquidación</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Resumen de Montos */}
        <div className="rounded-xl border border-outline-variant bg-surface-container p-3 mb-4 space-y-1">
          <div className="flex justify-between text-sm text-on-surface-variant">
            <span>Subtotal de consumo ({order.lines.reduce((s, l) => s + l.quantity, 0)} artículos):</span>
            <span className="font-semibold">{currency(subtotal)}</span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="inline-flex items-center gap-1">
                <TagIcon className="h-3.5 w-3.5" />
                Descuento / Cortesía ({discountType === "CORTESIA" ? "100%" : discountType === "PERCENT" ? `${discountValue}%` : currency(discountValue)}):
              </span>
              <span>−{currency(discountAmount)}</span>
            </div>
          )}

          <div className="flex justify-between text-2xl font-black text-on-surface pt-2 border-t border-outline-variant">
            <span>Total a pagar:</span>
            <span className={isFree ? "text-emerald-600 dark:text-emerald-400" : "text-primary"}>
              {currency(finalTotal)}
            </span>
          </div>
        </div>

        {/* SECCIÓN DE DESCUENTOS Y CORTESÍAS */}
        <div className="rounded-xl border border-outline-variant bg-surface p-3 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
              <TagIcon className="h-3.5 w-3.5 text-primary" />
              Aplicar Descuento o Cortesía
            </span>
            {discountType !== "NONE" && (
              <button
                type="button"
                onClick={clearDiscount}
                className="text-xs font-bold text-error hover:underline"
              >
                Quitar descuento
              </button>
            )}
          </div>

          {/* Botón Destacado de Cortesía */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={applyCortesia}
              className={`rounded-xl py-2 px-3 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                discountType === "CORTESIA"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "border border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20"
              }`}
            >
              <span>🎁</span>
              Cortesía 100% ($0.00)
            </button>

            <button
              type="button"
              onClick={() => {
                if (discountType === "PERCENT") setDiscountType("AMOUNT");
                else setDiscountType("PERCENT");
              }}
              className="rounded-xl border border-outline-variant bg-surface-container py-2 px-3 text-xs font-bold text-on-surface hover:bg-surface-container-high"
            >
              {discountType === "AMOUNT" ? "Modo: Importe en pesos ($)" : "Modo: Porcentaje (%)"}
            </button>
          </div>

          {/* Botones de Porcentajes Rápidos */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-on-surface-variant mr-1">Rápidos:</span>
            {QUICK_PERCENTS.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => applyPresetDiscount(pct)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  discountType === "PERCENT" && discountValue === pct
                    ? "bg-primary text-on-primary"
                    : "border border-outline-variant bg-surface-container text-on-surface hover:border-primary"
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Promociones configuradas en la sucursal */}
          {configuredDiscounts.length > 0 && (
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-on-surface-variant">Promociones de la sucursal:</span>
              <div className="flex flex-wrap gap-1.5">
                {configuredDiscounts.map((rule) => (
                  <button
                    key={rule.id}
                    type="button"
                    onClick={() => applyPresetDiscount(rule.percent, rule.name)}
                    className="rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10"
                  >
                    {rule.name} ({rule.percent}%)
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Campo de valor manual si seleccionó porcentaje o importe */}
          {discountType === "PERCENT" && (
            <div>
              <label className="text-[11px] font-semibold text-on-surface-variant">
                Porcentaje a descontar (%)
              </label>
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={discountValue || ""}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                placeholder="Ej. 25"
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface font-bold"
              />
            </div>
          )}

          {discountType === "AMOUNT" && (
            <div>
              <label className="text-[11px] font-semibold text-on-surface-variant">
                Importe directo en pesos ($)
              </label>
              <input
                type="number"
                min="0.1"
                max={subtotal}
                step="0.5"
                value={discountValue || ""}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                placeholder="Ej. 100"
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface font-bold"
              />
            </div>
          )}

          {/* Campos de Motivo si hay descuento */}
          {discountAmount > 0 && (
            <div className="space-y-2 pt-2 border-t border-outline-variant">
              <div>
                <label className="text-xs font-bold text-on-surface flex items-center justify-between">
                  <span>Motivo del descuento / cortesía <span className="text-error">*</span></span>
                  <span className="text-[10px] text-on-surface-variant font-normal">Requerido por auditoría</span>
                </label>
                <select
                  value={discountReasonCode}
                  onChange={(e) => setDiscountReasonCode(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-xs font-semibold text-on-surface"
                >
                  <option value="">-- Selecciona el motivo --</option>
                  {REASON_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant">
                  {discountReasonCode === "OTRO" ? "Escribe la justificación *" : "Nota / Observación (opcional)"}
                </label>
                <input
                  type="text"
                  value={discountReasonNote}
                  onChange={(e) => setDiscountReasonNote(e.target.value)}
                  placeholder="Ej. Mesa de socios, atención por tardanza, etc."
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-xs text-on-surface"
                />
              </div>
            </div>
          )}
        </div>

        {/* MÉTODO DE PAGO (SOLO SI EL TOTAL ES MAYOR A 0) */}
        {!isFree ? (
          <div className="rounded-xl border border-outline-variant bg-surface p-3 mb-4 space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface">
                Método de pago
              </label>
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2.5 text-sm font-semibold text-on-surface"
              >
                {PAYMENT_METHODS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {method === "EFECTIVO" && (
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant">
                  Efectivo recibido del cliente (para calcular cambio)
                </label>
                <input
                  type="number"
                  step="1"
                  min={finalTotal}
                  value={cashTendered}
                  onChange={(event) => setCashTendered(event.target.value)}
                  placeholder={`Monto recibido (mínimo ${currency(finalTotal)})`}
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface font-bold"
                />
                {Number(cashTendered) > finalTotal && (
                  <p className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Cambio a entregar: {currency(Number(cashTendered) - finalTotal)}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 mb-4 text-center">
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
              ✨ Cortesía Total Aplicada (100%)
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              La cuenta queda liquidada en $0.00. No se requiere cobro monetario.
            </p>
          </div>
        )}

        {!isOnline && (
          <p className="mb-3 rounded-xl bg-secondary/10 p-3 text-xs font-semibold text-secondary">
            Sin conexión: el cobro quedará guardado localmente en cola para sincronizar y la mesa se liberará de inmediato.
          </p>
        )}

        {error && (
          <p className="mb-3 rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error font-medium">
            {error}
          </p>
        )}

        <button
          disabled={submitting}
          onClick={() => void submit()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-on-primary transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
        >
          <CheckIcon className="h-4 w-4" />
          {submitting
            ? "Guardando cobro…"
            : isFree
            ? `Confirmar cortesía de ${order.tableLabel} ($0.00)`
            : `Confirmar cobro de ${order.tableLabel} (${currency(finalTotal)})`}
        </button>
      </div>
    </div>
  );
}
