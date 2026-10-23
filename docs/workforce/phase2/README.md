# PHASE 2 — GEOLOCATION

Geofence enforcement, GPS accuracy, kiosk geolocation, geographic attendance exceptions, tracking and maps are deferred. The scheduling release disables enforcement in server code and forbids enabling a branch geofence. Stored geometry is retained.

The previous hardening checkpoint is historical, not the release plan. Its two RLS migrations and runtime integration script were already applied/tested in DEV only and are excluded from production. Full original working changes, SQL and scripts are preserved at `/Users/joseadansanchez/maestro-checkpoints/pre-monday-20260906-095141/` (archive and patch). Existing production RLS is not changed by this scheduling release.
