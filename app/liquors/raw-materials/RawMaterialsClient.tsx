"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardLabel, CardValue } from "@/components/ui/Card";
import PageTabs from "@/components/ui/PageTabs";
import {
  PackageIcon,
  AlertIcon,
  ClipboardIcon,
  ArrowsRangeIcon,
  PlusIcon,
  FlaskIcon,
} from "@/components/ui/icons";
import {
  createRawMaterialAction,
  updateRawMaterialAction,
  registerMovementAction,
  transferToBranchAction,
  setLotOutputMaterialAction,
} from "@/app/actions/rawMaterials";

type Material = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  baseUnit: string;
  currentStock: number;
  minimumStock: number;
  averageCost: number | null;
  active: boolean;
  receivesLotOutput: boolean;
  usedInRecipes: number;
  bottleable: boolean;
  bottlePrefix: string | null;
  defaultShelfLifeDays: number | null;
  yellowAlertDays: number | null;
  redAlertDays: number | null;
  showExpirationOnLabel: boolean;
  inventoryProductId: string | null;
};

type Movement = {
  id: string;
  type: string;
  quantity: number;
  unitCost: number | null;
  notes: string | null;
  createdAt: string;
  materialName: string;
  materialUnit: string;
  lotCode: string | null;
  batchCode: string | null;
  branchName: string | null;
  userName: string | null;
};

type Option = { id: string; name: string };

const TYPE_LABELS: Record<string, string> = {
  COMPRA: "Compra",
  PRODUCCION: "Producción propia",
  CONSUMO_RECETA: "Consumo en receta",
  AJUSTE: "Ajuste",
  MERMA: "Merma",
  TRASPASO_SUCURSAL: "Traspaso a sucursal",
};

const money = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
      }).format(value);

const qty = (value: number) =>
  new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 }).format(value);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function RawMaterialsClient({
  canEdit,
  materials,
  movements,
  branches,
  inventoryProducts,
}: {
  canEdit: boolean;
  materials: Material[];
  movements: Movement[];
  branches: Option[];
  inventoryProducts: Array<{ id: string; name: string; unit: string }>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const activeMaterials = materials.filter((m) => m.active);

  const totals = useMemo(() => {
    const value = materials.reduce(
      (sum, m) => sum + m.currentStock * (m.averageCost ?? 0),
      0,
    );

    const lowStock = activeMaterials.filter(
      (m) => m.minimumStock > 0 && m.currentStock <= m.minimumStock,
    );

    const outOfStock = activeMaterials.filter((m) => m.currentStock <= 0);

    const withoutCost = activeMaterials.filter((m) => m.averageCost === null);

    return { value, lowStock, outOfStock, withoutCost };
  }, [materials, activeMaterials]);

  const filtered = materials.filter((m) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      m.name.toLowerCase().includes(term) ||
      m.code.toLowerCase().includes(term) ||
      (m.category ?? "").toLowerCase().includes(term)
    );
  });

  function handleResult(result: { success: boolean; message?: string; error?: string }) {
    if (result.success) {
      setMessage(result.message ?? "Listo.");
      setError(null);
      setEditingId(null);
      setCreating(false);
      router.refresh();
    } else {
      setError(result.error ?? "Ocurrió un error.");
      setMessage(null);
    }
  }

  const banner = (
    <>
      {message && (
        <div className="rounded-xl border border-tertiary-fixed-dim/40 bg-tertiary-fixed-dim/10 p-3 text-sm text-tertiary-fixed-dim">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-error/40 bg-error/10 p-3 text-sm text-error">
          {error}
        </div>
      )}

      {!canEdit && (
        <div className="rounded-xl border border-outline-variant bg-surface-container p-3 text-sm text-on-surface-variant">
          Solo un administrador o gerente puede registrar compras, ajustes y
          traspasos. Puedes consultar la información.
        </div>
      )}
    </>
  );

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-on-surface sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="font-mono text-sm font-black uppercase tracking-[0.3em] text-on-surface-variant">
            Elaboración de licores
          </p>

          <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold sm:text-4xl">
            <FlaskIcon className="h-8 w-8 text-on-surface-variant" />
            Materia prima
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
            Almacén de producción: lo que entra por compra, lo que produce la
            destilería y lo que se consume al elaborar cada receta.
          </p>
        </div>

        <PageTabs
          tabs={[
            {
              key: "existencias",
              label: "Existencias",
              icon: <PackageIcon className="h-4 w-4" />,
              content: (
                <div className="space-y-6">
                  {banner}

                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <Card>
                      <CardLabel>Valor del almacén</CardLabel>
                      <CardValue>{money(totals.value)}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        A costo promedio
                      </p>
                    </Card>

                    <Card>
                      <CardLabel>Materiales activos</CardLabel>
                      <CardValue>{activeMaterials.length}</CardValue>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        de {materials.length} en catálogo
                      </p>
                    </Card>

                    <Card>
                      <CardLabel>Bajo mínimo</CardLabel>
                      <p
                        className={`text-2xl font-bold ${
                          totals.lowStock.length > 0 ? "text-error" : "text-on-surface"
                        }`}
                      >
                        {totals.lowStock.length}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {totals.outOfStock.length} agotados
                      </p>
                    </Card>

                    <Card>
                      <CardLabel>Sin costo capturado</CardLabel>
                      <p
                        className={`text-2xl font-bold ${
                          totals.withoutCost.length > 0
                            ? "text-secondary"
                            : "text-on-surface"
                        }`}
                      >
                        {totals.withoutCost.length}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        No suman al valor
                      </p>
                    </Card>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por nombre, código o categoría..."
                      className="min-w-[240px] flex-1 rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none placeholder:text-outline focus:border-primary"
                    />

                    {canEdit && (
                      <button
                        onClick={() => setCreating((v) => !v)}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Nueva materia prima
                      </button>
                    )}
                  </div>

                  {creating && canEdit && (
                    <Card>
                      <CardLabel>Nueva materia prima</CardLabel>

                      <form
                        action={async (formData) =>
                          handleResult(await createRawMaterialAction(formData))
                        }
                        className="mt-4 space-y-4"
                      >
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <TextField name="code" label="Código" required placeholder="MP-TEQ-001" />
                          <TextField name="name" label="Nombre" required placeholder="Tequila blanco a granel" />
                          <TextField name="baseUnit" label="Unidad base" required placeholder="L" />
                          <TextField name="category" label="Categoría" placeholder="Destilados" />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <TextField
                            name="minimumStock"
                            label="Existencia mínima"
                            type="number"
                            placeholder="0"
                          />
                        </div>

                        <button
                          type="submit"
                          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90"
                        >
                          Crear
                        </button>
                      </form>
                    </Card>
                  )}

                  <Card>
                    <CardLabel>Catálogo y existencias</CardLabel>

                    {filtered.length === 0 ? (
                      <p className="mt-3 text-sm text-on-surface-variant">
                        No hay materias primas que coincidan.
                      </p>
                    ) : (
                      <div className="mt-3 divide-y divide-outline-variant">
                        {filtered.map((material) => {
                          const low =
                            material.minimumStock > 0 &&
                            material.currentStock <= material.minimumStock;

                          return (
                            <div key={material.id} className="py-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-on-surface">
                                    {material.name}
                                    {material.receivesLotOutput && (
                                      <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                                        Recibe destilado
                                      </span>
                                    )}
                                    {!material.active && (
                                      <span className="ml-2 rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
                                        Inactivo
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-outline">
                                    {material.code}
                                    {material.category ? ` · ${material.category}` : ""}
                                    {material.usedInRecipes > 0
                                      ? ` · en ${material.usedInRecipes} receta(s)`
                                      : " · sin recetas"}
                                  </p>
                                </div>

                                <div className="flex items-center gap-4 text-right">
                                  <div>
                                    <p
                                      className={`font-bold ${low ? "text-error" : "text-on-surface"}`}
                                    >
                                      {qty(material.currentStock)} {material.baseUnit}
                                    </p>
                                    <p className="text-xs text-on-surface-variant">
                                      mín {qty(material.minimumStock)} ·{" "}
                                      {money(material.averageCost)}
                                    </p>
                                  </div>

                                  {canEdit && (
                                    <button
                                      onClick={() =>
                                        setEditingId(
                                          editingId === material.id ? null : material.id,
                                        )
                                      }
                                      className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high"
                                    >
                                      {editingId === material.id ? "Cerrar" : "Editar"}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {editingId === material.id && canEdit && (
                                <form
                                  action={async (formData) =>
                                    handleResult(
                                      await updateRawMaterialAction(material.id, formData),
                                    )
                                  }
                                  className="mt-4 space-y-4 rounded-xl border border-outline-variant bg-background/40 p-4"
                                >
                                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    <TextField
                                      name="name"
                                      label="Nombre"
                                      required
                                      defaultValue={material.name}
                                    />
                                    <TextField
                                      name="baseUnit"
                                      label="Unidad base"
                                      required
                                      defaultValue={material.baseUnit}
                                    />
                                    <TextField
                                      name="category"
                                      label="Categoría"
                                      defaultValue={material.category ?? ""}
                                    />
                                    <TextField
                                      name="minimumStock"
                                      label="Existencia mínima"
                                      type="number"
                                      defaultValue={String(material.minimumStock)}
                                    />
                                  </div>

                                  <label className="flex items-center gap-3 text-sm text-on-surface-variant">
                                    <input
                                      type="checkbox"
                                      name="active"
                                      defaultChecked={material.active}
                                      className="h-4 w-4"
                                    />
                                    Activo
                                  </label>

                                  <div className="space-y-4 border-t border-outline-variant pt-4">
                                    <div>
                                      <p className="text-sm font-bold text-on-surface">
                                        Embotellado
                                      </p>
                                      <p className="mt-1 text-xs text-outline">
                                        Para el granel que se embotella directo, como el
                                        tequila que sale del proceso. Los licores que se
                                        elaboran con receta no usan esto.
                                      </p>
                                    </div>

                                    <label className="flex items-center gap-3 text-sm text-on-surface-variant">
                                      <input
                                        type="checkbox"
                                        name="bottleable"
                                        defaultChecked={material.bottleable}
                                        className="h-4 w-4"
                                      />
                                      Se puede embotellar desde esta existencia
                                    </label>

                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                      <TextField
                                        name="bottlePrefix"
                                        label="Prefijo de folio"
                                        placeholder="TQB"
                                        defaultValue={material.bottlePrefix ?? ""}
                                      />
                                      <TextField
                                        name="defaultShelfLifeDays"
                                        label="Vida útil (días)"
                                        type="number"
                                        defaultValue={
                                          material.defaultShelfLifeDays !== null
                                            ? String(material.defaultShelfLifeDays)
                                            : ""
                                        }
                                      />
                                      <TextField
                                        name="yellowAlertDays"
                                        label="Alerta amarilla (días)"
                                        type="number"
                                        defaultValue={
                                          material.yellowAlertDays !== null
                                            ? String(material.yellowAlertDays)
                                            : ""
                                        }
                                      />
                                      <TextField
                                        name="redAlertDays"
                                        label="Alerta roja (días)"
                                        type="number"
                                        defaultValue={
                                          material.redAlertDays !== null
                                            ? String(material.redAlertDays)
                                            : ""
                                        }
                                      />
                                    </div>

                                    <label className="flex items-center gap-3 text-sm text-on-surface-variant">
                                      <input
                                        type="checkbox"
                                        name="showExpirationOnLabel"
                                        defaultChecked={material.showExpirationOnLabel}
                                        className="h-4 w-4"
                                      />
                                      Imprimir la caducidad en la etiqueta
                                    </label>

                                    <label className="block">
                                      <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                                        Producto de inventario equivalente
                                      </span>
                                      <select
                                        name="inventoryProductId"
                                        defaultValue={material.inventoryProductId ?? ""}
                                        className="w-full rounded-xl border border-outline-variant bg-background px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                                      >
                                        <option value="">Sin vincular</option>
                                        {inventoryProducts.map((p) => (
                                          <option key={p.id} value={p.id}>
                                            {p.name} ({p.unit})
                                          </option>
                                        ))}
                                      </select>
                                      <span className="mt-1 block text-xs text-outline">
                                        Se usa como destino sugerido al traspasar a una
                                        sucursal.
                                      </span>
                                    </label>
                                  </div>

                                  <p className="text-xs text-outline">
                                    La existencia no se edita aquí: se mueve con compras,
                                    ajustes y mermas para que quede el rastro.
                                  </p>

                                  <div className="flex flex-wrap gap-3">
                                    <button
                                      type="submit"
                                      className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90"
                                    >
                                      Guardar
                                    </button>

                                    {!material.receivesLotOutput && (
                                      <button
                                        type="button"
                                        onClick={async () =>
                                          handleResult(
                                            await setLotOutputMaterialAction(material.id),
                                          )
                                        }
                                        className="rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-bold text-on-surface-variant transition hover:text-on-surface"
                                      >
                                        Marcar como receptor del destilado
                                      </button>
                                    )}
                                  </div>
                                </form>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </div>
              ),
            },

            {
              key: "movimientos",
              label: "Registrar movimiento",
              icon: <ClipboardIcon className="h-4 w-4" />,
              content: (
                <div className="space-y-6">
                  {banner}

                  {canEdit ? (
                    <Card>
                      <CardLabel>Compra, ajuste o merma</CardLabel>

                      <form
                        action={async (formData) =>
                          handleResult(await registerMovementAction(formData))
                        }
                        className="mt-4 space-y-4"
                      >
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <label className="block">
                            <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                              Materia prima
                            </span>
                            <select
                              name="rawMaterialId"
                              required
                              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                            >
                              <option value="">Selecciona...</option>
                              {activeMaterials.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.baseUnit})
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block">
                            <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                              Tipo
                            </span>
                            <select
                              name="type"
                              required
                              defaultValue="COMPRA"
                              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                            >
                              <option value="COMPRA">Compra</option>
                              <option value="AJUSTE">Ajuste</option>
                              <option value="MERMA">Merma</option>
                            </select>
                          </label>

                          <TextField
                            name="amount"
                            label="Cantidad"
                            type="number"
                            required
                            placeholder="0"
                          />

                          <TextField
                            name="unitCost"
                            label="Costo unitario"
                            type="number"
                            placeholder="Solo en compras"
                          />
                        </div>

                        <label className="flex items-center gap-3 text-sm text-on-surface-variant">
                          <input type="checkbox" name="negative" className="h-4 w-4" />
                          El ajuste resta existencia (déjalo sin marcar si suma)
                        </label>

                        <TextField name="notes" label="Notas" placeholder="Factura, proveedor, motivo..." />

                        <button
                          type="submit"
                          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90"
                        >
                          Registrar movimiento
                        </button>
                      </form>
                    </Card>
                  ) : (
                    <Card className="text-center">
                      <p className="text-sm text-on-surface-variant">
                        No tienes permiso para registrar movimientos.
                      </p>
                    </Card>
                  )}
                </div>
              ),
            },

            {
              key: "traspasos",
              label: "Traspaso a sucursal",
              icon: <ArrowsRangeIcon className="h-4 w-4" />,
              content: (
                <div className="space-y-6">
                  {banner}

                  {canEdit ? (
                    <Card>
                      <CardLabel>Enviar material a una sucursal</CardLabel>

                      <form
                        action={async (formData) =>
                          handleResult(await transferToBranchAction(formData))
                        }
                        className="mt-4 space-y-4"
                      >
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <label className="block">
                            <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                              Materia prima
                            </span>
                            <select
                              name="rawMaterialId"
                              required
                              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                            >
                              <option value="">Selecciona...</option>
                              {activeMaterials.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} — {qty(m.currentStock)} {m.baseUnit}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block">
                            <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                              Sucursal destino
                            </span>
                            <select
                              name="branchId"
                              required
                              className="w-full rounded-xl border border-outline-variant bg-background px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                            >
                              <option value="">Selecciona...</option>
                              {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <TextField
                            name="amount"
                            label="Cantidad"
                            type="number"
                            required
                            placeholder="0"
                          />
                        </div>

                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
                            Producto de inventario equivalente
                          </span>
                          <select
                            name="inventoryProductId"
                            className="w-full rounded-xl border border-outline-variant bg-background px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
                          >
                            <option value="">
                              No abonar al inventario de la sucursal
                            </option>
                            {inventoryProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.unit})
                              </option>
                            ))}
                          </select>
                          <span className="mt-1 block text-xs text-outline">
                            Si lo eliges, la cantidad también entra al stock que consume
                            el Punto de Venta.
                          </span>
                        </label>

                        <TextField name="notes" label="Notas" placeholder="Motivo del envío..." />

                        <button
                          type="submit"
                          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90"
                        >
                          Registrar traspaso
                        </button>
                      </form>
                    </Card>
                  ) : (
                    <Card className="text-center">
                      <p className="text-sm text-on-surface-variant">
                        No tienes permiso para registrar traspasos.
                      </p>
                    </Card>
                  )}
                </div>
              ),
            },

            {
              key: "historial",
              label: "Historial",
              icon: <ClipboardIcon className="h-4 w-4" />,
              content: (
                <Card>
                  <CardLabel>Últimos movimientos</CardLabel>

                  {movements.length === 0 ? (
                    <p className="mt-3 text-sm text-on-surface-variant">
                      Todavía no hay movimientos registrados.
                    </p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead>
                          <tr className="border-b border-outline-variant text-left text-xs text-outline">
                            <th className="pb-2 font-medium">Fecha</th>
                            <th className="pb-2 font-medium">Material</th>
                            <th className="pb-2 font-medium">Tipo</th>
                            <th className="pb-2 text-right font-medium">Cantidad</th>
                            <th className="pb-2 font-medium">Origen / destino</th>
                            <th className="pb-2 font-medium">Registró</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                          {movements.map((mv) => (
                            <tr key={mv.id}>
                              <td className="py-3 text-xs text-on-surface-variant">
                                {formatDate(mv.createdAt)}
                              </td>
                              <td className="py-3 font-semibold text-on-surface">
                                {mv.materialName}
                              </td>
                              <td className="py-3 text-xs text-on-surface-variant">
                                {TYPE_LABELS[mv.type] ?? mv.type}
                              </td>
                              <td
                                className={`py-3 text-right font-bold ${
                                  mv.quantity < 0
                                    ? "text-error"
                                    : "text-tertiary-fixed-dim"
                                }`}
                              >
                                {mv.quantity > 0 ? "+" : ""}
                                {qty(mv.quantity)} {mv.materialUnit}
                              </td>
                              <td className="py-3 text-xs text-on-surface-variant">
                                {mv.lotCode
                                  ? `Lote ${mv.lotCode}`
                                  : mv.batchCode
                                    ? `Elaboración ${mv.batchCode}`
                                    : mv.branchName
                                      ? mv.branchName
                                      : "—"}
                              </td>
                              <td className="py-3 text-xs text-on-surface-variant">
                                {mv.userName ?? "Automático"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              ),
            },

            {
              key: "alertas",
              label: "Alertas",
              icon: <AlertIcon className="h-4 w-4" />,
              content: (
                <div className="space-y-6">
                  <Card>
                    <CardLabel>Por debajo del mínimo</CardLabel>

                    {totals.lowStock.length === 0 ? (
                      <p className="mt-3 text-sm text-on-surface-variant">
                        Ninguna materia prima está por debajo de su mínimo.
                      </p>
                    ) : (
                      <div className="mt-3 divide-y divide-outline-variant">
                        {totals.lowStock.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-4 py-3"
                          >
                            <div>
                              <p className="font-semibold text-on-surface">{m.name}</p>
                              <p className="text-xs text-on-surface-variant">
                                {m.category ?? "Sin categoría"}
                              </p>
                            </div>

                            <p className="text-right font-bold text-error">
                              {qty(m.currentStock)} / {qty(m.minimumStock)} {m.baseUnit}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card>
                    <CardLabel>Sin costo capturado</CardLabel>

                    {totals.withoutCost.length === 0 ? (
                      <p className="mt-3 text-sm text-on-surface-variant">
                        Todas las materias primas tienen costo promedio.
                      </p>
                    ) : (
                      <>
                        <p className="mt-2 text-xs text-outline">
                          Estas no suman al valor del almacén ni al costo de las
                          recetas. Captura una compra con costo para calcularlo.
                        </p>

                        <div className="mt-3 divide-y divide-outline-variant">
                          {totals.withoutCost.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between gap-4 py-3"
                            >
                              <p className="font-semibold text-on-surface">{m.name}</p>
                              <p className="text-sm text-on-surface-variant">
                                {qty(m.currentStock)} {m.baseUnit}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </div>
    </main>
  );
}

function TextField({
  name,
  label,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-on-surface-variant">
        {label}
        {required && (
          <span className="ml-1 text-error" aria-hidden="true">
            *
          </span>
        )}
      </span>

      <input
        name={name}
        type={type}
        step={type === "number" ? "0.001" : undefined}
        min={type === "number" ? "0" : undefined}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="peer w-full rounded-xl border border-outline-variant bg-background px-4 py-2.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary user-invalid:border-error"
      />

      {required && (
        <span className="mt-1 hidden text-xs font-semibold text-error peer-user-invalid:block">
          Este dato es obligatorio.
        </span>
      )}
    </label>
  );
}
