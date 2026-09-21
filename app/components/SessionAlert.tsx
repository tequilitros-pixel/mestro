"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AlertCircleIcon, CheckCircleIcon, InfoIcon, XIcon } from "@/components/ui/icons";

interface Alert {
  type: "error" | "success" | "info" | "warning";
  message: string;
  title?: string;
}

export default function SessionAlert() {
  const searchParams = useSearchParams();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const alertKey = searchParams.toString();
  const errorParam = searchParams.get("error");
  const resetParam = searchParams.get("reset");
  const expiredParam = searchParams.get("expired");
  let alert: Alert | null = null;

  if (expiredParam === "1") {
      alert = {
        type: "warning",
        title: "Sesión Expirada",
        message:
          "Tu sesión anterior ya no era válida. Por favor ingresa de nuevo.",
      };
    } else if (resetParam === "1") {
      alert = {
        type: "success",
        title: "Contraseña Actualizada",
        message:
          "Tu contraseña ha sido cambiada exitosamente. Ahora puedes iniciar sesión.",
      };
    } else if (errorParam === "locked") {
      alert = {
        type: "error",
        title: "Cuenta Bloqueada Temporalmente",
        message:
          "Demasiados intentos fallidos. Por seguridad, intenta de nuevo en 15 minutos.",
      };
    } else if (errorParam === "1") {
      alert = {
        type: "error",
        title: "Credenciales Incorrectas",
        message:
          "El usuario, correo, teléfono o contraseña que ingresaste no son correctos.",
      };
    }

  if (!alert || dismissedKey === alertKey) return null;

  const bgColor = {
    error: "bg-error/10 border-error/20",
    success: "bg-tertiary-fixed-dim/10 border-tertiary-fixed-dim/20",
    info: "bg-primary/10 border-primary/20",
    warning: "bg-secondary/10 border-secondary/20",
  }[alert.type];

  const textColor = {
    error: "text-error",
    success: "text-tertiary-fixed-dim",
    info: "text-primary",
    warning: "text-secondary",
  }[alert.type];

  const Icon = {
    error: AlertCircleIcon,
    success: CheckCircleIcon,
    info: InfoIcon,
    warning: AlertCircleIcon,
  }[alert.type];

  return (
    <div className={`rounded-lg border ${bgColor} p-4 mb-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${textColor}`} />

        <div className="flex-1">
          {alert.title && (
            <p className={`font-semibold ${textColor} mb-1`}>
              {alert.title}
            </p>
          )}
          <p className={`text-sm ${textColor} opacity-90`}>
            {alert.message}
          </p>
        </div>

        <button
          onClick={() => setDismissedKey(alertKey)}
          className={`shrink-0 ${textColor} hover:opacity-70 transition`}
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
