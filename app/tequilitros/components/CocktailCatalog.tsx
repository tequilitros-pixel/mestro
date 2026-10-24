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
    id: "vampiro",
    name: "Vampiro del Norte",
    category: "especial",
    tag: "Especialidad",
    description: "Preparación intensa y festiva con sangría artesanal, jugo de naranja, cítricos, tequila blanco, Peñafiel toronja y escarchado de Tajín.",
    ingredients: "Sal, limón, sangría, jugo de naranja, tequila, Peñafiel toronja y Tajín.",
    glass: "Vaso Reyma 32 EU",
    image: "/tequilitros/productos/vampiro.png",
    isCutout: true,
  },
  {
    id: "cantarito",
    name: "Cantarito Tequilitros",
    category: "citrico",
    tag: "El Más Pedido",
    description: "El rey de la fiesta: jugo fresco de naranja y toronja exprimido al momento con limón, tequila blanco, Peñafiel toronja y escarchado abundante de Tajín.",
    ingredients: "Sal, limón, jugo de naranja, jugo de toronja, tequila, Peñafiel toronja y Tajín.",
    glass: "Vaso Reyma 32 EU",
    image: "/tequilitros/productos/cantarito.png",
    isCutout: true,
  },
  {
    id: "paloma",
    name: "Paloma Tradicional",
    category: "citrico",
    tag: "Clásico Mexicano",
    description: "Refrescante y equilibrada: sal de grano fina, jugo de limón recién exprimido, tequila reposado y Peñafiel toronja bien frío.",
    ingredients: "Sal, limón, tequila y Peñafiel toronja.",
    glass: "Vaso Reyma 32 EU",
    image: "/tequilitros/productos/paloma.png",
    isCutout: true,
  },
  {
    id: "tequimiche",
    name: "Tequimiche Botanero",
    category: "especial",
    tag: "Sabor Botanero",
    description: "Perfil picante y sazonador: concentrado de salsas de la casa, Clamato, jugo de limón, tequila, agua mineral gasificada y escarchado de Tajín.",
    ingredients: "Sal, limón, concentrado de salsas, Clamato, tequila, agua mineral y Tajín.",
    glass: "Vaso Reyma 32 EU",
    image: "/tequilitros/productos/tequimiche.png",
    isCutout: true,
  },
  {
    id: "tequimora",
    name: "Tequimora",
    category: "frutal",
    tag: "Frutal",
    description: "Dulce y vibrante: zarzamora y granadina con licor, jugo de limón, tequila blanco y refresco, servido con hielos a tope en borde liso.",
    ingredients: "Sal, limón, granadina, licor, tequila y refresco.",
    glass: "Vaso Reyma 32 EU",
    image: "/tequilitros/productos/tequimora.png",
    isCutout: true,
  },
  {
    id: "tequimojito",
    name: "Tequimojito",
    category: "citrico",
    tag: "Menta Fresca",
    description: "Toque turquesa y fresco: licor de menta, granadina, jugo de limón, tequila blanco y Peñafiel toronja servido bien frío.",
    ingredients: "Sal, granadina, licor de menta, tequila y refresco de toronja.",
    glass: "Vaso Reyma 32 EU",
    image: "/tequilitros/productos/tequimojito.png",
    isCutout: true,
  },
  {
    id: "coscorron",
    name: "Coscorrón",
    category: "citrico",
    tag: "Clásico de Cantina",
    description: "El trago directo y tradicional: tequila blanco de la casa, limón fresco, toque de sal y refresco de toronja con abundante hielo.",
    ingredients: "Sal, limón, tequila y refresco de toronja.",
    glass: "Vaso Reyma 32 EU",
    image: "/tequilitros/productos/paloma.png",
    isCutout: true,
  },
  {
    id: "blanco",
    name: "Tequila Blanco (1 Litro)",
    category: "botella",
    tag: "Botella para Mesa",
    description: "Tequila blanco 100% de agave de Destiladora del Norte en Colotlán. Ideal para centros de mesa o botellas por pieza.",
    ingredients: "Tequila 100% agave, 1 Litro · $350 MXN a consumo.",
    glass: "Botella 1 L",
    image: "/tequilitros/blanco.jpg",
  },
  {
    id: "reposado",
    name: "Tequila Reposado (1 Litro)",
    category: "botella",
    tag: "Botella para Mesa",
    description: "Tequila reposado en barricas de roble blanco de Destiladora del Norte. Sabor suave con notas amaderadas.",
    ingredients: "Tequila reposado 100% agave, 1 Litro.",
    glass: "Botella 1 L",
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
      {/* Banner de Degustación Gratuita (Página 2 del manual) */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#D4AF37]/40 bg-gradient-to-r from-[#141B22] via-[#1B2214] to-[#141B22] p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/20 text-xl text-[#D4AF37]">
            🍹
          </span>
          <div>
            <h4 className="font-serif text-base font-bold text-[#F5F2EB]">
              ¿Quieres probar el menú antes de tu evento?
            </h4>
            <p className="text-xs text-[#D2DAE0]">
              Ofrecemos <strong>Degustación Gratuita</strong> en la sucursal disponible más cercana. Se solicita al cotizar tu fecha.
            </p>
          </div>
        </div>
        <a
          href="https://wa.me/525662989202?text=Hola,%20quiero%20cotizar%20Tequilitros%20y%20agendar%20mi%20Degustaci%C3%B3n%20Gratuita."
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-xl bg-[#D4AF37] px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#080B0E] transition hover:bg-[#F59E0B]"
        >
          Pedir Degustación ↗
        </a>
      </div>

      {/* Filtros de Categoría */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {[
          { id: "all", label: "Las 7 Preparaciones + Botellas" },
          { id: "citrico", label: "Cítricos & Tradicionales" },
          { id: "especial", label: "Especialidades Saladas" },
          { id: "frutal", label: "Frutales" },
          { id: "botella", label: "Botellas de Tequila" },
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

      {/* Grid de Cócteles */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((cocktail) => (
          <article
            key={cocktail.id}
            className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#242E37] bg-[#0E1318] transition-all duration-300 hover:border-[#E28735]/60 hover:shadow-xl hover:shadow-[#E28735]/10"
          >
            {/* Foto de producto recortada con aura luminosa */}
            <div className="relative flex h-60 w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_40%,rgba(226,135,53,0.18),transparent_65%),linear-gradient(180deg,#141B22_0%,#0E1318_100%)] p-4">
              <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#E28735] backdrop-blur">
                {cocktail.tag}
              </span>

              <div className="relative h-48 w-36 transition-transform duration-300 group-hover:scale-105">
                <Image
                  src={cocktail.image}
                  alt={cocktail.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 300px"
                  className={cocktail.isCutout ? "object-contain drop-shadow-2xl" : "object-cover rounded-xl"}
                />
              </div>

              {cocktail.isCutout && (
                <button
                  type="button"
                  onClick={() => handleInspect3D(cocktail.id)}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#080B0E]/80 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] opacity-90 backdrop-blur transition hover:bg-[#D4AF37] hover:text-[#080B0E]"
                >
                  <span>Ver en 3D</span>
                  <span>↻</span>
                </button>
              )}
            </div>

            {/* Contenido Editorial */}
            <div className="flex flex-1 flex-col justify-between p-5">
              <div>
                <h3 className="font-serif text-xl font-bold tracking-tight text-[#F5F2EB]">
                  {cocktail.name}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#9AA5AC]">
                  {cocktail.description}
                </p>
              </div>

              <div className="mt-4 border-t border-[#1C252D] pt-3">
                <p className="font-mono text-[11px] text-[#A8B4BC]">
                  <strong className="text-[#E28735]">Ingredientes:</strong> {cocktail.ingredients}
                </p>
                <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-[#717F8A]">
                  <span>Vaso: {cocktail.glass}</span>
                  <span className="text-[#30D158]">✓ En ambas modalidades</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
