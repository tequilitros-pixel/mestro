"use client";

import QRCode from "react-qr-code";

type BottleQRCodeProps = {
  value: string;
  size?: number;
};

export default function BottleQRCode({
  value,
  size = 78,
}: BottleQRCodeProps) {
  return (
    <div className="flex items-center justify-center rounded-md bg-white p-1">
      <QRCode
        value={value}
        size={size}
        level="H"
        bgColor="#FFFFFF"
        fgColor="#000000"
      />
    </div>
  );
}