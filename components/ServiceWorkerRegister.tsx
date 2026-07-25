"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    async function cleanupOldServiceWorkers() {
      if ("serviceWorker" in navigator) {
        const registrations =
          await navigator.serviceWorker.getRegistrations();

        await Promise.all(
          registrations.map((registration) =>
            registration.unregister()
          )
        );
      }

      if ("caches" in window) {
        const cacheNames = await caches.keys();

        await Promise.all(
          cacheNames.map((cacheName) =>
            caches.delete(cacheName)
          )
        );
      }

      console.log(
        "Service Workers y cachés antiguos eliminados."
      );
    }

    cleanupOldServiceWorkers().catch((error) => {
      console.error(
        "No se pudo limpiar el Service Worker:",
        error
      );
    });
  }, []);

  return null;
}