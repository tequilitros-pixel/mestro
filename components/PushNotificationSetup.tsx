"use client";

import { useEffect, useState } from "react";
import { BellIcon, BellOffIcon } from "@/components/ui/icons";

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

  if (status === "unsupported") {
    return null;
  }

  if (status === "enabled") {
    return (
      <div
        className="hidden items-center gap-2 rounded-full border border-tertiary-fixed-dim/20 bg-tertiary-fixed-dim/10 px-3 py-1.5 text-xs font-semibold text-tertiary-fixed-dim lg:inline-flex"
        title="Notificaciones activadas"
      >
        <BellIcon className="h-3.5 w-3.5 shrink-0" />
        Notificaciones activas
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-on-surface-variant"
        title="Las notificaciones están bloqueadas. Permítelas desde la configuración del sitio y vuelve a cargar MAESTRO."
      >
        <BellOffIcon className="h-4 w-4 shrink-0" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={enableNotifications}
      disabled={status === "loading"}
      title={
        status === "error"
          ? `No fue posible activar las notificaciones: ${errorMessage}`
          : "Activar notificaciones"
      }
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition duration-150 ease-out hover:scale-[1.04] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 ${
        status === "error"
          ? "border-error/40 text-error hover:bg-error/10"
          : "border-outline-variant text-on-surface-variant hover:border-outline hover:bg-surface-container-high hover:text-on-surface"
      }`}
    >
      <BellIcon className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">
        {status === "loading" ? "Activando..." : "Activar notificaciones"}
      </span>
    </button>
  );
}