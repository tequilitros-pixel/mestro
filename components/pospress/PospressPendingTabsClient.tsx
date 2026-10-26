"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, useMemo } from "react";
import {
  AlertIcon,
  CheckIcon,
  CashRegisterIcon,
  ReceiptIcon,
  TrashIcon,
  XIcon,
  SearchIcon,
  ClockIcon,
  CoinsIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { getProductVisual } from "@/lib/pos/productVisual";
import { enqueueOperation } from "@/lib/offline/queue";
import {
  listLocalPendingTabs,
  saveLocalPendingTab,
  deleteLocalPendingTab,
  syncPendingTabs,
  type PendingTab,
  type PendingTabLine,
  type PendingTabStatus,
} from "@/lib/offline/pending-tabs";
import PostSaleModal from "@/components/pos/PostSaleModal";
import PosVariantPickerModal from "@/components/pos/PosVariantPickerModal";
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

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];
const currency = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

function formatDate(iso: string) {
  try {
    const date = new Date(iso);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    if (isToday) return `Hoy ${timeStr}`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();
    if (isYesterday) return `Ayer ${timeStr}`;

    return `${date.toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" })} ${timeStr}`;
  } catch {
    return iso;
  }
}

export default function PospressPendingTabsClient({ branches }: { branches: Branch[] }) {
  const initialBranchId = branches[0]?.id ?? "";
  const [branchId, setBranchId] = useState(initialBranchId);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tabs, setTabs] = useState<PendingTab[]>([]);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [localOpenCut, setLocalOpenCut] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | PendingTabStatus>("PENDIENTE");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerNotes, setNewCustomerNotes] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
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

    const online = () => {
      setIsOnline(true);
      void syncPendingTabs(branchId).then((data) => {
        if (!cancelled) setTabs(data);
      });
    };
    const offline = () => setIsOnline(false);

    window.addEventListener("online", online);
    window.addEventListener("offline", offline);

    void listLocalPendingTabs(initialBranchId)
      .then((data) => {
        if (!cancelled) setTabs(data);
      })
      .catch(() => setLoadError("No se pudieron leer las cuentas pendientes locales."));

    // Las cuentas quedan en este dispositivo; no se simula una sincronización remota.
    if (navigator.onLine) {
      void syncPendingTabs(initialBranchId)
        .then((data) => {
          if (!cancelled) setTabs(data);
        })
        .catch(() => {});
    }

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

    const changed = () => {
      void listLocalPendingTabs(branchId).then(setTabs);
    };
    window.addEventListener("maestro:pending-tabs-changed", changed);

    return () => {
      cancelled = true;
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("maestro:pending-tabs-changed", changed);
    };
  }, [initialBranchId, branchId]);

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
  const activeTab = tabs.find((t) => t.id === selectedTabId) ?? null;
  const activeCategory = categories.find((c) => c.id === categoryId) ?? null;
  const hasOpenCut = Boolean(branch?.openCashCutId) || (!isOnline && localOpenCut);

  // Filtrado y búsqueda
  const filteredTabs = useMemo(() => {
    return tabs.filter((t) => {
      if (t.branchId !== branchId) return false;
      if (filterStatus !== "ALL" && t.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.customerName.toLowerCase().includes(q);
        const matchesNotes = t.notes?.toLowerCase().includes(q) ?? false;
        const matchesPhone = t.phone?.toLowerCase().includes(q) ?? false;
        const matchesItem = t.lines.some((l) => l.productName.toLowerCase().includes(q));
        if (!matchesName && !matchesNotes && !matchesPhone && !matchesItem) return false;
      }
      return true;
    });
  }, [tabs, branchId, filterStatus, searchQuery]);

  // Métricas
  const pendingCount = tabs.filter((t) => t.branchId === branchId && t.status === "PENDIENTE").length;
  const totalPendingAmount = tabs
    .filter((t) => t.branchId === branchId && t.status === "PENDIENTE")
    .reduce((sum, t) => sum + t.total, 0);
  const paidCount = tabs.filter((t) => t.branchId === branchId && t.status === "PAGADA").length;

  async function refreshTabs() {
    setTabs(await listLocalPendingTabs(branchId));
  }

  async function createNewTab() {
    if (!newCustomerName.trim() || !branch) return;

    const newTab: PendingTab = {
      id: crypto.randomUUID(),
      branchId: branch.id,
      customerName: newCustomerName.trim(),
      phone: newCustomerPhone.trim() || undefined,
      notes: newCustomerNotes.trim() || undefined,
      status: "PENDIENTE",
      lines: [],
      total: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveLocalPendingTab(newTab);
    await refreshTabs();
    setSelectedTabId(newTab.id);
    setIsCreatingNew(false);
    setNewCustomerName("");
    setNewCustomerNotes("");
    setNewCustomerPhone("");
  }

  async function addVariantToTab(product: Product, variant: Variant) {
    if (!activeTab || activeTab.status !== "PENDIENTE") return;

    const key = `variant:${variant.id}`;
    const existing = activeTab.lines.find((line) => line.key === key);
    const lines = existing
      ? activeTab.lines.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + 1 } : line,
        )
      : [
          ...activeTab.lines,
          {
            key,
            variantId: variant.id,
            productName: product.name,
            variantName: variant.name,
            unitPrice: variant.price,
            quantity: 1,
          },
        ];

    await saveLocalPendingTab({ ...activeTab, lines });
    await refreshTabs();
  }

  async function chooseProduct(product: Product) {
    if (!activeTab || activeTab.status !== "PENDIENTE") return;
    const variants = product.variants.filter((variant) => variant.active);
    if (variants.length === 1) return addVariantToTab(product, variants[0]);
    setVariantProduct(product);
  }

  async function changeLineQuantity(line: PendingTabLine, delta: number) {
    if (!activeTab || activeTab.status !== "PENDIENTE") return;

    const lines = activeTab.lines
      .map((item) => (item.key === line.key ? { ...item, quantity: item.quantity + delta } : item))
      .filter((item) => item.quantity > 0);

    await saveLocalPendingTab({ ...activeTab, lines });
    await refreshTabs();
  }

  async function cancelTab() {
    if (!activeTab) return;
    if (
      !window.confirm(
        `¿Eliminar la cuenta pendiente de ${activeTab.customerName}? Esta acción no se puede deshacer.`,
      )
    )
      return;

    await deleteLocalPendingTab(activeTab.id);
    await refreshTabs();
    setSelectedTabId(null);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">POSpress</p>
          <h1 className="text-3xl font-bold text-on-surface">Cuentas pendientes por pagar</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Guarda cuentas a nombre del cliente para cobrarlas cuando regresen (hoy, mañana o después).
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Las cuentas se conservan en este dispositivo hasta liquidarlas; el cobro se registra en POS al momento de pagar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/pospress"
            className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant hover:border-primary"
          >
            Nueva venta
          </Link>
          <Link
            href="/pospress/tables"
            className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant hover:border-primary"
          >
            Mesas
          </Link>
          <Link
            href="/pospress/transactions"
            className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant hover:border-primary"
          >
            <ReceiptIcon className="mr-1 inline h-4 w-4" />
            Transacciones
          </Link>
        </div>
      </header>

      {/* Control bar & metrics */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container p-3">
          <div className="min-w-0 flex-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              Sucursal
            </label>
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setSelectedTabId(null);
              }}
              className="mt-0.5 w-full truncate rounded-lg border border-outline-variant bg-surface px-2.5 py-1.5 text-sm font-semibold text-on-surface"
            >
              {branches.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              isOnline ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim" : "bg-secondary/15 text-secondary"
            }`}
          >
            {isOnline ? "En línea" : "Offline"}
          </span>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
            <ClockIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant">Por cobrar</p>
            <p className="text-xl font-bold text-amber-500">{currency(totalPendingAmount)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <UsersIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant">Cuentas pendientes</p>
            <p className="text-xl font-bold text-on-surface">{pendingCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
            <CheckIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-on-surface-variant">Cobradas</p>
            <p className="text-xl font-bold text-on-surface">{paidCount}</p>
          </div>
        </div>
      </section>

      {!hasOpenCut && branch && (
        <div className="flex items-center gap-3 rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-sm">
          <AlertIcon className="h-5 w-5 shrink-0 text-secondary" />
          <span className="flex-1 text-on-surface">
            Abre el corte de caja antes de cobrar o liquidar una cuenta pendiente.
          </span>
          <Link
            href="/cash-cuts/daily/new"
            className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary"
          >
            Abrir corte
          </Link>
        </div>
      )}

      {loadError && (
        <p className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{loadError}</p>
      )}

      {/* Main Grid: Accounts List + Account Detail */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_26rem]">
        {/* Left Column: Search, Filter, and Accounts */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterStatus("PENDIENTE")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  filterStatus === "PENDIENTE"
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface"
                }`}
              >
                Pendientes ({pendingCount})
              </button>
              <button
                onClick={() => setFilterStatus("PAGADA")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  filterStatus === "PAGADA"
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface"
                }`}
              >
                Cobradas ({paidCount})
              </button>
              <button
                onClick={() => setFilterStatus("ALL")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  filterStatus === "ALL"
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface"
                }`}
              >
                Todas ({tabs.filter((t) => t.branchId === branchId).length})
              </button>
            </div>

            <button
              onClick={() => setIsCreatingNew(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary shadow-sm transition hover:scale-[1.02]"
            >
              + Nueva cuenta pendiente
            </button>
          </div>

          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Buscar por nombre de cliente, notas o producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-surface py-2.5 pl-9 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/60"
            />
          </div>

          {filteredTabs.length === 0 ? (
            <div className="rounded-2xl border border-outline-variant bg-surface-container/50 p-8 text-center">
              <UsersIcon className="mx-auto h-10 w-10 text-on-surface-variant/50" />
              <p className="mt-2 text-sm font-semibold text-on-surface">No hay cuentas que coincidan</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {filterStatus === "PENDIENTE"
                  ? "No hay cuentas pendientes por cobrar en esta sucursal."
                  : "No se encontraron registros con los filtros seleccionados."}
              </p>
              <button
                onClick={() => setIsCreatingNew(true)}
                className="mt-4 rounded-xl border border-primary px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
              >
                + Crear primera cuenta
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {filteredTabs.map((tab) => {
                const isSelected = selectedTabId === tab.id;
                const isPending = tab.status === "PENDIENTE";
                const totalItems = tab.lines.reduce((sum, l) => sum + l.quantity, 0);

                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedTabId(tab.id)}
                    className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : isPending
                          ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                          : "border-outline-variant bg-surface-container hover:border-primary/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-base font-bold text-on-surface">
                          {tab.customerName}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isPending
                              ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                              : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {isPending ? "PENDIENTE" : "COBRADA"}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-on-surface-variant">{formatDate(tab.createdAt)}</p>

                      {tab.notes && (
                        <p className="mt-2 line-clamp-2 text-xs italic text-on-surface-variant/80">
                          &quot;{tab.notes}&quot;
                        </p>
                      )}
                    </div>

                    <div className="mt-4 border-t border-outline-variant/40 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-on-surface-variant">
                          {totalItems} {totalItems === 1 ? "artículo" : "artículos"}
                        </span>
                        <span
                          className={`text-base font-bold ${
                            isPending ? "text-amber-500" : "text-emerald-500"
                          }`}
                        >
                          {currency(tab.total)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Selected Account Detail & Checkout */}
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
          {!activeTab ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <UsersIcon className="h-10 w-10 text-on-surface-variant/40" />
              <p className="mt-2 text-sm font-semibold text-on-surface">Selecciona una cuenta</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Haz clic en una persona para ver sus consumos, agregar bebidas o cobrar la cuenta.
              </p>
              <button
                onClick={() => setIsCreatingNew(true)}
                className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary"
              >
                + Nueva cuenta pendiente
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2 border-b border-outline-variant pb-3">
                <div>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      activeTab.status === "PENDIENTE"
                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {activeTab.status}
                  </span>
                  <h2 className="mt-1 text-xl font-bold text-on-surface">{activeTab.customerName}</h2>
                  <p className="text-xs text-on-surface-variant">
                    Abierta: {formatDate(activeTab.createdAt)}
                  </p>
                  {activeTab.phone && (
                    <p className="text-xs text-on-surface-variant">Tel: {activeTab.phone}</p>
                  )}
                  {activeTab.notes && (
                    <p className="mt-1 text-xs italic text-on-surface-variant">&quot;{activeTab.notes}&quot;</p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {activeTab.status === "PENDIENTE" && (
                    <button
                      onClick={() => void cancelTab()}
                      className="rounded-lg p-2 text-on-surface-variant hover:bg-error/10 hover:text-error"
                      title="Eliminar cuenta pendiente"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedTabId(null)}
                    className="rounded-lg p-2 text-on-surface-variant hover:bg-surface"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Artículos consumidos ({activeTab.lines.reduce((s, l) => s + l.quantity, 0)})
                </p>

                {activeTab.lines.length === 0 ? (
                  <p className="py-4 text-center text-xs text-on-surface-variant">
                    No hay productos agregados a esta cuenta aún. Selecciona del catálogo abajo.
                  </p>
                ) : (
                  <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                    {activeTab.lines.map((line) => (
                      <div
                        key={line.key}
                        className="flex items-center justify-between gap-2 rounded-xl bg-surface p-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-on-surface">
                            {line.productName}
                          </p>
                          {line.variantName !== "Único" && (
                            <p className="text-xs text-on-surface-variant">{line.variantName}</p>
                          )}
                          <p className="text-xs text-on-surface-variant">
                            {currency(line.unitPrice)} × {line.quantity} ={" "}
                            <span className="font-semibold text-on-surface">
                              {currency(line.unitPrice * line.quantity)}
                            </span>
                          </p>
                        </div>

                        {activeTab.status === "PENDIENTE" ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => void changeLineQuantity(line, -1)}
                              className="h-7 w-7 rounded-lg border border-outline-variant font-bold text-on-surface hover:bg-surface-container"
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-sm font-bold">{line.quantity}</span>
                            <button
                              onClick={() => void changeLineQuantity(line, 1)}
                              className="h-7 w-7 rounded-lg border border-outline-variant font-bold text-on-surface hover:bg-surface-container"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-on-surface">{line.quantity} pza</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary and Pay */}
              <div className="border-t border-outline-variant pt-3">
                <div className="flex justify-between text-xl font-bold text-on-surface">
                  <span>Total</span>
                  <span className={activeTab.status === "PENDIENTE" ? "text-amber-500" : "text-emerald-500"}>
                    {currency(activeTab.total)}
                  </span>
                </div>

                {activeTab.status === "PENDIENTE" ? (
                  <button
                    disabled={!hasOpenCut || !activeTab.lines.length}
                    onClick={() => setPaymentOpen(true)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary shadow-sm transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CashRegisterIcon className="h-4 w-4" />
                    Cobrar cuenta ({currency(activeTab.total)})
                  </button>
                ) : (
                  <div className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-center text-xs text-emerald-600 dark:text-emerald-400">
                    <p className="font-bold">Cuenta cobrada y liquidada</p>
                    {activeTab.paidAt && <p className="mt-0.5">Fecha: {formatDate(activeTab.paidAt)}</p>}
                    {activeTab.paymentMethod && <p>Método: {activeTab.paymentMethod}</p>}
                    {activeTab.saleCode && <p>Ticket: #{activeTab.saleCode}</p>}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Product Catalog Section (for active pending tab) */}
      {activeTab && activeTab.status === "PENDIENTE" && (
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-on-surface">
                Agregar productos a la cuenta de {activeTab.customerName}
              </h2>
              <p className="text-xs text-on-surface-variant">
                Selecciona bebidas o botanas para sumarlas a esta cuenta.
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setCategoryId(category.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    category.id === categoryId
                      ? "bg-primary text-on-primary"
                      : "bg-surface text-on-surface-variant hover:bg-surface-container-high"
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
                    className="group overflow-hidden rounded-xl border border-outline-variant bg-surface text-left transition hover:border-primary hover:shadow-sm"
                  >
                    {visual.type === "image" ? (
                      <Image
                        unoptimized
                        width={240}
                        height={64}
                        src={visual.url}
                        alt={product.name}
                        className="h-16 w-full object-cover transition group-hover:scale-105"
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
                      <p className="text-[11px] font-semibold text-primary">
                        {product.variants.length > 1
                          ? `${product.variants.length} variantes`
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

      {/* Modal: Variant Selector */}
      {variantProduct && (
        <PosVariantPickerModal
          product={variantProduct}
          formatPrice={currency}
          onSelect={(variant) => {
            void addVariantToTab(variantProduct, variant);
            setVariantProduct(null);
          }}
          onClose={() => setVariantProduct(null)}
        />
      )}

      {/* Modal: Create New Pending Tab */}
      {isCreatingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-high p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-primary">Nueva cuenta</p>
                <h3 className="text-xl font-bold text-on-surface">Registrar cuenta pendiente</h3>
              </div>
              <button
                onClick={() => setIsCreatingNew(false)}
                className="rounded-lg p-1.5 hover:bg-surface"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void createNewTab();
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-on-surface-variant">
                  Nombre de la persona <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Juan Pérez, Don Beto, Mesa 4 amigo..."
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant">
                  Teléfono de contacto (opcional)
                </label>
                <input
                  type="tel"
                  placeholder="ej. 33 1234 5678"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface-variant">
                  Notas / Compromiso de pago (opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="ej. Dijo que regresa en 1 hora con efectivo / Vuelve mañana"
                  value={newCustomerNotes}
                  onChange={(e) => setNewCustomerNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50"
                />
              </div>

              <div className="mt-5 flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="flex-1 rounded-xl border border-outline-variant px-3 py-2.5 text-xs font-bold text-on-surface-variant hover:bg-surface"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newCustomerName.trim()}
                  className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-on-primary transition hover:scale-[1.02] disabled:opacity-40"
                >
                  Crear y agregar productos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Settle / Pay Tab */}
      {paymentOpen && activeTab && (
        <PendingTabPaymentModal
          tab={activeTab}
          branchId={branchId}
          branchName={branch?.name ?? "Tequilitros"}
          isOnline={isOnline}
          onClose={() => setPaymentOpen(false)}
          onSuccess={async (receipt) => {
            const updated: PendingTab = {
              ...activeTab,
              status: "PAGADA",
              paidAt: new Date().toISOString(),
              paymentMethod: receipt.payments[0]?.method ?? "EFECTIVO",
              saleId: receipt.saleId,
              saleCode: receipt.saleCode,
            };
            await saveLocalPendingTab(updated);
            await refreshTabs();
            setPaymentOpen(false);
            setCompletedReceipt(receipt);
          }}
        />
      )}

      {/* Post-Payment Modal (Square-style print ticket & Resend receipt email) */}
      {completedReceipt && (
        <PostSaleModal receipt={completedReceipt} onClose={() => setCompletedReceipt(null)} />
      )}
    </main>
  );
}

function PendingTabPaymentModal({
  tab,
  branchId,
  branchName,
  isOnline,
  onClose,
  onSuccess,
}: {
  tab: PendingTab;
  branchId: string;
  branchName: string;
  isOnline: boolean;
  onClose: () => void;
  onSuccess: (receipt: ReceiptData) => Promise<void>;
}) {
  const [method, setMethod] = useState("EFECTIVO");
  const [amount, setAmount] = useState(tab.total.toFixed(2));
  const [cashReceived, setCashReceived] = useState(tab.total.toString());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationId] = useState(() => crypto.randomUUID());
  const [createdAt] = useState(() => new Date().toISOString());

  const numAmount = Number(amount) || 0;
  const numCashReceived = Number(cashReceived) || 0;
  const change = method === "EFECTIVO" ? Math.max(0, numCashReceived - numAmount) : 0;

  async function submit() {
    if (!(numAmount > 0) || Math.abs(numAmount - tab.total) >= 0.01) {
      setError("El pago debe cubrir exactamente el monto de la cuenta.");
      return;
    }
    if (method === "EFECTIVO" && numCashReceived < numAmount) {
      setError("El efectivo recibido no puede ser menor al total.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      clientOperationId: operationId,
      clientCreatedAt: createdAt,
      displayTotal: tab.total,
      branchId,
      inventoryMode: "v2" as const,
      discountReason: `Cuenta pendiente: ${tab.customerName}`,
      items: tab.lines.map((line) =>
        line.variantId === "custom"
          ? {
              isCustom: true as const,
              description: line.productName || "Cobro personalizado",
              amount: line.unitPrice,
              quantity: line.quantity,
            }
          : {
              variantId: line.variantId,
              quantity: line.quantity,
            },
      ),
      payments: [{ method, amount: numAmount }],
    };

    const receiptItems = tab.lines.map((l) => ({
      name: `${l.productName}${l.variantName !== "Único" ? ` (${l.variantName})` : ""}`,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.unitPrice * l.quantity,
    }));

    try {
      if (!navigator.onLine) {
        await enqueueOperation({
          id: operationId,
          kind: "pos.sale.create",
          payload,
          createdAt,
        });

        const receipt: ReceiptData = {
          saleId: operationId,
          saleCode: operationId.slice(0, 8).toUpperCase(),
          branchName,
          date: new Date().toLocaleString("es-MX"),
          items: receiptItems,
          subtotal: tab.total,
          discountAmount: 0,
          total: tab.total,
          payments: [{ method, amount: numAmount }],
          cashReceived: method === "EFECTIVO" ? numCashReceived : null,
          change: method === "EFECTIVO" ? change : null,
          isOffline: true,
        };

        await onSuccess(receipt);
        return;
      }

      const response = await fetch("/api/pos/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "No fue posible cobrar la cuenta.");
      }

      const saleData = await response.json();
      const receipt: ReceiptData = {
        saleId: saleData.id ?? operationId,
        saleCode: saleData.code ?? operationId.slice(0, 8).toUpperCase(),
        branchName: saleData.branch?.name ?? branchName,
        date: new Date().toLocaleString("es-MX"),
        cashierName: saleData.soldBy?.name,
        items: receiptItems,
        subtotal: tab.total,
        discountAmount: 0,
        total: tab.total,
        payments: [{ method, amount: numAmount }],
        cashReceived: method === "EFECTIVO" ? numCashReceived : null,
        change: method === "EFECTIVO" ? change : null,
        isOffline: false,
      };

      await onSuccess(receipt);
    } catch (caught) {
      if (caught instanceof TypeError || !navigator.onLine) {
        try {
          await enqueueOperation({
            id: operationId,
            kind: "pos.sale.create",
            payload,
            createdAt,
          });

          const receipt: ReceiptData = {
            saleId: operationId,
            saleCode: operationId.slice(0, 8).toUpperCase(),
            branchName,
            date: new Date().toLocaleString("es-MX"),
            items: receiptItems,
            subtotal: tab.total,
            discountAmount: 0,
            total: tab.total,
            payments: [{ method, amount: numAmount }],
            cashReceived: method === "EFECTIVO" ? numCashReceived : null,
            change: method === "EFECTIVO" ? change : null,
            isOffline: true,
          };

          await onSuccess(receipt);
          return;
        } catch {
          // continue to error below
        }
      }
      setError(caught instanceof Error ? caught.message : "No fue posible registrar el cobro.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-dim/70 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl border border-outline-variant bg-surface-container-high p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Liquidar cuenta</p>
            <h2 className="text-xl font-bold text-on-surface">{tab.customerName}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-center text-3xl font-bold text-on-surface">{currency(tab.total)}</p>

        <label className="mb-3 block text-xs font-semibold text-on-surface-variant">
          Método de pago
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-sm font-semibold text-on-surface"
          >
            {PAYMENT_METHODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {method === "EFECTIVO" && (
          <div className="mb-3 space-y-2">
            <label className="block text-xs font-semibold text-on-surface-variant">
              Efectivo recibido
              <input
                type="number"
                step="1"
                min={tab.total}
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2.5 text-sm font-bold text-on-surface"
              />
            </label>

            {/* Quick cash buttons */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.filter((amt) => amt >= tab.total).map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setCashReceived(amt.toString())}
                  className="rounded-lg border border-outline-variant bg-surface px-2.5 py-1 text-xs font-bold text-on-surface transition hover:border-primary"
                >
                  ${amt}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCashReceived(tab.total.toString())}
                className="rounded-lg border border-primary bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"
              >
                Exacto ({currency(tab.total)})
              </button>
            </div>

            {change > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-emerald-500/15 p-3 text-emerald-600 dark:text-emerald-400">
                <span className="text-xs font-bold uppercase tracking-wider">Cambio a devolver:</span>
                <span className="text-lg font-bold">{currency(change)}</span>
              </div>
            )}
          </div>
        )}

        {!isOnline && (
          <p className="mb-3 rounded-xl bg-secondary/10 p-3 text-xs font-semibold text-secondary">
            Modo sin conexión: el cobro se encolará y la cuenta quedará liquidada localmente.
          </p>
        )}

        {error && <p className="mb-3 rounded-xl bg-error/10 p-3 text-sm text-error">{error}</p>}

        <button
          disabled={submitting}
          onClick={() => void submit()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary shadow-sm transition hover:scale-[1.01] disabled:opacity-40"
        >
          <CheckIcon className="h-4 w-4" />
          {submitting ? "Guardando cobro…" : "Confirmar cobro y cerrar cuenta"}
        </button>
      </div>
    </div>
  );
}
