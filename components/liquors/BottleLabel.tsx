import BottleQRCode from "@/components/liquors/BottleQRCode";

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
  qrUrl: string;
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
  const authenticityCode = createAuthenticityCode(
    bottle.qrToken,
    bottle.serialNumber
  );

  const serialNumber = formatSerialNumber(
    bottle.serialNumber,
    bottle.totalBottles
  );

  const totalBottles = formatSerialNumber(
    bottle.totalBottles,
    bottle.totalBottles
  );

  return (
    <article
      className={[
        "bottle-label relative box-border overflow-hidden bg-white text-black",
        showBorder ? "border border-black" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width: "50mm",
        height: "30mm",
        minWidth: "50mm",
        minHeight: "30mm",
        maxWidth: "50mm",
        maxHeight: "30mm",
        fontFamily: "Arial, Helvetica, sans-serif",
        breakInside: "avoid",
        pageBreakInside: "avoid",
      }}
    >
      <div
        className="grid h-full w-full grid-cols-[1fr_auto]"
        style={{
          padding: "1.4mm",
          columnGap: "1.2mm",
        }}
      >
        <section className="flex min-w-0 flex-col">
          <header>
            <p
              className="truncate font-black uppercase"
              style={{
                fontSize: "4.8pt",
                lineHeight: 1.05,
                letterSpacing: "0.04em",
              }}
            >
              Casa Destiladora del Norte
            </p>

            <div
              className="mt-[0.7mm] h-px w-full bg-black"
              aria-hidden="true"
            />
          </header>

          <div className="mt-[1mm] min-w-0">
            <p
              className="line-clamp-2 font-black"
              style={{
                fontSize: "7.4pt",
                lineHeight: 1.05,
              }}
            >
              {bottle.productIcon ? (
                <span className="mr-[0.7mm]">
                  {bottle.productIcon}
                </span>
              ) : null}

              {bottle.productName}
            </p>

            <p
              className="mt-[0.8mm] font-bold"
              style={{
                fontSize: "5.5pt",
                lineHeight: 1,
              }}
            >
              {formatBottleSize(bottle.bottleSizeMl)}

              {bottle.alcohol !== null &&
              bottle.alcohol !== undefined ? (
                <>
                  <span className="mx-[0.8mm]">·</span>
                  {formatNumber(bottle.alcohol, 2)}% Alc. Vol.
                </>
              ) : null}
            </p>
          </div>

          <dl
            className="mt-[1.3mm] grid gap-[0.7mm]"
            style={{
              fontSize: "5.1pt",
              lineHeight: 1.05,
            }}
          >
            <div className="min-w-0">
              <dt className="font-bold uppercase">Lote</dt>

              <dd className="truncate font-black">
                {bottle.batchCode}
              </dd>
            </div>

            <div>
              <dt className="font-bold uppercase">Botella</dt>

              <dd className="font-black">
                {serialNumber} / {totalBottles}
              </dd>
            </div>
          </dl>

          <footer className="mt-auto min-w-0 pt-[0.8mm]">
            <div className="flex items-center gap-[0.7mm]">
              <span
                className="flex shrink-0 items-center justify-center rounded-full bg-black text-white"
                style={{
                  width: "3mm",
                  height: "3mm",
                  fontSize: "5pt",
                  lineHeight: 1,
                }}
              >
                ✓
              </span>

              <p
                className="truncate font-black uppercase"
                style={{
                  fontSize: "4.5pt",
                  lineHeight: 1,
                }}
              >
                Producto original
              </p>
            </div>

            <p
              className="mt-[0.7mm] truncate font-mono font-bold"
              style={{
                fontSize: "4.2pt",
                lineHeight: 1,
              }}
              title={bottle.bottleCode}
            >
              {bottle.bottleCode}
            </p>
          </footer>
        </section>

        <section
          className="flex shrink-0 flex-col items-center justify-center"
          style={{
            width: "20mm",
          }}
        >
          <div
            className="flex items-center justify-center bg-white"
            style={{
              width: "19mm",
              height: "19mm",
            }}
          >
            <BottleQRCode
              value={bottle.qrUrl}
              size={72}
            />
          </div>

          <p
            className="mt-[0.8mm] text-center font-black uppercase"
            style={{
              fontSize: "4.3pt",
              lineHeight: 1.05,
            }}
          >
            Escanee para verificar
          </p>

          <p
            className="mt-[0.6mm] max-w-full truncate text-center font-mono font-bold"
            style={{
              fontSize: "3.8pt",
              lineHeight: 1,
            }}
            title={authenticityCode}
          >
            {authenticityCode}
          </p>
        </section>
      </div>
    </article>
  );
}

function createAuthenticityCode(
  qrToken: string,
  serialNumber: number
) {
  const tokenPart = qrToken
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-8)
    .toUpperCase();

  const serialPart = serialNumber
    .toString()
    .padStart(6, "0");

  return `CDN-${serialPart}-${tokenPart}`;
}

function formatSerialNumber(
  value: number,
  totalBottles: number
) {
  const digits = Math.max(
    3,
    totalBottles.toString().length
  );

  return value.toString().padStart(digits, "0");
}

function formatBottleSize(sizeMl: number) {
  if (sizeMl >= 1000) {
    const liters = sizeMl / 1000;

    return `${formatNumber(liters, 2)} ${
      liters === 1 ? "L" : "L"
    }`;
  }

  return `${formatNumber(sizeMl, 0)} ml`;
}

function formatNumber(
  value: number,
  maximumFractionDigits = 2
) {
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}