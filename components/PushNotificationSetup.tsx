"use client";

import { useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationSetup() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "enabled" | "error"
  >("idle");

  async function enableNotifications() {
    setStatus("loading");

    try {
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus("error");
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      setStatus("enabled");
    } catch (err) {
      console.error("Error activando notificaciones:", err);
      setStatus("error");
    }
  }

  if (status === "enabled") {
    return (
      <p className="text-sm text-green-400">
        🔔 Notificaciones activadas
      </p>
    );
  }

  return (
    <button
      onClick={enableNotifications}
      disabled={status === "loading"}
      className="rounded-xl border border-amber-400 px-3 py-2 text-sm font-semibold text-amber-400 transition hover:bg-amber-400 hover:text-slate-950"
    >
      {status === "loading" ? "Activando..." : "🔔 Activar notificaciones"}
      {status === "error" && (
        <span className="ml-2 text-red-400">(permiso denegado)</span>
      )}
    </button>
  );
}
