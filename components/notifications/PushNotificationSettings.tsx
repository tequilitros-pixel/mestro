"use client";

import { useEffect, useState, useTransition } from "react";
import {
  isSoundEnabled,
  setSoundEnabled,
  triggerAlertFeedback,
  playNotificationSound,
} from "@/lib/feedback";
import { sendTestNotificationAction } from "@/app/actions/notifications";
import { BellIcon } from "@/components/ui/icons";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationSettings() {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [soundActive, setSoundActive] = useState<boolean>(true);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      setSoundActive(isSoundEnabled());
      const hasSupport = "serviceWorker" in navigator && "Notification" in window && "PushManager" in window;
      setIsSupported(hasSupport);
      if (hasSupport) {
        setPermission(Notification.permission);
        navigator.serviceWorker.ready
          .then((registration) => registration.pushManager.getSubscription())
          .then((subscription) => setIsSubscribed(Boolean(subscription)))
          .catch(() => {});
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleToggleSound = () => {
    const next = !soundActive;
    setSoundActive(next);
    setSoundEnabled(next);
    if (next) {
      playNotificationSound("tap");
    }
  };

  const handleSubscribe = async () => {
    setMessage(null);
    if (!isSupported) {
      setMessage({ text: "Tu navegador o dispositivo no soporta notificaciones Push.", type: "error" });
      return;
    }

    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setMessage({ text: "Error de configuración: falta la clave pública VAPID.", type: "error" });
        return;
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setMessage({
          text: perm === "denied"
            ? "Permiso denegado. Debes habilitar las notificaciones en la configuración de tu navegador."
            : "No se concedió el permiso para notificaciones.",
          type: "error",
        });
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        const applicationServerKey = urlBase64ToUint8Array(vapidKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      if (!res.ok) {
        throw new Error("No se pudo registrar la suscripción en el servidor.");
      }

      setIsSubscribed(true);
      triggerAlertFeedback("success");
      setMessage({ text: "¡Notificaciones push activadas exitosamente en este dispositivo!", type: "success" });
    } catch (err) {
      console.error("[handleSubscribe] Error:", err);
      setMessage({ text: err instanceof Error ? err.message : "Ocurrió un error al activar notificaciones.", type: "error" });
    }
  };

  const handleUnsubscribe = async () => {
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});

        await sub.unsubscribe();
      }

      setIsSubscribed(false);
      setMessage({ text: "Notificaciones push desactivadas en este dispositivo.", type: "info" });
    } catch (err) {
      console.error("[handleUnsubscribe] Error:", err);
      setMessage({ text: "Error al desactivar notificaciones.", type: "error" });
    }
  };

  const handleSendTest = () => {
    setMessage(null);
    startTransition(async () => {
      triggerAlertFeedback("success");
      const result = await sendTestNotificationAction();
      if (result.success) {
        setMessage({
          text: `Aviso de prueba enviado. Revisa la campanita del encabezado${result.data.pushedCount > 0 ? " y la notificación de tu sistema" : ""}.`,
          type: "success",
        });
      } else {
        setMessage({ text: result.error, type: "error" });
      }
    });
  };

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BellIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-primary">Notificaciones y Alertas</h2>
            <p className="text-xs text-on-surface-variant">
              Avisos en tiempo real sobre turnos, nómina, inventario y caja.
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-xs font-medium leading-relaxed ${
            message.type === "success"
              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
              : message.type === "error"
              ? "bg-error/15 text-error border border-error/30"
              : "bg-surface-dim text-on-surface-variant border border-outline-variant"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Estado del navegador / PWA */}
      <div className="rounded-xl border border-outline-variant bg-surface-dim/70 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-on-surface">Notificaciones Push (Segundo plano)</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              isSubscribed
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isSubscribed ? "bg-emerald-500" : "bg-zinc-400"}`} />
            {isSubscribed ? "Activado en este equipo" : "Desactivado"}
          </span>
        </div>

        {!isSupported ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            ⚠️ Para recibir notificaciones en segundo plano en iOS, agrega esta aplicación a la pantalla de inicio desde Compartir &rarr; &ldquo;Agregar al inicio&rdquo;.
          </p>
        ) : permission === "denied" ? (
          <p className="text-[11px] text-error">
            🚫 Los permisos de notificación están bloqueados en este navegador. Habilítalos desde los ajustes de tu navegador o dispositivo.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            {isSubscribed ? (
              <button
                type="button"
                onClick={handleUnsubscribe}
                className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container active:scale-[0.98] transition"
              >
                Desactivar en este dispositivo
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubscribe}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:opacity-90 active:scale-[0.98] transition shadow-xs"
              >
                Activar notificaciones push
              </button>
            )}

            <button
              type="button"
              disabled={isPending}
              onClick={handleSendTest}
              className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 active:scale-[0.98] transition disabled:opacity-50"
            >
              {isPending ? "Enviando..." : "Enviar notificación de prueba"}
            </button>
          </div>
        )}
      </div>

      {/* Preferencia de Sonido Local y Háptico */}
      <div className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-dim/70 p-4">
        <div>
          <p className="text-xs font-medium text-on-surface">Sonido y vibración local</p>
          <p className="text-[11px] text-on-surface-variant">
            Emitir un tono armonioso y vibración al cobrar en POSpress o recibir alertas urgentes.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleSound}
          role="switch"
          aria-checked={soundActive}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            soundActive ? "bg-primary" : "bg-zinc-600"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              soundActive ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </section>
  );
}
