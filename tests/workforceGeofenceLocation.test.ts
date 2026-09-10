import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCurrentLocation,
  initialGeofenceLocation,
  moveGeofencePin,
  normalizeGeofenceRadius,
  selectGeocoderResult,
  setGeofenceRadius,
} from "../lib/workforce/geofenceLocation";

const persisted = initialGeofenceLocation({
  label: "Sucursal guardada",
  latitude: 20.6736,
  longitude: -103.344,
  radius: 100,
});

test("seleccionar resultado de búsqueda actualiza etiqueta y coordenadas", () => {
  const next = selectGeocoderResult(persisted, {
    displayName: "Colotlán, Jalisco, México",
    latitude: 22.111,
    longitude: -103.266,
  });
  assert.equal(next.label, "Colotlán, Jalisco, México");
  assert.equal(next.latitude, 22.111);
  assert.equal(next.longitude, -103.266);
});

test("click en mapa actualiza el centro", () => {
  const next = moveGeofencePin(persisted, 22.112, -103.267);
  assert.deepEqual([next.latitude, next.longitude], [22.112, -103.267]);
});

test("arrastrar pin usa la misma transformación de coordenadas", () => {
  const next = moveGeofencePin(persisted, 22.113, -103.268);
  assert.deepEqual([next.latitude, next.longitude], [22.113, -103.268]);
});

test("usar ubicación actual actualiza coordenadas sin cambiar etiqueta", () => {
  const next = applyCurrentLocation(persisted, 21.123, -102.972);
  assert.equal(next.label, persisted.label);
  assert.deepEqual([next.latitude, next.longitude], [21.123, -102.972]);
});

test("cambiar radio actualiza inmediatamente el valor del círculo", () => {
  const next = setGeofenceRadius(persisted, 200);
  assert.equal(next.radius, 200);
  assert.equal(normalizeGeofenceRadius(next.radius), 200);
});

test("geozona existente carga centro, etiqueta y radio guardados", () => {
  assert.deepEqual(persisted, {
    label: "Sucursal guardada",
    latitude: 20.6736,
    longitude: -103.344,
    radius: 100,
  });
});

test("cancelar conserva el borrador persistido porque las ediciones son locales", () => {
  const edited = selectGeocoderResult(persisted, {
    displayName: "Lugar temporal",
    latitude: 19,
    longitude: -99,
  });
  assert.notDeepEqual(edited, persisted);
  assert.deepEqual(persisted, initialGeofenceLocation({
    label: "Sucursal guardada",
    latitude: 20.6736,
    longitude: -103.344,
    radius: 100,
  }));
});

test("radio inválido vuelve al valor seguro predeterminado", () => {
  assert.equal(normalizeGeofenceRadius("no-numérico"), 100);
  assert.equal(normalizeGeofenceRadius(0), 10);
  assert.equal(normalizeGeofenceRadius(20000), 10000);
});
