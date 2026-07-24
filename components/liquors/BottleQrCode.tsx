"use client";

import { QRCodeSVG } from "qrcode.react";

type BottleQrCodeProps = {
  value: string;
  size?: number;
  className?: string;
};

export default function BottleQrCode({
  value,
  size = 96,
  className = "",
}: BottleQrCodeProps) {
  if (!value || value === "undefined") {
    return (
      <div
        className={`flex items-center justify-center border border-dashed border-slate-500 bg-white text-center text-[10px] font-bold text-slate-700 ${className}`}
        style={{
          width: size,
          height: size,
        }}
      >
        QR no disponible
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-white ${className}`}
    >
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        bgColor="#ffffff"
        fgColor="#000000"
        marginSize={2}
        title="Código QR de la botella"
      />
    </div>
  );
}