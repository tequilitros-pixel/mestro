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
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6 lg:p-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm uppercase tracking-[0.4em] text-amber-400">
          MAESTRO
        </p>

        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
          Nuevo lote
        </h1>

        <p className="mt-3 text-slate-400">
          MAESTRO asignará automáticamente la fecha y el
          siguiente número consecutivo.
        </p>

        <section className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
          <p className="text-sm text-amber-200/70">
            Código estimado del nuevo lote
          </p>

          <p className="mt-2 font-mono text-2xl font-bold text-amber-300 sm:text-3xl">
            {nextLotCodePreview}
          </p>

          <p className="mt-3 text-sm text-slate-400">
            La fecha es una referencia. El número final es
            consecutivo y nunca se reinicia.
          </p>
        </section>

        <form
          action={createLot}
          className="mt-6 space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8"
        >
          <div>
            <label
              htmlFor="agaveKg"
              className="block text-sm font-medium text-slate-300"
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
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400"
            />
          </div>

          <div>
            <label
              htmlFor="art"
              className="block text-sm font-medium text-slate-300"
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
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400"
            />
          </div>

          <div>
            <label
              htmlFor="observations"
              className="block text-sm font-medium text-slate-300"
            >
              Observaciones
            </label>

            <textarea
              id="observations"
              name="observations"
              rows={4}
              placeholder="Procedencia, calidad, condición del agave u otra información importante."
              className="mt-2 w-full resize-none rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none transition placeholder:text-slate-500 focus:border-amber-400"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-300"
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