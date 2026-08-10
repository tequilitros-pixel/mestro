"use client";

import { useState } from "react";
import {
  updateBranchAddressAction,
  updateBranchColorAction,
  assignGeofenceToBranchAction,
  createGeofenceAction,
  deleteGeofenceAction,
} from "@/app/actions/geofences";
import { Card, CardLabel } from "@/components/ui/Card";
import { MapPinIcon, TrashIcon, PlusIcon, XIcon, SearchIcon } from "@/components/ui/icons";
import LocationPicker from "@/components/LocationPicker";
import { useToast } from "@/components/ui/Toast";
import { BRANCH_COLOR_PALETTE, fallbackBranchColor } from "@/lib/branchColors";

type Branch = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  active: boolean;
  color: string | null;
  geofenceId: string | null;
  geofence: { id: string; name: string; radius: number } | null;
};

type Geofence = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  createdAt: string;
  updatedAt: string;
  branches: { id: string; name: string }[];
};

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Este navegador no soporta geolocalización."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

export default function GeofencesManager({
  initialBranches,
  initialGeofences,
}: {
  initialBranches: Branch[];
  initialGeofences: Geofence[];
}) {
  const [branches, setBranches] = useState(initialBranches);
  const [geofences, setGeofences] = useState(initialGeofences);

  function applyBranchPatch(branchId: string, patch: Partial<Branch>) {
    setBranches((prev) =>
      prev.map((b) => (b.id === branchId ? { ...b, ...patch } : b)),
    );
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Sucursales</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Edita la dirección de cada sucursal y asígnale una geozona para
            restringir dónde pueden checar sus empleados.
          </p>
        </div>

        <div className="space-y-3">
          {branches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              geofences={geofences}
              onAddressSaved={(address) => applyBranchPatch(branch.id, { address })}
              onGeofenceAssigned={(geofenceId, geofence) =>
                applyBranchPatch(branch.id, { geofenceId, geofence })
              }
              onColorSaved={(color) => applyBranchPatch(branch.id, { color })}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-on-surface">Geozonas</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Crea o elimina geozonas. Al eliminar una geozona, las
              sucursales que la tenían asignada se quedan sin geozona.
            </p>
          </div>
        </div>

        <NewGeofenceForm
          onCreated={(geofence) =>
            setGeofences((prev) =>
              [...prev, { ...geofence, branches: [] }].sort((a, b) =>
                a.name.localeCompare(b.name),
              ),
            )
          }
        />

        <div className="space-y-2">
          {geofences.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-outline-variant p-6 text-center text-sm text-on-surface-variant">
              Aún no hay geozonas creadas.
            </p>
          ) : (
            geofences.map((g) => (
              <GeofenceRow
                key={g.id}
                geofence={g}
                onDeleted={() => {
                  setGeofences((prev) => prev.filter((x) => x.id !== g.id));
                  setBranches((prev) =>
                    prev.map((b) =>
                      b.geofenceId === g.id
                        ? { ...b, geofenceId: null, geofence: null }
                        : b,
                    ),
                  );
                }}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function BranchCard({
  branch,
  geofences,
  onAddressSaved,
  onGeofenceAssigned,
  onColorSaved,
}: {
  branch: Branch;
  geofences: Geofence[];
  onAddressSaved: (address: string | null) => void;
  onGeofenceAssigned: (
    geofenceId: string | null,
    geofence: { id: string; name: string; radius: number } | null,
  ) => void;
  onColorSaved: (color: string | null) => void;
}) {
  const [editingAddress, setEditingAddress] = useState(false);
  const [address, setAddress] = useState(branch.address ?? "");
  const [savingAddress, setSavingAddress] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function handleSetColor(color: string | null) {
    setSavingColor(true);
    setError(null);
    const result = await updateBranchColorAction(branch.id, color);
    setSavingColor(false);

    if (!("success" in result)) {
      setError(result.error);
      return;
    }

    onColorSaved(color);
    showToast(color ? "Color de sucursal guardado." : "Color quitado, se usará uno automático.");
  }

  async function handleSaveAddress() {
    setSavingAddress(true);
    setError(null);
    const result = await updateBranchAddressAction(branch.id, address);
    setSavingAddress(false);

    if (!("success" in result)) {
      setError(result.error);
      return;
    }

    onAddressSaved(address.trim() === "" ? null : address.trim());
    setEditingAddress(false);
    showToast("Dirección guardada correctamente.");
  }

  async function handleAssign(geofenceId: string) {
    setSavingAssignment(true);
    setError(null);
    const result = await assignGeofenceToBranchAction(
      branch.id,
      geofenceId === "" ? null : geofenceId,
    );
    setSavingAssignment(false);

    if (!("success" in result)) {
      setError(result.error);
      return;
    }

    const geofence = geofences.find((g) => g.id === geofenceId) ?? null;
    onGeofenceAssigned(
      geofenceId === "" ? null : geofenceId,
      geofence ? { id: geofence.id, name: geofence.name, radius: geofence.radius } : null,
    );
    showToast(
      geofenceId === "" ? "Geozona quitada de la sucursal." : "Geozona asignada correctamente.",
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <CardLabel>{branch.code}</CardLabel>
          <div className="flex items-center gap-2">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full border border-outline-variant/50"
              style={{ backgroundColor: branch.color ?? fallbackBranchColor(branch.id) }}
            />
            <p className="text-lg font-bold text-on-surface">{branch.name}</p>
          </div>

          {!editingAddress ? (
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-on-surface-variant">
                {branch.address ?? "Sin dirección configurada"}
              </p>
              <button
                onClick={() => {
                  setAddress(branch.address ?? "");
                  setEditingAddress(true);
                }}
                className="text-xs font-semibold text-on-surface-variant hover:text-primary hover:underline"
              >
                Editar
              </button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección de la sucursal"
                className="min-w-[220px] flex-1 rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
              />
              <button
                onClick={handleSaveAddress}
                disabled={savingAddress}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-on-primary transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
              >
                {savingAddress ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => setEditingAddress(false)}
                className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface-variant hover:border-outline"
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-on-surface-variant">Color en Horario</span>

            {BRANCH_COLOR_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => handleSetColor(c)}
                disabled={savingColor}
                aria-label={`Usar color ${c}`}
                className={`h-6 w-6 shrink-0 rounded-full border-2 transition disabled:opacity-60 ${
                  branch.color === c ? "border-on-surface" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}

            <input
              type="color"
              value={branch.color ?? fallbackBranchColor(branch.id)}
              onChange={(e) => handleSetColor(e.target.value)}
              disabled={savingColor}
              aria-label="Color personalizado"
              className="h-6 w-8 shrink-0 cursor-pointer rounded border border-outline-variant bg-transparent p-0 disabled:opacity-60"
            />

            {branch.color && (
              <button
                onClick={() => handleSetColor(null)}
                disabled={savingColor}
                className="text-xs text-on-surface-variant hover:text-error disabled:opacity-60"
              >
                Quitar
              </button>
            )}
          </div>
        </div>

        <div className="w-full max-w-[220px] shrink-0 sm:w-auto">
          <label className="block space-y-1">
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant">
              <MapPinIcon className="h-3.5 w-3.5" />
              Geozona
            </span>
            <select
              value={branch.geofenceId ?? ""}
              onChange={(e) => handleAssign(e.target.value)}
              disabled={savingAssignment}
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary disabled:opacity-60"
            >
              <option value="">Sin geozona</option>
              {geofences.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.radius} m)
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </Card>
  );
}

function GeofenceRow({
  geofence,
  onDeleted,
}: {
  geofence: Geofence;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function handleDelete() {
    if (
      !window.confirm(
        `¿Eliminar la geozona "${geofence.name}"? Las sucursales asignadas se quedarán sin geozona.`,
      )
    ) {
      return;
    }

    setDeleting(true);
    setError(null);
    const result = await deleteGeofenceAction(geofence.id);
    setDeleting(false);

    if (!("success" in result)) {
      setError(result.error);
      return;
    }

    onDeleted();
    showToast("Geozona eliminada correctamente.");
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-bold text-on-surface">{geofence.name}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {geofence.latitude.toFixed(6)}, {geofence.longitude.toFixed(6)} ·
            radio {geofence.radius} m
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {geofence.branches.length === 0
              ? "Sin sucursales asignadas"
              : `Asignada a: ${geofence.branches.map((b) => b.name).join(", ")}`}
          </p>
          {error && <p className="mt-1 text-xs text-error">{error}</p>}
        </div>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error transition hover:bg-error/10 disabled:opacity-60"
        >
          <TrashIcon className="h-3.5 w-3.5" />
          {deleting ? "Eliminando..." : "Eliminar"}
        </button>
      </div>
    </Card>
  );
}

function NewGeofenceForm({
  onCreated,
}: {
  onCreated: (geofence: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
    createdAt: string;
    updatedAt: string;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("150");
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function handleUseMyLocation() {
    setError(null);
    setLocating(true);
    try {
      const position = await getCurrentPosition();
      setLatitude(position.coords.latitude.toString());
      setLongitude(position.coords.longitude.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo obtener tu ubicación.");
    } finally {
      setLocating(false);
    }
  }

  async function handleSearchAddress() {
    if (!addressQuery.trim()) {
      setSearchNotice("Escribe o pega una dirección para buscarla.");
      return;
    }

    setSearchNotice(null);
    setError(null);
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        addressQuery.trim(),
      )}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });

      if (!res.ok) {
        throw new Error("No se pudo buscar la dirección. Intenta de nuevo.");
      }

      const results: { lat: string; lon: string; display_name: string }[] = await res.json();

      if (results.length === 0) {
        setSearchNotice(
          "No se encontró esa dirección. Ajusta el texto o mueve el pin manualmente en el mapa.",
        );
        return;
      }

      setLatitude(results[0].lat);
      setLongitude(results[0].lon);
      setSearchNotice(`Ubicado: ${results[0].display_name}. Verifica el pin y ajústalo si hace falta.`);
    } catch (err) {
      setSearchNotice(
        err instanceof Error ? err.message : "No se pudo buscar la dirección.",
      );
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const lat = Number(latitude);
    const lng = Number(longitude);
    const rad = Number(radius);

    setSaving(true);
    const result = await createGeofenceAction({ name, latitude: lat, longitude: lng, radius: rad });
    setSaving(false);

    if (!("success" in result)) {
      setError(result.error);
      return;
    }

    onCreated({
      ...result.geofence,
      createdAt: result.geofence.createdAt.toISOString(),
      updatedAt: result.geofence.updatedAt.toISOString(),
    });
    setName("");
    setAddressQuery("");
    setLatitude("");
    setLongitude("");
    setRadius("150");
    setSearchNotice(null);
    setOpen(false);
    showToast("Geozona creada correctamente.");
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition hover:border-primary/25 hover:text-primary"
      >
        <PlusIcon className="h-4 w-4" />
        Nueva geozona
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-on-surface">Nueva geozona</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-on-surface-variant hover:text-on-surface"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-semibold text-on-surface-variant">Nombre</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Planta Jalpa"
          className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-semibold text-on-surface-variant">
          Buscar dirección para verificarla en el mapa
        </span>
        <div className="flex gap-2">
          <input
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearchAddress();
              }
            }}
            placeholder="Pega o escribe la dirección de la sucursal"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
          <button
            type="button"
            onClick={handleSearchAddress}
            disabled={searching}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-2 text-xs font-semibold text-on-surface transition hover:border-primary/25 hover:text-primary disabled:opacity-60"
          >
            <SearchIcon className="h-3.5 w-3.5" />
            {searching ? "Buscando..." : "Buscar"}
          </button>
        </div>
        {searchNotice && <p className="text-xs text-on-surface-variant">{searchNotice}</p>}
      </label>

      <LocationPicker
        latitude={latitude.trim() === "" ? null : Number(latitude)}
        longitude={longitude.trim() === "" ? null : Number(longitude)}
        onChange={(lat, lng) => {
          setLatitude(lat.toString());
          setLongitude(lng.toString());
        }}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-on-surface-variant">Latitud</span>
          <input
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="21.123456"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-on-surface-variant">Longitud</span>
          <input
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="-102.123456"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-on-surface-variant">Radio (metros)</span>
          <input
            type="number"
            min="10"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={handleUseMyLocation}
        disabled={locating}
        className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-high px-3 py-2 text-xs font-semibold text-on-surface transition hover:border-primary/25 disabled:opacity-60"
      >
        <MapPinIcon className="h-3.5 w-3.5" />
        {locating ? "Ubicando..." : "Usar mi ubicación actual"}
      </button>

      {error && <p className="text-xs text-error">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-on-primary transition duration-150 ease-out hover:opacity-90 hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100"
      >
        {saving ? "Creando..." : "Crear geozona"}
      </button>
    </form>
  );
}
