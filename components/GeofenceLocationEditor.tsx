"use client";

import { useRef, useState } from "react";
import { searchBranchAddressAction } from "@/app/actions/workforceBranches";
import LocationPicker from "@/components/LocationPicker";
import {
  applyCurrentLocation,
  initialGeofenceLocation,
  moveGeofencePin,
  normalizeGeofenceRadius,
  selectGeocoderResult,
  setGeofenceRadius,
  type GeofenceLocationDraft,
} from "@/lib/workforce/geofenceLocation";

type SearchResult = {
  placeId: string;
  displayName: string;
  latitude: number;
  longitude: number;
};

function numberOrNull(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export default function GeofenceLocationEditor({
  address,
  latitude,
  longitude,
  radius,
  onAddressChange,
  onCoordinatesChange,
  onRadiusChange,
  onSave,
  saveBusy,
}: {
  address: string;
  latitude: string;
  longitude: string;
  radius: string;
  onAddressChange: (value: string) => void;
  onCoordinatesChange: (latitude: number, longitude: number) => void;
  onRadiusChange: (value: string) => void;
  onSave: () => void;
  saveBusy: boolean;
}) {
  const [query, setQuery] = useState(address);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lastSearchAt = useRef(0);

  function currentDraft(): GeofenceLocationDraft {
    return initialGeofenceLocation({
      label: address,
      latitude: numberOrNull(latitude),
      longitude: numberOrNull(longitude),
      radius: numberOrNull(radius),
    });
  }

  function applyDraft(next: GeofenceLocationDraft) {
    onAddressChange(next.label);
    if (next.latitude !== null && next.longitude !== null) {
      onCoordinatesChange(next.latitude, next.longitude);
    }
    onRadiusChange(String(next.radius));
  }

  async function search() {
    const normalized = query.trim();
    if (normalized.length < 3) {
      setResults([]);
      setMessage("Escribe al menos 3 caracteres para buscar.");
      return;
    }
    if (Date.now() - lastSearchAt.current < 1000) {
      setMessage("Espera un momento antes de buscar otra vez.");
      return;
    }
    lastSearchAt.current = Date.now();
    setSearchBusy(true);
    setMessage(null);
    const result = await searchBranchAddressAction(normalized);
    setSearchBusy(false);
    if (result.error) {
      setResults([]);
      setMessage(result.error);
      return;
    }
    setResults(result.results);
    setMessage(result.results.length ? "Selecciona un resultado para mover el pin. No se guarda todavía." : "No encontramos lugares con esa búsqueda.");
  }

  function chooseResult(result: SearchResult) {
    const next = selectGeocoderResult(currentDraft(), result);
    applyDraft(next);
    setQuery(result.displayName);
    setResults([]);
    setMessage("Ubicación seleccionada. Pulsa Guardar geozona para persistirla.");
  }

  function updatePin(nextLatitude: number, nextLongitude: number) {
    const next = moveGeofencePin(currentDraft(), nextLatitude, nextLongitude);
    applyDraft(next);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("Este navegador no permite obtener la ubicación actual.");
      return;
    }
    setLocationBusy(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = applyCurrentLocation(currentDraft(), position.coords.latitude, position.coords.longitude);
        applyDraft(next);
        setLocationBusy(false);
        setMessage("Ubicación actual seleccionada. Pulsa Guardar geozona para persistirla.");
      },
      () => {
        setLocationBusy(false);
        setMessage("No pudimos obtener tu ubicación actual. Puedes buscar un lugar o mover el pin.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  }

  function changeRadius(value: number | string) {
    const next = setGeofenceRadius(currentDraft(), value);
    onRadiusChange(String(next.radius));
  }

  const mapLatitude = numberOrNull(latitude);
  const mapLongitude = numberOrNull(longitude);
  const mapRadius = normalizeGeofenceRadius(radius);

  return (
    <section className="mt-5 border-t border-outline-variant pt-5" aria-label="Ubicación de la geozona">
      <h3 className="font-bold">Ubicación de la geozona</h3>
      <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}>
        <input
          aria-label="Buscar dirección o lugar"
          className="h-10 min-w-0 flex-1 rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface outline-none focus:border-primary"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar dirección o lugar..."
        />
        <button type="submit" disabled={searchBusy} className="h-10 rounded-lg border border-outline-variant px-3 text-sm font-bold disabled:opacity-60">
          {searchBusy ? "Buscando..." : "Buscar"}
        </button>
      </form>
      <p className="mt-1 text-xs text-on-surface-variant">Ejemplos: Nicolás Bravo 7, Tlaltenango; Tequilitros Huejúcar; Colotlán, Jalisco.</p>

      {results.length > 0 && (
        <div className="mt-3 space-y-2" role="listbox" aria-label="Resultados de búsqueda">
          {results.map((result) => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              key={result.placeId}
              onClick={() => chooseResult(result)}
              className="block w-full rounded-lg border border-outline-variant bg-background p-3 text-left text-sm hover:border-primary"
            >
              {result.displayName}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3">
        <LocationPicker latitude={mapLatitude} longitude={mapLongitude} radius={mapRadius} onChange={updatePin} />
      </div>
      <button type="button" onClick={useCurrentLocation} disabled={locationBusy} className="mt-3 min-h-10 rounded-lg border border-outline-variant px-3 text-sm font-bold disabled:opacity-60">
        {locationBusy ? "Obteniendo ubicación..." : "Usar mi ubicación actual"}
      </button>
      {message && <p className="mt-2 text-xs text-on-surface-variant" role="status">{message}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Radio permitido:</span>
        <button type="button" aria-label="Disminuir radio" onClick={() => changeRadius(mapRadius - 50)} className="h-10 w-10 rounded-lg border border-outline-variant text-lg">-</button>
        <input aria-label="Radio permitido (metros)" className="h-10 w-24 rounded-lg border border-outline-variant bg-background px-2 text-center text-sm" type="number" min="10" max="10000" value={radius} onChange={(event) => onRadiusChange(event.target.value)} />
        <button type="button" aria-label="Aumentar radio" onClick={() => changeRadius(mapRadius + 50)} className="h-10 w-10 rounded-lg border border-outline-variant text-lg">+</button>
        {[50, 100, 150, 200, 300].map((value) => (
          <button type="button" key={value} onClick={() => changeRadius(value)} className="h-10 rounded-lg border border-outline-variant px-2 text-xs">{value} m</button>
        ))}
      </div>
      <p className="mt-2 text-xs text-on-surface-variant">El círculo del mapa usa el radio actual. La etiqueta es sólo descriptiva; el centro geográfico son las coordenadas.</p>
      <button type="button" onClick={onSave} disabled={saveBusy} className="mt-4 h-10 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary disabled:opacity-60">
        {saveBusy ? "Guardando..." : "Guardar geozona"}
      </button>
    </section>
  );
}
