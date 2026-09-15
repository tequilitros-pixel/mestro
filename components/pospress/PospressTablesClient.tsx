"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertIcon, CheckIcon, CashRegisterIcon, ReceiptIcon, TrashIcon, XIcon } from "@/components/ui/icons";
import { getProductVisual } from "@/lib/pos/productVisual";
import { enqueueOperation } from "@/lib/offline/queue";
import { deleteLocalTableOrder, listLocalTableOrders, saveLocalTableOrder, type LocalTableLine, type LocalTableOrder } from "@/lib/offline/table-orders";

type Variant = { id: string; name: string; price: number; active: boolean };
type Product = { id: string; name: string; icon: string | null; active: boolean; variants: Variant[] };
type Category = { id: string; name: string; active: boolean; products: Product[] };
type Branch = { id: string; name: string; openCashCutId: string | null };

const PAYMENT_METHODS = [{ value: "EFECTIVO", label: "Efectivo" }, { value: "TARJETA", label: "Tarjeta" }, { value: "TRANSFERENCIA", label: "Transferencia" }, { value: "DIDI", label: "DiDi" }, { value: "UBER", label: "Uber" }, { value: "RAPPI", label: "Rappi" }, { value: "VALES", label: "Vales" }, { value: "OTRO", label: "Otro" }];
const currency = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
const TABLES = Array.from({ length: 12 }, (_, index) => ({ id: `mesa-${index + 1}`, label: `Mesa ${index + 1}` }));

export default function PospressTablesClient({ branches }: { branches: Branch[] }) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<LocalTableOrder[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [localOpenCut, setLocalOpenCut] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    if (branches[0]?.id) setLocalOpenCut(Boolean(localStorage.getItem(`maestro:open-cash-cut:${branches[0].id}`)));
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    void listLocalTableOrders().then(setOrders).catch(() => setLoadError("No se pudieron leer las mesas guardadas en este dispositivo."));
    const cachedCatalog = localStorage.getItem("maestro:pos-catalog");
    if (cachedCatalog) {
      try {
        const data = JSON.parse(cachedCatalog) as Category[];
        setCategories(data);
        setCategoryId(data[0]?.id ?? null);
      } catch {
        localStorage.removeItem("maestro:pos-catalog");
      }
    }
    fetch("/api/pos/products").then((response) => { if (!response.ok) throw new Error("No se pudo cargar el catálogo."); return response.json(); }).then((data: Category[]) => { setCategories(data); setCategoryId(data[0]?.id ?? null); localStorage.setItem("maestro:pos-catalog", JSON.stringify(data)); }).catch((error) => { if (!cachedCatalog) setLoadError(error.message); });
    const changed = () => void listLocalTableOrders().then(setOrders);
    window.addEventListener("maestro:tables-changed", changed);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); window.removeEventListener("maestro:tables-changed", changed); };
  }, []);

  useEffect(() => {
    setLocalOpenCut(Boolean(branchId && localStorage.getItem(`maestro:open-cash-cut:${branchId}`)));
  }, [branchId]);

  const branch = branches.find((item) => item.id === branchId) ?? null;
  const selectedTable = TABLES.find((table) => table.id === selectedTableId) ?? null;
  const activeOrder = orders.find((order) => order.branchId === branchId && order.tableId === selectedTableId) ?? null;
  const activeCategory = categories.find((category) => category.id === categoryId) ?? null;
  const total = activeOrder?.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) ?? 0;
  const hasOpenCut = Boolean(branch?.openCashCutId) || (!isOnline && localOpenCut);

  async function refreshOrders() { setOrders(await listLocalTableOrders()); }

  async function addVariant(product: Product, variant: Variant) {
    if (!branch || !selectedTable) return;
    const current = activeOrder ?? { id: crypto.randomUUID(), branchId: branch.id, tableId: selectedTable.id, tableLabel: selectedTable.label, lines: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const key = `variant:${variant.id}`;
    const existing = current.lines.find((line) => line.key === key);
    const lines = existing ? current.lines.map((line) => line.key === key ? { ...line, quantity: line.quantity + 1 } : line) : [...current.lines, { key, variantId: variant.id, productName: product.name, variantName: variant.name, unitPrice: variant.price, quantity: 1 }];
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
    const lines = activeOrder.lines.map((item) => item.key === line.key ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0);
    if (!lines.length) await deleteLocalTableOrder(activeOrder.id); else await saveLocalTableOrder({ ...activeOrder, lines });
    await refreshOrders();
  }

  async function closeTable() {
    if (!activeOrder) return;
    if (!window.confirm(`¿Cerrar ${activeOrder.tableLabel} sin cobrar? La cuenta se eliminará de este dispositivo.`)) return;
    await deleteLocalTableOrder(activeOrder.id); await refreshOrders(); setSelectedTableId(null);
  }

  return <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">POSpress</p><h1 className="text-3xl font-bold text-on-surface">Mesas</h1><p className="mt-1 text-sm text-on-surface-variant">Agrega rondas a una cuenta y cobra solo al pedir la cuenta.</p></div><div className="flex flex-wrap gap-2"><Link href="/pospress" className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant">Nueva venta</Link><Link href="/pospress/transactions" className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant"><ReceiptIcon className="mr-1 inline h-4 w-4" />Transacciones</Link></div></header>
    <section className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface-container p-3"><select value={branchId} onChange={(event) => { setBranchId(event.target.value); setSelectedTableId(null); }} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface">{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className={`rounded-full px-3 py-1 text-xs font-bold ${isOnline ? "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim" : "bg-secondary/15 text-secondary"}`}>{isOnline ? "En línea" : "Sin conexión"}</span><span className="text-sm text-on-surface-variant">{orders.filter((order) => order.branchId === branchId).length} cuentas abiertas</span></section>
    {!hasOpenCut && branch && <div className="flex items-center gap-3 rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-sm"><AlertIcon className="h-5 w-5 shrink-0 text-secondary" /><span className="flex-1 text-on-surface">Abre el corte de caja antes de cobrar una mesa.</span><Link href="/cash-cuts/daily/new" className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary">Abrir corte</Link></div>}
    {loadError && <p className="rounded-xl border border-error/30 bg-error/10 p-3 text-sm text-error">{loadError}</p>}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section><h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-on-surface-variant">Selecciona una mesa</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{TABLES.map((table) => { const order = orders.find((item) => item.branchId === branchId && item.tableId === table.id); const amount = order?.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) ?? 0; return <button key={table.id} onClick={() => setSelectedTableId(table.id)} className={`min-h-28 rounded-2xl border p-4 text-left transition ${selectedTableId === table.id ? "border-primary bg-primary/10" : order ? "border-secondary/40 bg-secondary/10" : "border-outline-variant bg-surface-container hover:border-primary/50"}`}><span className="text-lg font-bold text-on-surface">{table.label}</span><span className="mt-2 block text-xs text-on-surface-variant">{order ? `${order.lines.reduce((sum, line) => sum + line.quantity, 0)} artículos · ${currency(amount)}` : "Libre"}</span></button>; })}</div></section>
      <section className="rounded-2xl border border-outline-variant bg-surface-container p-4"><div className="flex items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Cuenta abierta</p><h2 className="text-xl font-bold text-on-surface">{selectedTable?.label ?? "Elige una mesa"}</h2></div>{activeOrder && <button onClick={() => void closeTable()} className="rounded-lg p-2 text-on-surface-variant hover:bg-error/10 hover:text-error" title="Cerrar cuenta sin cobrar"><TrashIcon className="h-4 w-4" /></button>}</div>{!activeOrder ? <p className="mt-8 text-center text-sm text-on-surface-variant">Selecciona una mesa libre para comenzar a agregar pedidos.</p> : <><div className="mt-4 space-y-2">{activeOrder.lines.map((line) => <div key={line.key} className="flex items-center justify-between gap-2 rounded-xl bg-surface p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-on-surface">{line.productName}</p>{line.variantName !== "Único" && <p className="text-xs text-on-surface-variant">{line.variantName}</p>}<p className="text-xs text-on-surface-variant">{currency(line.unitPrice)} c/u</p></div><div className="flex items-center gap-1"><button onClick={() => void changeQuantity(line, -1)} className="h-7 w-7 rounded-lg border border-outline-variant font-bold">−</button><span className="w-5 text-center text-sm font-bold">{line.quantity}</span><button onClick={() => void changeQuantity(line, 1)} className="h-7 w-7 rounded-lg border border-outline-variant font-bold">+</button></div></div>)}</div><div className="mt-4 border-t border-outline-variant pt-3"><div className="flex justify-between text-lg font-bold text-on-surface"><span>Total</span><span>{currency(total)}</span></div><button disabled={!hasOpenCut || !activeOrder.lines.length} onClick={() => setPaymentOpen(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-40"><CashRegisterIcon className="h-4 w-4" />Cobrar cuenta</button></div></>}</section>
    </div>
    {selectedTable && <section className="rounded-2xl border border-outline-variant bg-surface-container p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-bold text-on-surface">Agregar a {selectedTable.label}</h2><p className="text-xs text-on-surface-variant">Puedes volver a esta mesa y agregar otra ronda.</p></div><div className="flex gap-2 overflow-x-auto">{categories.map((category) => <button key={category.id} onClick={() => setCategoryId(category.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${category.id === categoryId ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant"}`}>{category.name}</button>)}</div></div>{activeCategory && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">{activeCategory.products.map((product) => { const visual = getProductVisual(product.icon); return <button key={product.id} onClick={() => void chooseProduct(product)} className="overflow-hidden rounded-xl border border-outline-variant bg-surface text-left hover:border-primary">{visual.type === "image" ? <img src={visual.url} alt={product.name} className="h-16 w-full object-cover" /> : <div className="flex h-16 items-center justify-center text-lg font-bold text-white" style={{ backgroundColor: visual.hex }}>{product.name.slice(0, 1).toUpperCase()}</div>}<div className="p-2"><p className="truncate text-xs font-bold text-on-surface">{product.name}</p><p className="text-[11px] text-on-surface-variant">{product.variants.length > 1 ? "Varias opciones" : currency(product.variants[0]?.price ?? 0)}</p></div></button>; })}</div>}</section>}
    {variantProduct && <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-dim/70 p-4"><div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-high p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-bold text-on-surface">{variantProduct.name}</h3><button onClick={() => setVariantProduct(null)}><XIcon className="h-5 w-5" /></button></div><div className="space-y-2">{variantProduct.variants.filter((variant) => variant.active).map((variant) => <button key={variant.id} onClick={() => { void addVariant(variantProduct, variant); setVariantProduct(null); }} className="flex w-full justify-between rounded-xl border border-outline-variant p-3 text-left text-sm font-semibold text-on-surface"><span>{variant.name}</span><span>{currency(variant.price)}</span></button>)}</div></div></div>}
    {paymentOpen && activeOrder && <TablePaymentModal total={total} branchId={branchId} order={activeOrder} isOnline={isOnline} onClose={() => setPaymentOpen(false)} onSuccess={async () => { await deleteLocalTableOrder(activeOrder.id); await refreshOrders(); setSelectedTableId(null); setPaymentOpen(false); }} />}
  </main>;
}

function TablePaymentModal({ total, branchId, order, isOnline, onClose, onSuccess }: { total: number; branchId: string; order: LocalTableOrder; isOnline: boolean; onClose: () => void; onSuccess: () => Promise<void> }) {
  const [method, setMethod] = useState("EFECTIVO"); const [amount, setAmount] = useState(total.toFixed(2)); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<string | null>(null); const [operationId] = useState(() => crypto.randomUUID()); const [createdAt] = useState(() => new Date().toISOString());
  async function submit() { const paid = Number(amount); if (!(paid > 0) || Math.abs(paid - total) >= 0.01) { setError("El pago debe cubrir exactamente la cuenta."); return; } setSubmitting(true); setError(null); const payload = { clientOperationId: operationId, clientCreatedAt: createdAt, displayTotal: total, branchId, inventoryMode: "v2" as const, tableId: order.tableId, tableLabel: order.tableLabel, items: order.lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })), payments: [{ method, amount: paid }] }; try { if (!navigator.onLine) { await enqueueOperation({ id: operationId, kind: "pos.sale.create", payload, createdAt }); await onSuccess(); return; } const response = await fetch("/api/pos/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error ?? "No fue posible cobrar la mesa."); } await onSuccess(); } catch (caught) { if (caught instanceof TypeError || !navigator.onLine) { try { await enqueueOperation({ id: operationId, kind: "pos.sale.create", payload, createdAt }); await onSuccess(); return; } catch { /* cae al mensaje */ } } setError(caught instanceof Error ? caught.message : "No fue posible guardar el cobro."); } finally { setSubmitting(false); } }
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-surface-dim/70 p-0 sm:items-center sm:p-4"><div className="w-full max-w-md rounded-t-2xl border border-outline-variant bg-surface-container-high p-5 sm:rounded-2xl"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">{order.tableLabel}</p><h2 className="text-xl font-bold text-on-surface">Cobrar cuenta</h2></div><button onClick={onClose}><XIcon className="h-5 w-5" /></button></div><p className="mb-4 text-center text-3xl font-bold text-on-surface">{currency(total)}</p><label className="mb-3 block text-xs font-semibold text-on-surface-variant">Método de pago<select value={method} onChange={(event) => setMethod(event.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-3 text-sm text-on-surface">{PAYMENT_METHODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="mb-3 block text-xs font-semibold text-on-surface-variant">Monto<input type="number" step="0.01" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant bg-surface px-3 py-3 text-sm text-on-surface" /></label>{!isOnline && <p className="mb-3 rounded-xl bg-secondary/10 p-3 text-xs font-semibold text-secondary">Sin conexión: el cobro quedará pendiente de subir y la mesa se libera localmente.</p>}{error && <p className="mb-3 rounded-xl bg-error/10 p-3 text-sm text-error">{error}</p>}<button disabled={submitting} onClick={() => void submit()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary disabled:opacity-40"><CheckIcon className="h-4 w-4" />{submitting ? "Guardando…" : "Confirmar cobro"}</button></div></div>;
}
