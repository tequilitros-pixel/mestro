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
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  const qrUrl = bottle.qrToken
    ? `${baseUrl}/q/${encodeURIComponent(bottle.qrToken)}`
    : "";

  return (
    <article
      className={`label-card break-inside-avoid overflow-hidden bg-white text-black ${
        showBorder ? "border-[0.35mm] border-black" : ""
      } ${className}`}
      style={{
        width: "50mm",
        height: "30mm",
        padding: "1.5mm",
        boxSizing: "border-box",
        borderRadius: showBorder ? "2mm" : undefined,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
      aria-label={`Etiqueta de control interno de la botella ${bottle.bottleCode}`}
    >
      <div className="flex h-full items-center gap-[1.5mm]">
        {/* Identidad */}
        <section className="flex h-full min-w-0 flex-1 flex-col items-center justify-center text-center">
          <div
            className="mb-[1mm] flex items-center justify-center"
            aria-hidden="true"
          >
            <DistilleryMark />
          </div>

          <p className="whitespace-nowrap text-[6.5pt] font-black uppercase leading-none tracking-[0.08em]">
            Control interno
          </p>

          <div className="my-[1.2mm] h-[0.3mm] w-full bg-black" />

          <h2 className="text-[9pt] font-black uppercase leading-[0.95]">
            Destiladora
            <br />
            del Norte
          </h2>

          <p className="mt-auto whitespace-nowrap text-[4.5pt] font-bold uppercase leading-none tracking-[0.02em]">
            Escanee para consultar
          </p>

          <p className="mt-[0.6mm] text-[5pt] font-black uppercase leading-none tracking-[0.12em]">
            Maestro
          </p>
        </section>

        {/* QR */}
        <section
          className="flex shrink-0 items-center justify-center"
          style={{
            width: "24mm",
            height: "24mm",
          }}
        >
          {qrUrl ? (
            <BottleQrCode value={qrUrl} size={220} />
          ) : (
            <div className="flex h-full w-full items-center justify-center border border-black text-center text-[6pt] font-black uppercase">
              QR no disponible
            </div>
          )}
        </section>
      </div>
    </article>
  );
}

function DistilleryMark() {
  return (
    <svg
      width="22"
      height="18"
      viewBox="0 0 22 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M11 17V6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      <path
        d="M11 12C8.8 10.6 7.2 8.5 6.5 6C8.8 6.5 10.3 8 11 10"
        fill="currentColor"
      />

      <path
        d="M11 12C13.2 10.6 14.8 8.5 15.5 6C13.2 6.5 11.7 8 11 10"
        fill="currentColor"
      />

      <path
        d="M11 9C9.8 6.8 9.4 4.2 11 1C12.6 4.2 12.2 6.8 11 9Z"
        fill="currentColor"
      />

      <path
        d="M8.5 11C6.1 10.4 4.2 8.9 3 6.7C5.5 6.5 7.5 7.6 8.5 9.5"
        fill="currentColor"
      />

      <path
        d="M13.5 11C15.9 10.4 17.8 8.9 19 6.7C16.5 6.5 14.5 7.6 13.5 9.5"
        fill="currentColor"
      />
    </svg>
  );
}