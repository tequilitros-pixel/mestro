"use client";

import { useEffect, useRef, useState } from "react";
import { savePayrollSignatureAction } from "@/app/actions/payrollSignature";

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSigned: (signatureData: string, signedAt: string) => void;
  weekStart: string;
  weekLabel: string;
  totalPay: number;
}

export default function SignaturePadModal({
  isOpen,
  onClose,
  onSigned,
  weekStart,
  weekLabel,
  totalPay,
}: SignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inicializar canvas y tamaño exacto
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      // Usar devicePixelRatio para trazos nítidos en pantallas Retina / móviles
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#0f172a"; // Tinta oscura
      }
      setHasDrawn(false);
      setError(null);
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  function getCanvasCoords(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoords(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
    setError(null);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoords(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignorar si el pointer ya no está capturado
    }
    setIsDrawing(false);
  }

  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setError(null);
  }

  async function handleConfirm() {
    if (!hasDrawn) {
      setError("Por favor traza tu firma con el dedo dentro del recuadro.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convertir canvas a PNG base64
    const signatureData = canvas.toDataURL("image/png");

    setSaving(true);
    setError(null);

    const result = await savePayrollSignatureAction({
      weekStart,
      signatureData,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.success && result.signedAt) {
      onSigned(signatureData, result.signedAt);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-outline-variant bg-surface shadow-2xl">
        {/* Encabezado */}
        <div className="border-b border-outline-variant bg-primary/[0.06] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-base font-bold text-on-primary">
                ✍️
              </span>
              <div>
                <h3 className="text-base font-bold text-on-surface">Firma de Conformidad</h3>
                <p className="text-xs text-on-surface-variant">Recibo de Nómina Semanal</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between rounded-xl bg-surface p-2.5 text-xs text-on-surface-variant">
            <span>
              Semana: <strong>{weekLabel}</strong>
            </span>
            <span>
              Monto neto: <strong className="text-primary font-mono text-sm">${totalPay.toFixed(2)}</strong>
            </span>
          </div>
        </div>

        {/* Cuerpo / Canvas */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-on-surface-variant">
            Firma con tu dedo (o lápiz táctil) dentro del siguiente recuadro blanco:
          </p>

          <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-primary/30 bg-white shadow-inner">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="h-44 w-full cursor-crosshair touch-none select-none bg-white"
            />

            {!hasDrawn && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                <span className="text-3xl opacity-30">✍️</span>
                <span className="mt-1 text-xs font-semibold">Traza tu firma aquí</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleClear}
              className="absolute bottom-2 right-2 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 shadow-sm transition hover:bg-slate-200"
            >
              Borrar trazo
            </button>
          </div>

          {/* Cláusula legal corta de conformidad */}
          <p className="rounded-xl bg-surface-container p-2.5 text-[10px] leading-relaxed text-on-surface-variant">
            <strong>Declaración:</strong> Manifiesto haber recibido a mi entera conformidad las percepciones desglosadas por concepto de salario ordinario devengado, así como las partes proporcionales de aguinaldo, vacaciones y prima vacacional conforme a mi contrato y la Ley Federal del Trabajo.
          </p>

          {error && (
            <p className="rounded-xl border border-error/30 bg-error/10 p-2.5 text-xs font-semibold text-error">
              {error}
            </p>
          )}

          {/* Botones de acción */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-outline-variant py-3 text-sm font-semibold text-on-surface transition hover:bg-surface-container"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || !hasDrawn}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary shadow transition hover:opacity-95 disabled:opacity-50"
            >
              {saving ? "Guardando firma..." : "Confirmar y firmar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
