import { getQuotesListAction } from "../actions";
import ContratosClient from "./ContratosClient";

export const metadata = {
  title: "Recibos y Contratos Oficiales | Cotizador Tequilitros",
  description: "Contratos de servicio y recibos de anticipo de Tequilitros.",
};

export default async function ContratosPage() {
  const allQuotes = await getQuotesListAction();
  const confirmedContracts = allQuotes.filter((q) => q.isConfirmed);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ContratosClient contracts={confirmedContracts} />
    </div>
  );
}
