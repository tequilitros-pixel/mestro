import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";

const LOT_PREFIX = "PV";
const LOT_TIME_ZONE = "America/Mexico_City";
const MAX_CREATION_ATTEMPTS = 5;

export default async function NewLotPage() {
  const nextLotCodePreview = await getNextLotCodePreview();

  async function createLot(formData: FormData) {
    "use server";

    const user = await getCurrentUser();

    if (!user) {
      redirect("/login");
    }

    const agaveKg = parseRequiredNumber(
      formData.get("agaveKg")
    );

    const art = parseOptionalNumber(
      formData.get("art")
    );

    const observationsValue =
      formData.get("observations");

    const observations =
      typeof observationsValue === "string" &&
      observationsValue.trim()
        ? observationsValue.trim()
        : null;

    if (agaveKg === null || agaveKg <= 0) {
      redirect("/lots/new");
    }

    if (art !== null && art < 0) {
      redirect("/lots/new");
    }

    await createLotWithPermanentSequence({
      ownerId: user.id,
      agaveKg,
      art,
      observations,
    });

    redirect("/lots");
  }

  return (
    <main className="min-h-screen bg-background p-4 text-on-surface sm:p-6 lg:p-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm uppercase tracking-[0.4em] text-on-surface-variant">
          MAESTRO
        </p>

        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
          Nuevo lote
        </h1>

        <p className="mt-3 text-on-surface-variant">
          MAESTRO asignará automáticamente la fecha y el
          siguiente número consecutivo.
        </p>

        <section className="mt-8 rounded-2xl border border-primary/25 bg-primary/[0.06] p-5">
          <p className="text-sm text-on-surface-variant">
            Código estimado del nuevo lote
          </p>

          <p className="mt-2 font-mono text-2xl font-bold text-primary sm:text-3xl">
            {nextLotCodePreview}
          </p>

          <p className="mt-3 text-sm text-on-surface-variant">
            La fecha es una referencia. El número final es
            consecutivo y nunca se reinicia.
          </p>
        </section>

        <form
          action={createLot}
          className="mt-6 space-y-6 rounded-2xl border border-outline-variant bg-surface-container p-5 sm:p-8"
        >
          <div>
            <label
              htmlFor="agaveKg"
              className="mb-2 block text-sm font-semibold text-on-surface-variant"
            >
              Kg de agave
            </label>

            <input
              id="agaveKg"
              name="agaveKg"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              placeholder="Ej. 3500"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="art"
              className="mb-2 block text-sm font-semibold text-on-surface-variant"
            >
              ART
            </label>

            <input
              id="art"
              name="art"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="Opcional"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
            />
          </div>

          <div>
            <label
              htmlFor="observations"
              className="mb-2 block text-sm font-semibold text-on-surface-variant"
            >
              Observaciones
            </label>

            <textarea
              id="observations"
              name="observations"
              rows={4}
              placeholder="Procedencia, calidad, condición del agave u otra información importante."
              className="w-full resize-none rounded-xl border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-on-primary transition duration-150 ease-out hover:scale-[1.04] hover:opacity-90 active:scale-[0.97]"
          >
            Crear lote automáticamente
          </button>
        </form>
      </div>
    </main>
  );
}

async function createLotWithPermanentSequence({
  ownerId,
  agaveKg,
  art,
  observations,
}: {
  ownerId: string;
  agaveKg: number;
  art: number | null;
  observations: string | null;
}) {
  for (
    let attempt = 1;
    attempt <= MAX_CREATION_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const nextSequence =
            await getNextPermanentSequence(transaction);

          const startedAt = new Date();

          const code = buildLotCode({
            date: startedAt,
            sequence: nextSequence,
          });

          return transaction.lot.create({
            data: {
              code,
              stage: "RECEPCION",
              agaveKg,
              art,
              startedAt,
              observations,
              ownerId,
            },
          });
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        }
      );
    } catch (error) {
      const shouldRetry =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" ||
          error.code === "P2034");

      if (
        shouldRetry &&
        attempt < MAX_CREATION_ATTEMPTS
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    "No fue posible asignar el número consecutivo del lote."
  );
}

async function getNextLotCodePreview() {
  const nextSequence =
    await getNextPermanentSequence(prisma);

  return buildLotCode({
    date: new Date(),
    sequence: nextSequence,
  });
}

async function getNextPermanentSequence(
  database:
    | typeof prisma
    | Prisma.TransactionClient
) {
  const existingLots = await database.lot.findMany({
    where: {
      code: {
        startsWith: `${LOT_PREFIX}-`,
      },
    },
    select: {
      code: true,
    },
  });

  const highestSequence = existingLots.reduce(
    (highest, lot) => {
      const sequence = extractSequence(lot.code);

      return sequence !== null &&
        sequence > highest
        ? sequence
        : highest;
    },
    0
  );

  return highestSequence + 1;
}

function extractSequence(code: string) {
  const pattern = new RegExp(
    `^${LOT_PREFIX}-\\d{2}-\\d{2}-\\d{4}-(\\d+)$`
  );

  const match = code.match(pattern);

  if (!match) {
    return null;
  }

  const sequence = Number(match[1]);

  return Number.isInteger(sequence)
    ? sequence
    : null;
}

function buildLotCode({
  date,
  sequence,
}: {
  date: Date;
  sequence: number;
}) {
  const formattedDate = formatLotDate(date);

  const formattedSequence = String(sequence).padStart(
    3,
    "0"
  );

  return `${LOT_PREFIX}-${formattedDate}-${formattedSequence}`;
}

function formatLotDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LOT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);

  const day =
    parts.find((part) => part.type === "day")
      ?.value ?? "00";

  const month =
    parts.find((part) => part.type === "month")
      ?.value ?? "00";

  const year =
    parts.find((part) => part.type === "year")
      ?.value ?? "0000";

  return `${day}-${month}-${year}`;
}

function parseRequiredNumber(
  value: FormDataEntryValue | null
) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function parseOptionalNumber(
  value: FormDataEntryValue | null
) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}