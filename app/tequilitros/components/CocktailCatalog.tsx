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
};

const COCKTAILS: CocktailItem[] = [
  {
    id: "cantarito",
    name: "Cantarito Tequilitros",
    category: "citrico",
    tag: "El Más Solicitado · Insignia",
    description: "Cítricos naturales recién exprimidos, tequila blanco de la casa y refresco de toronja. Servido bien frío con escarchado de sal de grano y chile.",
    ingredients: "Tequila blanco Destiladora del Norte, toronja, naranja, limón, sal de mar y chile en polvo.",
    glass: "Vaso Reyma 32 EU (1 Litro) o Cantarito de Barro",
    image: "/tequilitros/cantarito.jpg",
  },
  {
    id: "paloma",
    name: "Paloma Tradicional",
    category: "citrico",
    tag: "Clásico Mexicano",
    description: "Toronja pura, limón fresco, tequila reposado madurado en roble y escarchado de sal fina. Refrescante, balanceado y elegante para toda ocasión.",
    ingredients: "Tequila reposado de la casa, jugo de toronja natural, limón criollo y sal de mesa.",
    glass: "Vaso Reyma 32 EU / Copa para evento",
    image: "/tequilitros/paloma.jpg",
  },
  {
    id: "vampiro",
    name: "Vampiro del Norte",
    category: "especial",
    tag: "Receta Regional de la Casa",
    description: "Elaborado con nuestra sangrita artesanal casera, cítricos, tequila blanco y sal. Carácter firme, color vibrante y sabor inconfundible.",
    ingredients: "Sangrita artesanal, tequila blanco, limón fresco, sal de grano y refresco de toronja.",
    glass: "Vaso Reyma 32 EU (1 Litro)",
    image: "/tequilitros/vampiro.jpg",
  },
  {
    id: "tequimango",
    name: "Tequimango Tropical",
    category: "frutal",
    tag: "Fruta Natural",
    description: "La propuesta frutal más refrescante: pulpa de mango natural, licor artesanal de mango, tequila y escarchado agridulce con chamoy y tajín.",
    ingredients: "Pulpa de mango maduro, tequila blanco, licor de mango, limón y escarchado chamoy.",
    glass: "Vaso Reyma 32 EU (1 Litro)",
    image: "/tequilitros/tequimango.jpg",
  },
  {
    id: "tequimora",
    name: "Tequimora Gourmet",
    category: "frutal",
    tag: "Edición Especial",
    description: "Zarzamora silvestre macerada, notas dulces y ácidas con tequila blanco. Un perfil aromático refinado para eventos que buscan distinción.",
    ingredients: "Zarzamora natural macerada, tequila blanco, cítricos y jarabe artesanal.",
    glass: "Vaso Reyma 32 EU / Vaso corto",
    image: "/tequilitros/zarzamora.jpg",
  },
  {
    id: "tequimiche",
    name: "Tequimiche",
    category: "especial",
    tag: "Perfil Botanero y Salado",
    description: "Receta secreta de salsas sazonadoras negras, limón y tequila. Creado especialmente para quienes disfrutan el perfil michelado con carácter destilado.",
    ingredients: "Mezcla de salsas negras, limón, sal de apio, chile en polvo y tequila.",
    glass: "Vaso Reyma 32 EU (1 Litro)",
    image: "/tequilitros/tequimiche.jpg",
  },
  {
    id: "blanco",
    name: "Tequila Blanco Destiladora del Norte",
    category: "botella",
    tag: "100% Agave · Grado Artesanal",
    description: "Embotellado directo del alambique de cobre en Colotlán. Perfil limpio, notas herbales y frescura inigualable para centros de mesa.",
    ingredients: "100% Agave Azul Tequilana Weber. Destilación tradicional.",
    glass: "Botella 750 ml para mesa",
    image: "/tequilitros/blanco.jpg",
  },
  {
    id: "reposado",
    name: "Tequila Reposado Destiladora del Norte",
    category: "botella",
    tag: "Madurado en Roble",
    description: "Reposo paciente en barrica de roble. Notas de madera suave, vainilla natural y caramelo sutil. La joya de la destilería para brindar con calma.",
    ingredients: "100% Agave madurado en barrica de roble.",
    glass: "Botella 750 ml para mesa",
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
      {/* Filtros de Categoría */}
      <div className="mb-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {[
          { id: "all", label: "Toda la Carta (8)" },
          { id: "citrico", label: "Cítricos & Tradicionales" },
          { id: "frutal", label: "Frutales de Autor" },
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
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#141B22]">
              <Image
                src={item.image}
                alt={`${item.name} de Tequilitros`}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0E1318] via-[#0E1318]/20 to-transparent" />

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
