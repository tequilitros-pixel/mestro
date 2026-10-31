import { Metadata } from "next";
import Link from "next/link";
import { getPublicQuoteByCode } from "@/app/cotizador-tequilitros/actions";
import QuoteClientViewer from "./QuoteClientViewer";
import { OFFICIAL_WHATSAPP_DISPLAY, OFFICIAL_WHATSAPP_PHONE } from "@/lib/tequilitros/quote-types";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const quote = await getPublicQuoteByCode(code);

  if (!quote) {
    return {
      title: "Cotización no encontrada | Tequilitros",
      description: "La cotización solicitada no existe o ya no se encuentra disponible.",
    };
  }

  const isContract = Boolean(quote.isConfirmed || quote.metadata.isContractConfirmed);
  const folio = isContract ? quote.metadata.contractFolio || quote.code : quote.code;

  return {
    title: `${isContract ? "Contrato" : "Cotización"} ${folio} · ${quote.clientName} | Tequilitros`,
    description: `Presupuesto oficial de Barra Móvil Tequilitros para ${quote.clientName} (${quote.metadata.eventType} en ${quote.location}).`,
  };
}

export default async function PublicQuotePage({ params }: PageProps) {
  const { code } = await params;
  const quote = await getPublicQuoteByCode(code);

  if (!quote) {
    return (
      <div className="min-h-screen bg-[#0C0E12] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/[0.03] p-8 space-y-6 backdrop-blur-xl">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-3xl">
            📋
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Cotización no encontrada</h1>
            <p className="text-xs text-white/60 leading-relaxed">
              El folio <strong className="font-mono text-[#E28735]">{decodeURIComponent(code)}</strong> no está registrado o la fecha de consulta ha expirado.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href={`https://wa.me/${OFFICIAL_WHATSAPP_PHONE}?text=${encodeURIComponent(
                `Hola Tequilitros, requiero consultar el estado de mi cotización con folio: ${decodeURIComponent(code)}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition"
            >
              Consultar por WhatsApp ({OFFICIAL_WHATSAPP_DISPLAY})
            </a>

            <Link
              href="/tequilitros"
              className="flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
            >
              Ir a Tequilitros Eventos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <QuoteClientViewer quote={quote} />;
}
