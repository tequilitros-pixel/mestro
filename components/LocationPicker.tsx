"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mini mapa (OpenStreetMap vía Leaflet) para fijar visualmente la
 * ubicación de una geozona. No requiere API key: Leaflet se carga
 * desde un CDN en el navegador la primera vez que se usa este
 * componente. Haz clic en el mapa o arrastra el marcador para
 * ajustar la posición; el resultado se reporta con `onChange`.
 */

declare global {
  interface Window {
    L?: LeafletNamespace;
  }
}

// Tipado mínimo de lo que usamos de Leaflet; la librería completa
// no trae sus propios tipos aquí porque se carga por CDN, no por
// npm, así que evitamos depender de @types/leaflet.
type LatLng = { lat: number; lng: number };
type LeafletMarker = {
  on: (event: string, handler: (e: unknown) => void) => void;
  getLatLng: () => LatLng;
  setLatLng: (latlng: [number, number]) => void;
};
type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  getZoom: () => number;
  on: (event: string, handler: (e: { latlng: LatLng }) => void) => void;
  remove: () => void;
};
type LeafletNamespace = {
  map: (container: HTMLElement) => LeafletMap;
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  marker: (
    latlng: [number, number],
    options?: Record<string, unknown>,
  ) => LeafletMarker & { addTo: (map: LeafletMap) => LeafletMarker };
};

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

let leafletLoadingPromise: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.L) return Promise.resolve();
  if (leafletLoadingPromise) return leafletLoadingPromise;

  leafletLoadingPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar el mapa.")));
      if (window.L) resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar el mapa."));
    document.body.appendChild(script);
  });

  return leafletLoadingPromise;
}

const DEFAULT_CENTER: [number, number] = [21.1236, -102.9721]; // Zacatecas, como punto de partida genérico

export default function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const onChangeRef = useRef(onChange);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    let cancelled = false;

    loadLeaflet()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current || !window.L) return;

        const L = window.L;
        const start: [number, number] =
          latitude !== null && longitude !== null ? [latitude, longitude] : DEFAULT_CENTER;

        const map = L.map(containerRef.current).setView(start, latitude !== null ? 16 : 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker(start, { draggable: true }).addTo(map);

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          onChangeRef.current(pos.lat, pos.lng);
        });

        map.on("click", (e) => {
          marker.setLatLng([e.latlng.lat, e.latlng.lng]);
          onChangeRef.current(e.latlng.lat, e.latlng.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;
        setReady(true);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "No se pudo cargar el mapa.");
      });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si lat/lng cambian desde afuera (búsqueda de dirección, "usar mi
  // ubicación", o escribir el número a mano), mueve el pin también.
  useEffect(() => {
    if (!ready || !markerRef.current || !mapRef.current) return;
    if (latitude === null || longitude === null) return;

    const current = markerRef.current.getLatLng();
    if (Math.abs(current.lat - latitude) > 1e-9 || Math.abs(current.lng - longitude) > 1e-9) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
    }
  }, [latitude, longitude, ready]);

  if (loadError) {
    return (
      <div className="rounded-lg border border-error/30 bg-error/5 p-3 text-xs text-error">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div
        ref={containerRef}
        className="h-56 w-full overflow-hidden rounded-lg border border-outline-variant"
      />
      <p className="text-xs text-on-surface-variant">
        Haz clic en el mapa o arrastra el marcador para ajustar la ubicación exacta.
      </p>
    </div>
  );
}
