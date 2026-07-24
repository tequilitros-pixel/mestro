import BottleQrCode from "@/components/liquors/BottleQrCode";

export type BottleLabelData = {
  productName: string;
  productIcon?: string | null;
  bottleSizeMl: number;
  bottleCode: string;
  batchCode: string;
  serialNumber: number;
  totalBottles: number;
  alcohol?: number | null;
  qrToken: string;
  authenticityCode?: string | null;
  manufacturedAt?: Date | null;
  expirationDate?: Date | null;
};

type BottleLabelProps = {
  bottle: BottleLabelData;
  className?: string;
  showBorder?: boolean;
};

export default function BottleLabel({
  bottle,
  className = "",
  showBorder = true,
}: BottleLabelProps) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const qrUrl = `${baseUrl}/q/${encodeURIComponent(
  bottle.qrToken
)}`;

  return (
    <article
      className={`label-card break-inside-avoid bg-white text-black ${
        showBorder ? "border border-black" : ""
      } ${className}`}
      style={{
        width: "100%",
        minHeight: "120mm",
        padding: "8mm",
        boxSizing: "border-box",
      }}
    >
      <header className="text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.22em]">
          Casa Destiladora del Norte
        </p>

        <h2 className="mt-3 text-2xl font-black leading-tight">
          {bottle.productIcon ? `${bottle.productIcon} ` : ""}
          {bottle.productName}
        </h2>

        <p className="mt-2 text-sm font-bold">
          {formatBottleSize(bottle.bottleSizeMl)}
        </p>

        {bottle.alcohol !== null &&
          bottle.alcohol !== undefined && (
            <p className="mt-1 text-sm font-black">
              {formatNumber(bottle.alcohol)}% Alc. Vol.
            </p>
          )}
      </header>

      <section className="mt-5 border-y border-black py-4">
        <LabelRow
          label="Lote"
          value={bottle.batchCode}
          mono
        />

        <LabelRow
          label="Botella"
          value={`${bottle.serialNumber} de ${bottle.totalBottles}`}
        />

        <LabelRow
          label="Código"
          value={bottle.bottleCode}
          mono
        />

        <LabelRow
          label="Elaboración"
          value={
            bottle.manufacturedAt
              ? formatDate(bottle.manufacturedAt)
              : "Sin fecha"
          }
        />

        <LabelRow
          label="Caducidad"
          value={
            bottle.expirationDate
              ? formatDate(bottle.expirationDate)
              : "Sin fecha"
          }
        />
      </section>

      <section className="mt-5 flex items-center justify-between gap-5">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-wider">
            Código de autenticidad
          </p>

          <p
            className="mt-2 break-all font-mono text-xs font-black"
            title={
              bottle.authenticityCode ??
              bottle.bottleCode
            }
          >
            {bottle.authenticityCode ??
              bottle.bottleCode}
          </p>

          <p className="mt-4 text-[9px] font-semibold leading-4">
            Escanea el código QR para consultar la identidad de esta
            botella.
          </p>
        </div>

        <div className="shrink-0">
          <BottleQrCode value={qrUrl} size={88} />
        </div>
      </section>

      <footer className="mt-6 border-t border-black pt-3 text-center">
        <p className="text-[8px] font-black uppercase tracking-[0.14em]">
          Producto identificado individualmente por MAESTRO
        </p>
      </footer>
    </article>
  );
}

function LabelRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="mt-2 flex items-start justify-between gap-4 first:mt-0">
      <span className="shrink-0 text-[10px] font-black uppercase">
        {label}
      </span>

      <span
        className={`min-w-0 break-all text-right text-xs font-black ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function formatBottleSize(sizeMl: number) {
  if (sizeMl >= 1000) {
    const liters = sizeMl / 1000;

    return `${formatNumber(liters, 2)} ${
      liters === 1 ? "litro" : "litros"
    }`;
  }

  return `${formatNumber(sizeMl, 0)} ml`;
}

function formatNumber(
  value: number,
  maximumFractionDigits = 2
) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits,
  }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City",
  }).format(date);
}