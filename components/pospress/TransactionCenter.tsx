"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertIcon, PrinterIcon, RefreshIcon } from "@/components/ui/icons";
import { cancelQueuedOperation, listOperations, retryQueuedOperation } from "@/lib/offline/queue";
import type { OfflineOperation } from "@/lib/offline/types";
import { useOfflineSync } from "@/components/offline/OfflineProvider";
import { todayDateOnly } from "@/lib/dateOnly";
import PostSaleModal from "@/components/pos/PostSaleModal";
import type { ReceiptData } from "@/components/pos/ReceiptTicket";

type Sale = {
  id: string;
  code: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  createdAt: string;
  branch: { id: string; name: string };
  soldBy: { id: string; name: string };
  cashCut: { id: string; code: string } | null;
  items: Array<{ id: string; name: string; quantity: number; lineTotal: number }>;
  payments: Array<{ method: string; amount: number }>;
  cancelReason: string | null;
};

type Branch = { id: string; name: string };
type ViewItem = { source: "server" | "local"; id: string; createdAt: string; branch: string; branchId: string; code: string; status: string; total: number | null; detail: string; sale?: Sale; operation?: OfflineOperation };

const currency = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
const time = (value: string) => new Date(value).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });

function localTotal(operation: OfflineOperation) {
  const payload = operation.payload as { displayTotal?: number };
  return typeof payload.displayTotal === "number" ? payload.displayTotal : null;
}

function localBranchId(operation: OfflineOperation) {
  const payload = operation.payload as { branchId?: string };
  return typeof payload.branchId === "string" ? payload.branchId : "";
}

function localCashCutId(operation: OfflineOperation) {
  const payload = operation.payload as { cashCutId?: string };
  return typeof payload.cashCutId === "string" ? payload.cashCutId : "";
}

export default function TransactionCenter({ branches, workers, initialSales, canCancel, isAdmin, currentCashCutId }: { branches: Branch[]; workers: Branch[]; initialSales: Sale[]; canCancel: boolean; isAdmin: boolean; currentCashCutId?: string | null }) {
  const [sales, setSales] = useState(initialSales);
  const [operations, setOperations] = useState<OfflineOperation[]>([]);
  const [branchId, setBranchId] = useState(!isAdmin && branches.length === 1 ? branches[0].id : "");
  const [soldById, setSoldById] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<ReceiptData | null>(null);
  const { snapshot, syncNow } = useOfflineSync();

  function openReceipt(item: ViewItem) {
    if (item.source === "server" && item.sale) {
      setViewingReceipt({
        saleId: item.sale.id,
        saleCode: item.sale.code,
        branchName: item.sale.branch.name,
        date: new Date(item.sale.createdAt).toLocaleString("es-MX", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        cashierName: item.sale.soldBy.name,
        items: item.sale.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.quantity > 0 ? i.lineTotal / i.quantity : i.lineTotal,
          lineTotal: i.lineTotal,
        })),
        subtotal: item.sale.subtotal,
        discountAmount: item.sale.discountAmount,
        total: item.sale.total,
        payments: item.sale.payments.map((p) => ({ method: p.method, amount: p.amount })),
        isOffline: false,
      });
    } else if (item.source === "local" && item.operation) {
      const payload = item.operation.payload as {
        displayTotal?: number;
        discountAmount?: number;
        items?: Array<{ quantity?: number; description?: string; variantId?: string; amount?: number }>;
        payments?: Array<{ method: string; amount: number }>;
      };
      setViewingReceipt({
        saleId: item.id,
        saleCode: item.code,
        branchName: item.branch,
        date: new Date(item.createdAt).toLocaleString("es-MX", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        cashierName: null,
        items: (payload.items ?? []).map((i) => ({
          name: i.description ?? (i.variantId ? "Producto de catálogo" : "Artículo"),
          quantity: i.quantity ?? 1,
          unitPrice: (i.amount ?? 0) / (i.quantity ?? 1),
          lineTotal: i.amount ?? 0,
        })),
        subtotal: payload.displayTotal ?? 0,
        discountAmount: payload.discountAmount ?? 0,
        total: payload.displayTotal ?? 0,
        payments: payload.payments ?? [],
        isOffline: true,
      });
    }
  }

  const refresh = useCallback(async () => {
    setOperations(await listOperations());
    if (!navigator.onLine) return;
    setLoading(true);
    try {
      const today = todayDateOnly();
      const params = new URLSearchParams({ dateFrom: today, dateTo: today });
      if (branchId) params.set("branchId", branchId);
      if (soldById) params.set("soldById", soldById);
      const response = await fetch(`/api/pos/sales?${params.toString()}`);
      if (response.ok) setSales(await response.json());
    } finally {
      setLoading(false);
    }
  }, [branchId, soldById]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
    const listener = () => void refresh();
    window.addEventListener("maestro:queue-changed", listener);
    window.addEventListener("maestro:sync-finished", listener);
    return () => {
      window.removeEventListener("maestro:queue-changed", listener);
      window.removeEventListener("maestro:sync-finished", listener);
    };
  }, [refresh]);

  const branchName = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.name])), [branches]);
  const items = useMemo<ViewItem[]>(() => {
    const serverItems: ViewItem[] = sales.map((sale) => ({
      source: "server", id: sale.id, createdAt: sale.createdAt, branch: sale.branch.name, branchId: sale.branch.id,
      code: sale.code, status: sale.status, total: sale.total, detail: sale.items.map((item) => `${item.quantity} × ${item.name}`).join(", "), sale,
    }));
    const localItems: ViewItem[] = operations
      .filter((operation) => operation.kind === "pos.sale.create")
      .filter((operation) => isAdmin || localCashCutId(operation) === currentCashCutId)
      .map((operation) => {
        const payload = operation.payload as { items?: Array<{ quantity?: number; description?: string; variantId?: string }> };
        const detail = (payload.items ?? []).map((item) => `${item.quantity ?? 1} × ${item.description ?? (item.variantId ? "Producto de catálogo" : "Artículo")}`).join(", ");
        const id = operation.id;
        return { source: "local", id, createdAt: operation.createdAt, branch: branchName.get(localBranchId(operation)) ?? "Sucursal local", branchId: localBranchId(operation), code: `LOCAL-${id.slice(0, 8).toUpperCase()}`, status: operation.status, total: localTotal(operation), detail, operation };
      });
    return [...serverItems, ...localItems]
      .filter((item) => !branchId || item.branchId === branchId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [branchId, branchName, currentCashCutId, isAdmin, operations, sales]);

  async function actLocal(item: ViewItem, action: "cancel" | "retry") {
    setBusyId(item.id);
    if (action === "cancel") {
      const reason = window.prompt("Motivo de cancelación local (opcional):");
      if (reason !== null) await cancelQueuedOperation(item.id, reason);
    } else {
      await retryQueuedOperation(item.id);
      if (navigator.onLine) await syncNow();
    }
    await refresh();
    setBusyId(null);
  }

  async function resolveSale(item: ViewItem, resolutionType: "CANCELACION" | "REEMBOLSO") {
    const reason = window.prompt(`${resolutionType === "REEMBOLSO" ? "Reembolsar" : "Cancelar"} ${item.sale!.code}. Motivo:`);
    if (reason === null || !reason.trim()) return;
    setBusyId(item.id);
    const response = await fetch(`/api/pos/sales/${item.id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, resolutionType }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) window.alert(data?.error ?? "No fue posible completar la operación.");
    await refresh();
    setBusyId(null);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-primary">POSpress</p><h1 className="text-3xl font-bold text-on-surface">Transacciones</h1><p className="mt-1 text-sm text-on-surface-variant">Ventas subidas y cobros guardados en este dispositivo.</p></div>
        <div className="flex flex-wrap gap-2"><Link href="/pospress" className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant">Nueva venta</Link><Link href="/pospress/tables" className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant">Mesas</Link><Link href="/pospress/pending-tabs" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-600 dark:text-amber-400">Cuentas pendientes</Link><button onClick={() => void syncNow()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-on-primary"><RefreshIcon className="h-4 w-4" />Sincronizar</button></div>
      </header>
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface-container p-3 text-sm"><label className="text-xs font-semibold text-on-surface-variant">Sucursal<select value={branchId} onChange={(event) => setBranchId(event.target.value)} disabled={!isAdmin} className="mt-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface">{isAdmin && <option value="">Todas las sucursales</option>}{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="text-xs font-semibold text-on-surface-variant">Empleado<select value={soldById} onChange={(event) => setSoldById(event.target.value)} className="mt-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"><option value="">Todos los empleados</option>{workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></label><span className="text-on-surface-variant">{isAdmin ? "Puedes consultar las sucursales autorizadas." : "Solo puedes consultar la sucursal y el corte que tienes abiertos."} {snapshot.online ? "Conexión disponible" : "Sin conexión"} · {snapshot.pending + snapshot.failed} pendientes locales{loading ? " · actualizando…" : ""}</span></section>
      <div className="space-y-3">{items.length === 0 ? <div className="rounded-2xl border border-dashed border-outline-variant p-10 text-center text-sm text-on-surface-variant">No hay transacciones para mostrar hoy.</div> : items.map((item) => {
        const selected = selectedId === item.id;
        const local = item.source === "local";
        const terminal = local ? item.operation!.status === "failed" ? "Error de sincronización" : item.operation!.status === "cancelled" ? "Cancelada en dispositivo" : item.operation!.status === "syncing" ? "Subiendo…" : "Pendiente de subir" : item.status === "CANCELADA" ? "Cancelada / reembolsada" : "Subida a la nube";
        return <article key={`${item.source}-${item.id}`} className={`rounded-2xl border bg-surface-container p-4 ${item.status === "CANCELADA" || (local && item.operation!.status === "cancelled") ? "border-outline-variant opacity-70" : "border-outline-variant"}`}>
          <button type="button" onClick={() => setSelectedId(selected ? null : item.id)} className="flex w-full items-center justify-between gap-3 text-left"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-bold text-on-surface">{item.code}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${local && item.operation!.status === "failed" ? "bg-error/15 text-error" : item.status === "CANCELADA" || (local && item.operation!.status === "cancelled") ? "bg-outline-variant text-on-surface-variant" : local ? "bg-secondary/15 text-secondary" : "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"}`}>{terminal}</span></div><p className="mt-1 truncate text-xs text-on-surface-variant">{time(item.createdAt)} · {item.branch} · {item.detail || "Sin detalle"}</p></div><span className="shrink-0 text-lg font-bold text-on-surface">{item.total === null ? "Por confirmar" : currency(item.total)}</span></button>
          {selected && <div className="mt-4 border-t border-outline-variant pt-3 text-sm"><div className="grid gap-2 text-on-surface-variant sm:grid-cols-3"><span>Origen: <b className="text-on-surface">{local ? "Este dispositivo" : "Servidor"}</b></span><span>Estado: <b className="text-on-surface">{terminal}</b></span><span>{local ? `Intentos: ${item.operation!.attempts}` : `Cajero: ${item.sale!.soldBy.name}`}</span></div>{!local && item.sale!.payments.length > 0 && <p className="mt-2 text-xs text-on-surface-variant">Pagos: {item.sale!.payments.map((payment) => `${payment.method} ${currency(payment.amount)}`).join(" · ")}</p>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => openReceipt(item)} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition"><PrinterIcon className="h-3.5 w-3.5" />Ticket / Correo</button>{local && item.operation!.status === "failed" && <button onClick={() => void actLocal(item, "retry")} disabled={busyId === item.id} className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface">Reintentar</button>}{local && ["pending", "failed"].includes(item.operation!.status) && <button onClick={() => void actLocal(item, "cancel")} disabled={busyId === item.id} className="rounded-lg border border-error/30 px-3 py-2 text-xs font-bold text-error">Cancelar localmente</button>}{!local && canCancel && item.sale!.status !== "CANCELADA" && <><button onClick={() => void resolveSale(item, "CANCELACION")} disabled={busyId === item.id} className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface">Cancelar</button><button onClick={() => void resolveSale(item, "REEMBOLSO")} disabled={busyId === item.id} className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-on-secondary">Reembolsar</button></>}{!local && <Link href={`/pos/sales/${item.id}`} className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-primary">Ver detalle</Link>}</div>{!local && item.sale!.cancelReason && <p className="mt-3 rounded-lg bg-surface p-2 text-xs text-on-surface-variant">{item.sale!.cancelReason}</p>}</div>}
        </article>;
      })}</div>
      <p className="flex items-center gap-2 text-xs text-on-surface-variant"><AlertIcon className="h-4 w-4" />Las operaciones pendientes se conservan con el mismo identificador; no se duplica el cobro al reintentar.</p>
      {viewingReceipt && (
        <PostSaleModal
          receipt={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </main>
  );
}
