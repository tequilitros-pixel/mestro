"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertIcon, RefreshIcon } from "@/components/ui/icons";
import { cancelQueuedOperation, listOperations, retryQueuedOperation } from "@/lib/offline/queue";
import type { OfflineOperation } from "@/lib/offline/types";
import { useOfflineSync } from "@/components/offline/OfflineProvider";
import { todayDateOnly } from "@/lib/dateOnly";

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

export default function TransactionCenter({ branches, initialSales, canCancel }: { branches: Branch[]; initialSales: Sale[]; canCancel: boolean }) {
  const [sales, setSales] = useState(initialSales);
  const [operations, setOperations] = useState<OfflineOperation[]>([]);
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { snapshot, syncNow } = useOfflineSync();

  const refresh = useCallback(async () => {
    setOperations(await listOperations());
    if (!navigator.onLine) return;
    setLoading(true);
    try {
      const today = todayDateOnly();
      const params = new URLSearchParams({ dateFrom: today, dateTo: today });
      if (branchId) params.set("branchId", branchId);
      const response = await fetch(`/api/pos/sales?${params.toString()}`);
      if (response.ok) setSales(await response.json());
    } finally {
      setLoading(false);
    }
  }, [branchId]);

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
      .map((operation) => {
        const payload = operation.payload as { items?: Array<{ quantity?: number; description?: string; variantId?: string }> };
        const detail = (payload.items ?? []).map((item) => `${item.quantity ?? 1} × ${item.description ?? (item.variantId ? "Producto de catálogo" : "Artículo")}`).join(", ");
        const id = operation.id;
        return { source: "local", id, createdAt: operation.createdAt, branch: branchName.get(localBranchId(operation)) ?? "Sucursal local", branchId: localBranchId(operation), code: `LOCAL-${id.slice(0, 8).toUpperCase()}`, status: operation.status, total: localTotal(operation), detail, operation };
      });
    return [...serverItems, ...localItems]
      .filter((item) => !branchId || item.branchId === branchId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [branchId, branchName, operations, sales]);

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
        <div className="flex flex-wrap gap-2"><Link href="/pospress" className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant">Nueva venta</Link><Link href="/pospress/tables" className="rounded-xl border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant">Mesas</Link><button onClick={() => void syncNow()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-on-primary"><RefreshIcon className="h-4 w-4" />Sincronizar</button></div>
      </header>
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface-container p-3 text-sm"><select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-on-surface"><option value="">Todas las sucursales</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><span className="text-on-surface-variant">{snapshot.online ? "Conexión disponible" : "Sin conexión"} · {snapshot.pending + snapshot.failed} pendientes locales{loading ? " · actualizando…" : ""}</span></section>
      <div className="space-y-3">{items.length === 0 ? <div className="rounded-2xl border border-dashed border-outline-variant p-10 text-center text-sm text-on-surface-variant">No hay transacciones para mostrar hoy.</div> : items.map((item) => {
        const selected = selectedId === item.id;
        const local = item.source === "local";
        const terminal = local ? item.operation!.status === "failed" ? "Error de sincronización" : item.operation!.status === "cancelled" ? "Cancelada en dispositivo" : item.operation!.status === "syncing" ? "Subiendo…" : "Pendiente de subir" : item.status === "CANCELADA" ? "Cancelada / reembolsada" : "Subida a la nube";
        return <article key={`${item.source}-${item.id}`} className={`rounded-2xl border bg-surface-container p-4 ${item.status === "CANCELADA" || (local && item.operation!.status === "cancelled") ? "border-outline-variant opacity-70" : "border-outline-variant"}`}>
          <button type="button" onClick={() => setSelectedId(selected ? null : item.id)} className="flex w-full items-center justify-between gap-3 text-left"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-bold text-on-surface">{item.code}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${local && item.operation!.status === "failed" ? "bg-error/15 text-error" : item.status === "CANCELADA" || (local && item.operation!.status === "cancelled") ? "bg-outline-variant text-on-surface-variant" : local ? "bg-secondary/15 text-secondary" : "bg-tertiary-fixed-dim/15 text-tertiary-fixed-dim"}`}>{terminal}</span></div><p className="mt-1 truncate text-xs text-on-surface-variant">{time(item.createdAt)} · {item.branch} · {item.detail || "Sin detalle"}</p></div><span className="shrink-0 text-lg font-bold text-on-surface">{item.total === null ? "Por confirmar" : currency(item.total)}</span></button>
          {selected && <div className="mt-4 border-t border-outline-variant pt-3 text-sm"><div className="grid gap-2 text-on-surface-variant sm:grid-cols-3"><span>Origen: <b className="text-on-surface">{local ? "Este dispositivo" : "Servidor"}</b></span><span>Estado: <b className="text-on-surface">{terminal}</b></span><span>{local ? `Intentos: ${item.operation!.attempts}` : `Cajero: ${item.sale!.soldBy.name}`}</span></div>{!local && item.sale!.payments.length > 0 && <p className="mt-2 text-xs text-on-surface-variant">Pagos: {item.sale!.payments.map((payment) => `${payment.method} ${currency(payment.amount)}`).join(" · ")}</p>}<div className="mt-3 flex flex-wrap gap-2">{local && item.operation!.status === "failed" && <button onClick={() => void actLocal(item, "retry")} disabled={busyId === item.id} className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface">Reintentar</button>}{local && ["pending", "failed"].includes(item.operation!.status) && <button onClick={() => void actLocal(item, "cancel")} disabled={busyId === item.id} className="rounded-lg border border-error/30 px-3 py-2 text-xs font-bold text-error">Cancelar localmente</button>}{!local && canCancel && item.sale!.status !== "CANCELADA" && <><button onClick={() => void resolveSale(item, "CANCELACION")} disabled={busyId === item.id} className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface">Cancelar</button><button onClick={() => void resolveSale(item, "REEMBOLSO")} disabled={busyId === item.id} className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-on-secondary">Reembolsar</button></>}{!local && <Link href={`/pos/sales/${item.id}`} className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-primary">Ver detalle</Link>}</div>{!local && item.sale!.cancelReason && <p className="mt-3 rounded-lg bg-surface p-2 text-xs text-on-surface-variant">{item.sale!.cancelReason}</p>}</div>}
        </article>;
      })}</div>
      <p className="flex items-center gap-2 text-xs text-on-surface-variant"><AlertIcon className="h-4 w-4" />Las operaciones pendientes se conservan con el mismo identificador; no se duplica el cobro al reintentar.</p>
    </main>
  );
}
