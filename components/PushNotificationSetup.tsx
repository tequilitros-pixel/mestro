"use client";

import { useEffect, useState } from "react";

type NotificationStatus =
  | "idle"
  | "loading"
  | "enabled"
  | "denied"
  | "unsupported"
  | "error";

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return buffer;
}

export default function PushNotificationSetup() {
  const [status, setStatus] =
    useState<NotificationStatus>("idle");

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function checkCurrentSubscription() {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setStatus("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }

      if (Notification.permission !== "granted") {
        setStatus("idle");
        return;
      }

      try {
        const registration =
          await navigator.serviceWorker.getRegistration();

        if (!registration) {
          setStatus("idle");
          return;
        }

        const subscription =
          await registration.pushManager.getSubscription();

        setStatus(subscription ? "enabled" : "idle");
      } catch (error) {
        console.error(
          "Error revisando la suscripción push:",
          error
        );

        setStatus("idle");
      }
    }

    void checkCurrentSubscription();
  }, []);

  async function enableNotifications() {
    setStatus("loading");
    setErrorMessage("");

    try {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setStatus("unsupported");
        return;
      }

      const publicKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        throw new Error(
          "No está configurada NEXT_PUBLIC_VAPID_PUBLIC_KEY."
        );
      }

      const permission =
        await Notification.requestPermission();

      if (permission === "denied") {
        setStatus("denied");
        return;
      }

      if (permission !== "granted") {
        setStatus("idle");
        return;
      }

      const registration =
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

      await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              urlBase64ToArrayBuffer(publicKey),
          });
      }

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        const responseText = await response.text();

        throw new Error(
          responseText ||
            `El servidor respondió ${response.status}.`
        );
      }

      setStatus("enabled");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Error desconocido.";

      console.error(
        "Error activando notificaciones:",
        error
      );

      setErrorMessage(message);
      setStatus("error");
    }
  }

  if (status === "enabled") {
    return (
      <p className="text-sm font-medium text-green-400">
        🔔 Notificaciones activadas
      </p>
    );
  }

  if (status === "unsupported") {
    return (
      <p className="text-sm text-red-400">
        Este navegador no admite notificaciones push.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <div className="space-y-1">
        <p className="text-sm text-red-400">
          Las notificaciones están bloqueadas.
        </p>

        <p className="text-xs text-slate-400">
          Permítelas desde la configuración del sitio y
          vuelve a cargar MAESTRO.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={enableNotifications}
        disabled={status === "loading"}
        className="rounded-xl border border-amber-400 px-3 py-2 text-sm font-semibold text-amber-400 transition hover:bg-amber-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading"
          ? "Activando..."
          : "🔔 Activar notificaciones"}
      </button>

      {status === "error" && (
        <p className="max-w-md text-xs text-red-400">
          No fue posible activar las notificaciones:{" "}
          {errorMessage}
        </p>
      )}
    </div>
  );
}