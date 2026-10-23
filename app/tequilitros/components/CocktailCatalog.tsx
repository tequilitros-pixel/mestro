"use client";

import { useState } from "react";
import Image from "next/image";

export type CocktailItem = {
  id: string;
  name: string;
  category: "citrico" | "frutal" | "especial" | "botella";
  tag: string;
  description: string;
  ingredients: string;
  glass: string;
  image: string;
  isCutout?: boolean;
};

const COCKTAILS: CocktailItem[] = [
  {
    id: "cantarito",
    name: "Cantarito Tequilitros",
    category: "citrico",
    tag: "Cítrico",
    description: "Preparación con cítricos, tequila blanco, refresco de toronja y escarchado. La receta y disponibilidad se confirman por evento.",
    ingredients: "Toronja, naranja, limón, tequila blanco y escarchado, sujetos a confirmación.",
    glass: "Vaso Reyma 32 EU o presentación por confirmar",
    image: "/tequilitros/productos/cantarito.png",
    isCutout: true,
  },
  {
    id: "paloma",
    name: "Paloma Tradicional",
    category: "citrico",
    tag: "Clásico Mexicano",
    description: "Preparación con toronja, limón, tequila reposado y escarchado. La receta y presentación se confirman por evento.",
    ingredients: "Toronja, limón, tequila reposado y escarchado, sujetos a confirmación.",
    glass: "Vaso Reyma 32 EU o copa, por confirmar",
    image: "/tequilitros/productos/paloma.png",
    isCutout: true,
  },
  {
    id: "vampiro",
    name: "Vampiro del Norte",
    category: "especial",
    tag: "Especialidad",
    description: "Preparación con sangrita, cítricos, tequila blanco y sal. La receta y disponibilidad se confirman por evento.",
    ingredients: "Sangrita, tequila blanco, limón, sal y refresco de toronja, sujetos a confirmación.",
    glass: "Vaso Reyma 32 EU o presentación por confirmar",
    image: "/tequilitros/productos/vampiro.png",
    isCutout: true,
  },
  {
    id: "tequimojito",
    name: "Tequimojito",
    category: "citrico",
    tag: "Refrescante",
    description: "Preparación con menta fresca macerada, jugo de limón, tequila blanco, refresco lima-limón y toque cítrico color turquesa.",
    ingredients: "Menta fresca, tequila blanco, limón recién exprimido, refresco lima-limón y toque cítrico, sujetos a confirmación.",
    glass: "Vaso Reyma 32 EU",
    image: "/tequilitros/productos/tequimojito.png",
    isCutout: true,
  },
  {
    id: "tequimora",
    name: "Tequimora",
    category: "frutal",
    tag: "Frutal",
    description: "Preparación con zarzamora, tequila blanco, cítricos y jarabe. La receta y disponibilidad se confirman por evento.",
    ingredients: "Zarzamora, tequila blanco, cítricos y jarabe, sujetos a confirmación.",
    glass: "Vaso Reyma 32 EU o vaso corto, por confirmar",
    image: "/tequilitros/productos/tequimora.png",
    isCutout: true,
  },
  {
    id: "tequimiche",
    name: "Tequimiche",
    category: "especial",
    tag: "Perfil Botanero y Salado",
    description: "Preparación con salsas sazonadoras, limón y tequila. La receta y disponibilidad se confirman por evento.",
    ingredients: "Salsas, limón, sal, chile y tequila, sujetos a confirmación.",
    glass: "Vaso Reyma 32 EU o presentación por confirmar",
    image: "/tequilitros/productos/tequimiche.png",
    isCutout: true,
  },
  {
    id: "blanco",
    name: "Tequila Blanco Destiladora del Norte",
    category: "botella",
    tag: "Botella",
    description: "Tequila Blanco de Destiladora del Norte. La presentación, disponibilidad y uso para el evento se confirman por cotización.",
    ingredients: "Información de elaboración y presentación por confirmar.",
    glass: "Botella o presentación por confirmar",
    image: "/tequilitros/blanco.jpg",
  },
  {
    id: "reposado",
    name: "Tequila Reposado Destiladora del Norte",
    category: "botella",
    tag: "Botella",
    description: "Tequila Reposado de Destiladora del Norte. La presentación, disponibilidad y uso para el evento se confirman por cotización.",
    ingredients: "Información de elaboración y presentación por confirmar.",
    glass: "Botella o presentación por confirmar",
    image: "/tequilitros/reposado.jpg",
  },
];

export default function CocktailCatalog({
  onSelectFor3D,
}: {
  onSelectFor3D?: (id: string) => void;
}) {
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const filteredItems = COCKTAILS.filter((item) => {
    if (activeFilter === "all") return true;
    return item.category === activeFilter;
  });

  const handleInspect3D = (id: string) => {
    onSelectFor3D?.(id);
    const element = document.getElementById("vaso3d");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#242E37] bg-[#0E1318]/70 p-5 sm:flex-row sm:items-center">
        <p className="max-w-2xl text-xs leading-relaxed text-[#9AA5AC]">
          Consulta el menú vigente con sus preparaciones y precios publicados. La disponibilidad,
          presentación y condiciones para tu evento se confirman por WhatsApp.
        </p>
        <a
          href="/tequilitros/menu-oficial.pdf"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-lg border border-[#E28735]/50 bg-[#E28735]/10 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#E28735] transition hover:border-[#E28735] hover:bg-[#E28735]/20"
        >
          Abrir menú actual ↗
        </a>
      </div>

      {/* Filtros de Categoría */}
      <div className="mb-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {[
          { id: "all", label: "Toda la Carta (8)" },
          { id: "citrico", label: "Cítricos & Tradicionales" },
          { id: "frutal", label: "Frutales" },
          { id: "especial", label: "Especialidades Saladas" },
          { id: "botella", label: "Botellas Destiladora del Norte" },
        ].map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setActiveFilter(filter.id)}
            className={`rounded-full px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
              activeFilter === filter.id
                ? "bg-[#E28735] text-[#080B0E] shadow-lg shadow-[#E28735]/20"
                : "border border-[#242E37] bg-[#12181F]/70 text-[#9AA5AC] hover:border-[#3A4652] hover:text-[#F5F2EB]"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Grid de Bebidas y Botellas */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredItems.map((item) => (
          <article
            key={item.id}
            className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#242E37] bg-[#0E1318] transition-all duration-300 hover:-translate-y-1 hover:border-[#E28735]/50 hover:shadow-2xl hover:shadow-[#E28735]/5"
          >
            {/* Foto con gradiente */}
            <div className={`relative aspect-[4/5] w-full overflow-hidden ${item.isCutout ? "bg-[radial-gradient(circle_at_50%_28%,rgba(226,135,53,0.28),transparent_38%),linear-gradient(145deg,#1B242C_0%,#0B1014_54%,#17100D_100%)]" : "bg-[#141B22]"}`}>
              <Image
                src={item.image}
                alt={`${item.name} de Tequilitros`}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className={item.isCutout
                  ? "object-contain p-3 drop-shadow-2xl transition-transform duration-700 ease-out group-hover:scale-105"
                  : "object-cover transition-transform duration-700 ease-out group-hover:scale-105"}
              />
              <div className={`absolute inset-0 ${item.isCutout ? "bg-gradient-to-t from-[#0E1318] via-transparent to-transparent" : "bg-gradient-to-t from-[#0E1318] via-[#0E1318]/20 to-transparent"}`} />

              {/* Tag superior */}
              <div className="absolute left-3 top-3">
                <span className="rounded-full border border-white/20 bg-[#080B0E]/80 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-[#E28735] backdrop-blur-md">
                  {item.tag}
                </span>
              </div>
            </div>

            {/* Contenido Editorial */}
            <div className="flex flex-1 flex-col justify-between p-5">
              <div>
                <h3 className="font-serif text-xl font-bold tracking-tight text-[#F5F2EB] group-hover:text-[#E28735] transition-colors">
                  {item.name}
                </h3>

                <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                  {item.description}
                </p>

                <div className="mt-4 space-y-1.5 border-t border-[#1C252E] pt-3 text-[11px]">
                  <p className="text-[#9AA5AC]">
                    <span className="font-mono font-bold text-[#D4AF37]">Notas:</span>{" "}
                    {item.ingredients}
                  </p>
                  <p className="font-mono text-[10px] text-[#A8B4BC]">
                    <span className="font-bold text-[#E28735]">Servicio:</span> {item.glass}
                  </p>
                </div>
              </div>

              {/* Acciones */}
              <div className="mt-5 flex items-center gap-2 pt-3 border-t border-[#1C252E]">
                {item.category !== "botella" ? (
                  <button
                    type="button"
                    onClick={() => handleInspect3D(item.id)}
                    className="flex-1 rounded-lg border border-[#242E37] bg-[#141B22] py-2 text-center font-mono text-[11px] font-semibold text-[#F5F2EB] transition hover:border-[#E28735] hover:bg-[#E28735]/15 hover:text-[#E28735]"
                  >
                    Ver en Vaso 3D ↻
                  </button>
                ) : (
                  <a
                    href="#cotizar"
                    className="flex-1 rounded-lg border border-[#242E37] bg-[#141B22] py-2 text-center font-mono text-[11px] font-semibold text-[#F5F2EB] transition hover:border-[#D4AF37] hover:bg-[#D4AF37]/15 hover:text-[#D4AF37]"
                  >
                    Consultar botellas ↗
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
