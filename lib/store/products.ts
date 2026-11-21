export type Product = {
  id: string;
  name: string;
  category: "Tequila" | "Licores" | "Packs y Mayoreo";
  price: number;
  originalPrice?: number;
  volume: string;
  alcoholVol?: string;
  shortDesc: string;
  description: string;
  tastingNotes?: {
    aroma?: string;
    taste?: string;
    finish?: string;
  };
  features: string[];
  image: string;
  badge?: string;
  inStock: boolean;
  minOrder?: number;
};

export const STORE_PHONE = "+52 56 6298 9202";
export const STORE_PHONE_CLEAN = "525662989202";
export const STORE_EMAIL = "ventas@destiladoradelnorte.com";
export const STORE_ADDRESS = "Colotlán, Jalisco, México · C.P. 46200";

export const PRODUCTS: Product[] = [
  {
    id: "colotlense-blanco-750",
    name: "Tequila El Colotlense Blanco",
    category: "Tequila",
    price: 380,
    volume: "750 ml",
    alcoholVol: "38% Alc. Vol.",
    shortDesc: "100% Agave Azul Tequilana Weber de doble destilación artesanal en alambique de cobre.",
    description:
      "Nacido en los valles del norte de Jalisco, Tequila El Colotlense Blanco captura la pureza vibrante del agave azul recién cosechado. Sin paso por madera para conservar sus notas herbales, cítricas y el dulzor genuino de los agaves cocidos en horno tradicional de mampostería.",
    tastingNotes: {
      aroma: "Agave cocido fresco, cáscara de lima, toques florales y menta suave.",
      taste: "Sedoso en boca, con un balance cítrico brillante y un carácter mineral distintivo de Colotlán.",
      finish: "Limpio, cálido y prolongado con retrogusto a agave dulce.",
    },
    features: [
      "100% Puro de Agave Azul Tequilana Weber",
      "Doble destilación artesanal en alambique de cobre",
      "Horneado tradicional en mampostería de piedra",
      "Ideal para tomar derecho con sal y limón o coctelería premium",
    ],
    image: "/tienda/tequila-blanco.jpg",
    badge: "100% Agave",
    inStock: true,
  },
  {
    id: "colotlense-reposado-750",
    name: "Tequila El Colotlense Reposado",
    category: "Tequila",
    price: 430,
    originalPrice: 470,
    volume: "750 ml",
    alcoholVol: "38% Alc. Vol.",
    shortDesc: "Madurado pacientemente 6 meses en barricas de roble blanco americano.",
    description:
      "El equilibrio magistral entre la fuerza del agave y la nobleza de la madera. Tras descansar 6 meses en barricas de roble blanco americano, desarrolla un tono ámbar pajizo resplandeciente, con una complejidad aterciopelada que deleita tanto a conocedores como a nuevos paladares.",
    tastingNotes: {
      aroma: "Vainilla suave, caramelo tostado, madera noble y notas ligeras de frutos secos.",
      taste: "Aterciopelado y equilibrado; armonía perfecta entre el dulzor del agave y la madera tostada.",
      finish: "Suave, redondo, con notas cálidas a vainilla y frutos caramelizados.",
    },
    features: [
      "100% Puro de Agave Azul",
      "6 meses de reposo en barrica de roble blanco americano",
      "Tono ámbar natural sin colorantes artificiales",
      "Excelente para cantaritos gourmet y degustación solo en copa",
    ],
    image: "/tienda/tequila-reposado.jpg",
    badge: "Más Vendido",
    inStock: true,
  },
  {
    id: "colotlense-anejo-750",
    name: "Tequila El Colotlense Añejo",
    category: "Tequila",
    price: 590,
    volume: "750 ml",
    alcoholVol: "38% Alc. Vol.",
    shortDesc: "Añejamiento de 18 meses en barricas de roble tostado intenso.",
    description:
      "La joya madura de Destiladora del Norte. Tras 18 meses en barricas de roble seleccionado, este añejo adquiere matices cobrizos profundos, aromas amaderados, notas de chocolate amargo, frutos secos y un cuerpo suntuoso y elegante.",
    tastingNotes: {
      aroma: "Madera tostada profunda, chocolate amargo, almendras tostadas y canela.",
      taste: "Cuerpo robusto y sedoso; notas de cacao, vainilla intensa y roble estructurado.",
      finish: "Muy prolongado, noble y memorable en el paladar.",
    },
    features: [
      "100% Puro de Agave Azul",
      "18 meses de añejamiento en barricas seleccionadas",
      "Edición numerada y lote artesanal controlado",
      "Ideal para digestivo y maridaje con cortes y postres",
    ],
    image: "/tienda/tequila-reposado.jpg",
    badge: "Gran Reserva",
    inStock: true,
  },
  {
    id: "colotlense-cristalino-750",
    name: "Tequila El Colotlense Cristalino",
    category: "Tequila",
    price: 640,
    volume: "750 ml",
    alcoholVol: "38% Alc. Vol.",
    shortDesc: "Añejo filtrado con carbón activado para una pureza cristalina y suavidad inigualable.",
    description:
      "Combina la complejidad aromática y las notas amaderadas de nuestro mejor añejo con una filtración artesanal sobre carbón activado que extrae el color y las asperezas tónicas, logrando una textura de terciopelo cristalino con brillo diamantado.",
    tastingNotes: {
      aroma: "Delicadas notas de vainilla, agave cocido, caramelo y flores blancas.",
      taste: "Extraordinariamente suave y fluido, sin ardor, con notas de vainilla dulce y roble pulido.",
      finish: "Fresco, fino y de permanencia aterciopelada.",
    },
    features: [
      "100% Puro de Agave Azul Añejado",
      "Filtración de ultra-precisión sobre carbón activado",
      "Perfil ultra-suave apto para beber a la roca o en copa fría",
      "Presentación premium con botella de alta transparencia",
    ],
    image: "/tienda/tequila-blanco.jpg",
    badge: "Edición Premium",
    inStock: true,
  },
  {
    id: "licor-zarzamora-750",
    name: "Licor Artesanal de Zarzamora con Tequila",
    category: "Licores",
    price: 260,
    volume: "750 ml",
    alcoholVol: "16% Alc. Vol.",
    shortDesc: "Zarzamoras silvestres maceradas artesanalmente con Tequila de la casa.",
    description:
      "Receta emblemática de la casa elaborada con fruta fresca y tequila 100% de agave a 36° antes de su maceración. Ofrece un perfil vibrante, dulce y ligeramente ácido con un color púrpura profundo y sabor auténtico a fruta real, sin jarabes sintéticos.",
    tastingNotes: {
      aroma: "Zarzamora madura fresca, notas frutales intensas y fondo suave de agave.",
      taste: "Aterciopelado, goloso, con balance perfecto entre dulzor frutal y acidez cítrica.",
      finish: "Refrescante, frutal y envolvente.",
    },
    features: [
      "Elaborado con infusión de zarzamora natural",
      "Base de auténtico Tequila de la destilería",
      "Baja graduación ideal para tomar como digestivo o en coctelería",
      "Perfecto bien frío, en las rocas o con agua mineral",
    ],
    image: "/tienda/licor-zarzamora.jpg",
    badge: "Favorito Artesanal",
    inStock: true,
  },
  {
    id: "licor-mango-750",
    name: "Licor Artesanal de Mango con Tequila",
    category: "Licores",
    price: 260,
    volume: "750 ml",
    alcoholVol: "16% Alc. Vol.",
    shortDesc: "Sabor tropical vibrante con pulpa natural de mango y base de tequila suave.",
    description:
      "Elaborado mediante la maceración lenta de pulpa natural de mango seleccionada en nuestro tequila blanco. Una experiencia sensorial tropical, untuosa y festiva que evoca las tardes cálidas de Jalisco.",
    tastingNotes: {
      aroma: "Mango fresco maduro, néctar tropical y cítricos suaves.",
      taste: "Sedoso y frutal con un toque tequilero estimulante.",
      finish: "Dulce balanceado y persistencia aromática a mango.",
    },
    features: [
      "Pulpa natural de mango",
      "Base de tequila artesanal",
      "Ideal para mezclar con Tajín, chamoy o cerveza (Tequimiche)",
      "Listo para servir directo en shot frío o copa coctelera",
    ],
    image: "/tienda/licor-mango.jpg",
    badge: "Tropical",
    inStock: true,
  },
  {
    id: "licor-jamaica-750",
    name: "Licor Artesanal de Jamaica con Tequila",
    category: "Licores",
    price: 260,
    volume: "750 ml",
    alcoholVol: "16% Alc. Vol.",
    shortDesc: "Infusión profunda de flor de jamaica premium con notas ácidas y fondo tequilero.",
    description:
      "Una creación artesanal refrescante de color rubí brillante. La acidez natural y taninos de la flor de jamaica se combinan con la calidez del tequila para dar una bebida digestiva incomparable y versátil.",
    tastingNotes: {
      aroma: "Flor de jamaica fresca, toques florales y agave ligero.",
      taste: "Fresco, ácido-dulce, limpio y muy apetecible.",
      finish: "Seco y revitalizante en paladar.",
    },
    features: [
      "Flor de jamaica 100% natural infusionada",
      "Tonalidad rubí cristalina",
      "Excelente con hielo, rodaja de naranja y escarchado de sal de mar",
    ],
    image: "/tienda/licor-jamaica.jpg",
    badge: "Refrescante",
    inStock: true,
  },
  {
    id: "concentrado-sangria-1l",
    name: "Concentrado Sangría del Norte (Cantaritos)",
    category: "Licores",
    price: 220,
    volume: "1,000 ml",
    shortDesc: "La fórmula secreta para preparar cantaritos y palomas en barra o eventos.",
    description:
      "Concentrado artesanal de la destilería formulado para rendir y transformar cualquier cóctel en un cantarito estilo Colotlán. Balanceado con cítricos naturales, toque de chamoy y especias sutiles.",
    features: [
      "Rendimiento de alto volumen para eventos y barras",
      "Solo agrega tequila blanco de la casa, refresco de toronja y hielo",
      "Fórmula original de Tequilitros y Destiladora del Norte",
    ],
    image: "/tienda/concentrado-cantarito.jpg",
    badge: "Especial Eventos",
    inStock: true,
  },
  {
    id: "pack-trilogia-colotlense",
    name: "Trilogía Maestro Colotlense (3 x 750 ml)",
    category: "Packs y Mayoreo",
    price: 980,
    originalPrice: 1070,
    volume: "3 botellas de 750 ml",
    shortDesc: "1 Tequila Blanco + 1 Tequila Reposado + 1 Licor Artesanal de Zarzamora.",
    description:
      "El paquete insignia para conocer la gama completa de Destiladora del Norte. Incluye caja de presentación reforzada con embalaje inflable antichoque para envío nacional sin riesgo.",
    features: [
      "1x Tequila El Colotlense Blanco (750 ml)",
      "1x Tequila El Colotlense Reposado (750 ml)",
      "1x Licor Artesanal de Zarzamora (750 ml)",
      "Ahorras $90 MXN respecto a compra individual",
      "Embalaje de seguridad inflable con garantía de rotura cero",
    ],
    image: "/tienda/tequila-reposado.jpg",
    badge: "Pack Degustación",
    inStock: true,
  },
  {
    id: "caja-12-reposado-mayoreo",
    name: "Caja Mayoreo 12 Botellas Tequila El Colotlense Reposado",
    category: "Packs y Mayoreo",
    price: 4350,
    originalPrice: 5160,
    volume: "12 botellas de 750 ml",
    shortDesc: "Caja sellada para distribuidores, eventos, bodas y restaurantes. Envío asegurado.",
    description:
      "Precio preferencial de destilería directa ($362.50 MXN por botella). Cajas reforzadas con separadores de cartón estructural y flejado de alta resistencia para transporte interurbano.",
    features: [
      "12 Botellas de 750 ml Tequila Reposado 100% Agave",
      "Precio mayorista con factura fiscal mexicana (CFDI)",
      "Envío estándar asegurado a cualquier código postal nacional",
      "Soporte directo de ejecutivo de ventas vía WhatsApp",
    ],
    image: "/tienda/tequila-reposado.jpg",
    badge: "Precio Mayorista",
    inStock: true,
    minOrder: 1,
  },
  {
    id: "caja-12-mixta-destiladora",
    name: "Caja Mixta 12 Botellas (6 Tequilas + 6 Licores)",
    category: "Packs y Mayoreo",
    price: 3850,
    originalPrice: 4320,
    volume: "12 botellas surtidas de 750 ml",
    shortDesc: "Surtido variado: 3 Blanco, 3 Reposado, 2 Zarzamora, 2 Mango y 2 Jamaica.",
    description:
      "Ideal para surtir bares particulares, fiestas familiares o negocios que desean ofrecer la variedad completa de destilados y licores artesanales del norte de Jalisco.",
    features: [
      "3x Blanco 750ml, 3x Reposado 750ml",
      "2x Licor Zarzamora, 2x Licor Mango, 2x Licor Jamaica",
      "Embalaje en caja corrugada industrial homologada para paquetería",
      "Factura inmediata disponible",
    ],
    image: "/tienda/tequila-blanco.jpg",
    badge: "Surtido Completo",
    inStock: true,
  },
];
