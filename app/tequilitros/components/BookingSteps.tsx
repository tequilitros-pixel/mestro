"use client";

const STEPS = [
  {
    step: "01",
    title: "Comparte tres datos",
    desc: "Solo dinos la fecha de tu evento, ubicación y número estimado de asistentes (desde 40 personas).",
    highlight: "Fecha, lugar y personas",
  },
  {
    step: "02",
    title: "Recibe tu cotización final",
    desc: "Te enviamos el desglose exacto: costo por persona o por hora, insumos y viáticos transparentes según tu municipio.",
    highlight: "Presupuesto claro y por escrito",
  },
  {
    step: "03",
    title: "Aparta tu fecha con el 50%",
    desc: "Tu fecha queda formalmente reservada en nuestra agenda exclusiva al recibir el anticipo del 50%.",
    highlight: "Fecha bloqueada para tu evento",
  },
  {
    step: "04",
    title: "Liquida el saldo",
    desc: "En Barra Libre, se liquida antes de iniciar el servicio. En Barra a Consumo, al finalizar el evento tras el conteo de botellas y vasos.",
    highlight: "Liquidación transparente",
  },
];

export default function BookingSteps() {
  return (
    <div className="w-full">
      {/* 4 Pasos en Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, index) => (
          <div
            key={index}
            className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#242E37] bg-gradient-to-b from-[#141B22] to-[#0E1318] p-6 transition-all duration-300 hover:border-[#E28735]/60 hover:shadow-lg hover:shadow-[#E28735]/10"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-3xl font-extrabold text-[#E28735]">
                  {s.step}
                </span>
                <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#D4AF37]">
                  PASO {index + 1}
                </span>
              </div>
              <h3 className="mt-4 font-serif text-lg font-bold text-[#F5F2EB]">
                {s.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                {s.desc}
              </p>
            </div>

            <div className="mt-4 border-t border-[#1C252D] pt-3">
              <span className="font-mono text-[11px] font-semibold text-[#D4AF37]">
                ✓ {s.highlight}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Qué necesita el cliente vs Condiciones Importantes */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Qué necesita el cliente */}
        <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E28735]/20 text-xl text-[#E28735]">
              ⚡
            </span>
            <div>
              <h4 className="font-serif text-lg font-bold text-[#F5F2EB]">
                ¿Qué necesita el cliente en su salón o jardín?
              </h4>
              <p className="font-mono text-[11px] text-[#9AA5AC]">Requisitos mínimos para la instalación</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[#D2DAE0]">
            Únicamente un <strong>espacio adecuado, seguro y accesible</strong> para instalar la barra móvil,
            con toma de <strong>energía eléctrica y agua corriente</strong> cuando sean necesarias.
            Nosotros llevamos la barra, los bartenders, las botellas, el hielo, la fruta y toda la cristalería/vasos de 32 oz.
          </p>
        </div>

        {/* Condiciones Importantes */}
        <div className="rounded-2xl border border-[#242E37] bg-[#0E1318] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4AF37]/20 text-xl text-[#D4AF37]">
              📋
            </span>
            <div>
              <h4 className="font-serif text-lg font-bold text-[#F5F2EB]">
                Condiciones importantes de servicio
              </h4>
              <p className="font-mono text-[11px] text-[#9AA5AC]">Políticas claras y transparentes</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-xs text-[#9AA5AC]">
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#E28735]">•</span>
              <span><strong>Mínimo de asistentes:</strong> Atendemos eventos desde 40 personas.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#E28735]">•</span>
              <span><strong>Anticipo:</strong> El 50% de anticipo no es reembolsable si el cliente cancela.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#E28735]">•</span>
              <span><strong>Cambios de fecha:</strong> Sujetos a disponibilidad en agenda.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-[#E28735]">•</span>
              <span><strong>Cuidado de equipo:</strong> Daños extraordinarios al equipo corren por cuenta del contratante.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
