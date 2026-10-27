"use client";

import React, { useState } from "react";
import {
  PrinterIcon,
  XIcon,
  CheckIcon,
  AlertIcon,
  SettingsIcon,
  RefreshIcon,
} from "@/components/ui/icons";
import {
  type PrinterSettings,
  type PrinterConnectionType,
  type PaperWidth,
  isWebBluetoothSupported,
  isWebSerialSupported,
  printTestTicketUniversal,
  saveStoredPrinterSettings,
} from "@/lib/pos/thermalPrinter";

interface PrinterSettingsModalProps {
  settings: PrinterSettings;
  onSave: (newSettings: PrinterSettings) => void;
  onClose: () => void;
}

export default function PrinterSettingsModal({
  settings: initialSettings,
  onSave,
  onClose,
}: PrinterSettingsModalProps) {
  const [settings, setSettings] = useState<PrinterSettings>(initialSettings);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const bluetoothOk = isWebBluetoothSupported();
  const serialOk = isWebSerialSupported();

  function handleTypeChange(type: PrinterConnectionType) {
    const updated = { ...settings, type };
    setSettings(updated);
    setStatusMessage(null);
    setTestResult(null);
  }

  function handlePaperChange(paperWidth: PaperWidth) {
    const updated = {
      ...settings,
      paperWidth,
      autoCut: paperWidth === "80mm" ? true : settings.autoCut,
    };
    setSettings(updated);
  }

  async function handleTestPrint() {
    setIsTesting(true);
    setStatusMessage("Iniciando prueba de impresión…");
    setTestResult(null);

    try {
      const res = await printTestTicketUniversal(settings, (status) => {
        setStatusMessage(status);
      });

      if (res.success) {
        setTestResult("success");
        setStatusMessage(
          `¡Prueba exitosa en ${res.deviceName || "impresora"}!`
        );
        if (res.deviceName) {
          const updated = { ...settings, lastDeviceName: res.deviceName };
          setSettings(updated);
        }
      } else {
        setTestResult("error");
        setStatusMessage(res.error || "No se pudo completar la prueba.");
      }
    } catch (err) {
      setTestResult("error");
      setStatusMessage(err instanceof Error ? err.message : "Error al realizar la prueba.");
    } finally {
      setIsTesting(false);
    }
  }

  function handleSave() {
    saveStoredPrinterSettings(settings);
    onSave(settings);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-outline-variant bg-surface-container p-6 shadow-2xl sm:p-7 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <PrinterIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-on-surface">Configurar Impresora</h2>
              <p className="text-xs text-on-surface-variant font-medium">
                Impresión económica por Bluetooth, USB o Navegador
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high transition"
            aria-label="Cerrar configuración"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6 pr-1">
          {/* Method Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">
              1. Método de Conexión
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Bluetooth */}
              <button
                type="button"
                onClick={() => handleTypeChange("bluetooth")}
                className={`relative flex flex-col items-start p-3.5 rounded-2xl border text-left transition ${
                  settings.type === "bluetooth"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : "border-outline-variant bg-surface hover:bg-surface-container-high"
                }`}
              >
                <div className="text-xl mb-1.5">📱</div>
                <div className="font-bold text-sm text-on-surface">Bluetooth</div>
                <div className="text-[11px] text-on-surface-variant mt-0.5">
                  Inalámbrica portátil (58mm/80mm)
                </div>
                {!bluetoothOk && (
                  <span className="mt-2 inline-block rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
                    Requiere Chrome/Edge
                  </span>
                )}
                {bluetoothOk && (
                  <span className="mt-2 inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">
                    Listo en este navegador
                  </span>
                )}
              </button>

              {/* USB Cable */}
              <button
                type="button"
                onClick={() => handleTypeChange("usb")}
                className={`relative flex flex-col items-start p-3.5 rounded-2xl border text-left transition ${
                  settings.type === "usb"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : "border-outline-variant bg-surface hover:bg-surface-container-high"
                }`}
              >
                <div className="text-xl mb-1.5">🔌</div>
                <div className="font-bold text-sm text-on-surface">Cable USB</div>
                <div className="text-[11px] text-on-surface-variant mt-0.5">
                  Tipo-C / OTG directo a impresora
                </div>
                {!serialOk && (
                  <span className="mt-2 inline-block rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
                    Requiere Chrome/Edge
                  </span>
                )}
                {serialOk && (
                  <span className="mt-2 inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">
                    Listo en este navegador
                  </span>
                )}
              </button>

              {/* System / Dialog */}
              <button
                type="button"
                onClick={() => handleTypeChange("system")}
                className={`relative flex flex-col items-start p-3.5 rounded-2xl border text-left transition ${
                  settings.type === "system"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : "border-outline-variant bg-surface hover:bg-surface-container-high"
                }`}
              >
                <div className="text-xl mb-1.5">🖨️</div>
                <div className="font-bold text-sm text-on-surface">Sistema</div>
                <div className="text-[11px] text-on-surface-variant mt-0.5">
                  Diálogo estándar / AirPrint / PDF
                </div>
                <span className="mt-2 inline-block rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-600">
                  Universal (Cualquiera)
                </span>
              </button>
            </div>
          </div>

          {/* Paper Width */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">
              2. Ancho del Papel
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handlePaperChange("58mm")}
                className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition ${
                  settings.paperWidth === "58mm"
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-outline-variant bg-surface hover:bg-surface-container-high"
                }`}
              >
                <div>
                  <div className="font-bold text-sm text-on-surface">58 mm (Mini / Portátil)</div>
                  <div className="text-[11px] text-on-surface-variant">
                    Impresoras económicas de $400 - $600 MXN
                  </div>
                </div>
                {settings.paperWidth === "58mm" && (
                  <CheckIcon className="h-5 w-5 text-primary shrink-0 ml-2" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handlePaperChange("80mm")}
                className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition ${
                  settings.paperWidth === "80mm"
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-outline-variant bg-surface hover:bg-surface-container-high"
                }`}
              >
                <div>
                  <div className="font-bold text-sm text-on-surface">80 mm (Estándar Caja)</div>
                  <div className="text-[11px] text-on-surface-variant">
                    Impresoras de mostrador con corte
                  </div>
                </div>
                {settings.paperWidth === "80mm" && (
                  <CheckIcon className="h-5 w-5 text-primary shrink-0 ml-2" />
                )}
              </button>
            </div>
          </div>

          {/* Advanced options */}
          <div className="space-y-3 rounded-2xl bg-surface p-4 border border-outline-variant">
            <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block">
              Opciones de Avance y Corte
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-semibold text-on-surface block mb-1">
                  Líneas de avance al terminar:
                </span>
                <select
                  value={settings.feedLines}
                  onChange={(e) =>
                    setSettings({ ...settings, feedLines: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                >
                  <option value={2}>2 líneas (ajustado)</option>
                  <option value={3}>3 líneas (estándar recomendado)</option>
                  <option value={4}>4 líneas (fácil rasgado)</option>
                  <option value={5}>5 líneas (holgado)</option>
                </select>
              </div>

              {settings.paperWidth === "80mm" && (
                <div className="flex items-center justify-between pt-4 sm:pt-6">
                  <span className="font-semibold text-on-surface">
                    Autocorte automático de papel
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.autoCut}
                    onChange={(e) =>
                      setSettings({ ...settings, autoCut: e.target.checked })
                    }
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Instructions Guide */}
          <div className="rounded-2xl bg-surface-container-highest p-3.5 text-[11px] text-on-surface-variant space-y-1.5 leading-relaxed">
            <div className="font-bold text-on-surface flex items-center gap-1.5">
              <span>💡</span> Consejos rápidos:
            </div>
            {settings.type === "bluetooth" && (
              <p>
                1. Enciende tu mini impresora Bluetooth.
                <br />
                2. Activa el Bluetooth de tu tablet, teléfono o laptop.
                <br />
                3. Al pulsar <strong>Imprimir</strong> o <strong>Probar</strong>, el navegador abrirá la ventana para vincular tu impresora (ej. <em>MPT-II, POS-58, GOOJPRT</em>).
              </p>
            )}
            {settings.type === "usb" && (
              <p>
                1. Conecta el cable USB Tipo-C o el adaptador OTG de la impresora a tu equipo.
                <br />
                2. Al pulsar <strong>Imprimir</strong> o <strong>Probar</strong>, selecciona el dispositivo USB detectado en la lista del navegador.
              </p>
            )}
            {settings.type === "system" && (
              <p>
                Abre el cuadro de diálogo estándar de impresión de tu dispositivo. Ideal para Safari (iPad/iPhone), impresoras de red Wi-Fi o guardar como PDF.
              </p>
            )}
          </div>

          {/* Test Status feedback */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                testResult === "success"
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  : testResult === "error"
                  ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                  : "bg-primary/10 text-primary border border-primary/20"
              }`}
            >
              {isTesting && <RefreshIcon className="h-4 w-4 animate-spin shrink-0" />}
              {testResult === "success" && <CheckIcon className="h-4 w-4 shrink-0" />}
              {testResult === "error" && <AlertIcon className="h-4 w-4 shrink-0" />}
              <span className="flex-1">{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            disabled={isTesting}
            onClick={handleTestPrint}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-xs font-bold text-on-surface hover:bg-surface-container-high transition disabled:opacity-50"
          >
            <PrinterIcon className="h-4 w-4 text-primary" />
            {isTesting ? "Probando…" : "Imprimir Ticket de Prueba"}
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial rounded-xl px-4 py-2.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 sm:flex-initial rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-on-primary shadow hover:opacity-95 transition"
            >
              Guardar Preferencias
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
