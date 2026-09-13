"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="min-h-[70vh] grid place-items-center p-6"><div className="max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-semibold">No pudimos abrir el punto de venta</h1><p className="mt-2 text-sm text-gray-500">Revisa la conexión y vuelve a intentarlo. Ninguna venta fue creada.</p><button className="mt-6 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white" onClick={reset}>Reintentar</button></div></div>;
}
