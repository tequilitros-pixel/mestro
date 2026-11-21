"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  type Product,
  PRODUCTS,
  STORE_PHONE,
  STORE_PHONE_CLEAN,
  STORE_EMAIL,
  STORE_ADDRESS,
} from "@/lib/store/products";

type CartItem = {
  product: Product;
  quantity: number;
};

type ShippingType = "standard" | "express";

export default function StoreClient() {
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [activeModalProduct, setActiveModalProduct] = useState<Product | null>(null);
  const [ageVerified, setAgeVerified] = useState<boolean>(true); // default true for SSR, validated on mount
  const [showAgeModal, setShowAgeModal] = useState<boolean>(false);

  // Formulario de Envío
  const [shippingType, setShippingType] = useState<ShippingType>("standard");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerZip, setCustomerZip] = useState<string>("");
  const [customerCity, setCustomerCity] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Check age verification in localStorage
  useEffect(() => {
    const verified = localStorage.getItem("el_colotlense_age_verified");
    if (!verified) {
      setShowAgeModal(true);
    }
  }, []);

  const handleVerifyAge = (isAdult: boolean) => {
    if (isAdult) {
      localStorage.setItem("el_colotlense_age_verified", "true");
      setShowAgeModal(false);
      setAgeVerified(true);
    } else {
      window.location.href = "https://www.google.com";
    }
  };

  const categories = ["Todos", "Tequila", "Licores", "Packs y Mayoreo"];

  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((item) => {
      const matchCategory =
        selectedCategory === "Todos" || item.category === selectedCategory;
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  const getItemQuantity = (productId: string) => {
    return quantities[productId] || 1;
  };

  const setItemQuantity = (productId: string, val: number) => {
    const nextVal = Math.max(1, Math.min(99, val));
    setQuantities((prev) => ({ ...prev, [productId]: nextVal }));
  };

  const addToCart = (product: Product, qty?: number) => {
    const quantityToAdd = qty || getItemQuantity(product.id);
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantityToAdd }
            : item
        );
      }
      return [...prev, { product, quantity: quantityToAdd }];
    });
    setIsCartOpen(true);
  };

  const updateCartQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
    } else {
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === productId ? { ...item, quantity: newQty } : item
        )
      );
    }
  };

  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  }, [cart]);

  const totalBottles = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Envío gratis a partir de $2,500 MXN o en compras de mayoreo
  const isFreeShipping = cartSubtotal >= 2500 || cart.some(i => i.product.category === "Packs y Mayoreo" && i.product.price >= 3500);

  const shippingCost = useMemo(() => {
    if (cart.length === 0) return 0;
    if (isFreeShipping && shippingType === "standard") return 0;
    if (isFreeShipping && shippingType === "express") return 120; // suplemento express
    return shippingType === "standard" ? 180 : 260;
  }, [cart.length, isFreeShipping, shippingType]);

  const orderTotal = cartSubtotal + shippingCost;

  // Enlace directo de compra por WhatsApp para un producto individual
  const buildSingleProductWhatsAppUrl = (product: Product) => {
    const qty = getItemQuantity(product.id);
    const total = product.price * qty;
    const text = `¡Hola Destiladora del Norte! 👋\nMe interesa adquirir desde su tienda en línea:\n\n📦 *${qty}x ${product.name}*\n• Presentación: ${product.volume}\n• Total estimado: $${total.toLocaleString("es-MX")} MXN\n\n¿Me podrían cotizar el envío a mi código postal y proporcionarme los datos para concretar la compra?`;
    return `https://wa.me/${STORE_PHONE_CLEAN}?text=${encodeURIComponent(text)}`;
  };

  // Enlace de WhatsApp con el carrito completo y datos de envío
  const buildCartWhatsAppUrl = () => {
    let text = `🛒 *NUEVO PEDIDO - TIENDA DESTILADORA DEL NORTE*\n_Tequila El Colotlense y Licores Artesanales_\n\n*PRODUCTOS:*`;

    cart.forEach((item) => {
      text += `\n• ${item.quantity}x ${item.product.name} (${item.product.volume}) - $${(
        item.product.price * item.quantity
      ).toLocaleString("es-MX")} MXN`;
    });

    text += `\n\n*RESUMEN FINANCIERO:*`;
    text += `\n• Subtotal: $${cartSubtotal.toLocaleString("es-MX")} MXN`;
    text += `\n• Envío (${shippingType === "standard" ? "Estándar 3-5 días" : "Express 24-48 hrs"}): ${
      shippingCost === 0 ? "GRATIS" : `$${shippingCost.toLocaleString("es-MX")} MXN`
    }`;
    text += `\n• *TOTAL A PAGAR: $${orderTotal.toLocaleString("es-MX")} MXN*`;

    if (customerName || customerZip || customerCity || customerAddress) {
      text += `\n\n*DATOS DE ENVÍO:*`;
      if (customerName) text += `\n• Destinatario: ${customerName}`;
      if (customerZip) text += `\n• C.P.: ${customerZip}`;
      if (customerCity) text += `\n• Ciudad / Estado: ${customerCity}`;
      if (customerAddress) text += `\n• Dirección: ${customerAddress}`;
    }

    text += `\n\nPor favor indíquenme los métodos de pago (transferencia SPEI / enlace de pago) para confirmar mi orden y procesar el envío.`;
    return `https://wa.me/${STORE_PHONE_CLEAN}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 font-sans selection:bg-amber-500 selection:text-black">
      {/* AVISO LEGAL DE MAYORÍA DE EDAD (MODAL) */}
      {showAgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="max-w-md w-full bg-[#14161f] border border-amber-500/30 rounded-2xl p-6 sm:p-8 text-center shadow-2xl shadow-amber-500/10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-2xl">
              18+
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-amber-100 mb-2">
              Verificación de Edad Requerida
            </h2>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Bienvenido al sitio oficial de venta de <strong className="text-amber-300">Destiladora del Norte</strong> y <strong className="text-amber-300">Tequila El Colotlense</strong>. Por disposición de la legislación mexicana, debes ser mayor de 18 años para ingresar a este sitio de venta de bebidas alcohólicas.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleVerifyAge(true)}
                className="flex-1 py-3 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-amber-500/20 text-sm cursor-pointer"
              >
                Soy mayor de 18 años
              </button>
              <button
                onClick={() => handleVerifyAge(false)}
                className="py-3 px-6 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition text-sm cursor-pointer"
              >
                No tengo 18 años
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-4">
              El abuso en el consumo de este producto es nocivo para la salud.
            </p>
          </div>
        </div>
      )}

      {/* CINTILLO SUPERIOR DE PAQUETERÍA Y ENVÍO */}
      <aside aria-label="Aviso de envíos" className="bg-gradient-to-r from-amber-950/80 via-amber-900/60 to-amber-950/80 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>
              🚚 <strong>Envíos Seguros a Todo México</strong> | Embalaje Especializado Anti-Impacto para Botellas
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-amber-200">
            <span>📦 Paquetería Certificada</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">🛡️ Seguro de Rotura 100% Cubierto</span>
            <span>•</span>
            <a
              href={`https://wa.me/${STORE_PHONE_CLEAN}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline font-semibold"
            >
              WhatsApp: {STORE_PHONE}
            </a>
          </div>
        </div>
      </aside>

      {/* HEADER / NAVBAR PRINCIPAL */}
      <header className="sticky top-0 z-40 bg-[#090a0f]/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* LOGO & BRAND */}
          <Link href="/tienda" className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition">
              <span className="font-serif font-black text-2xl text-slate-950">DN</span>
            </div>
            <div>
              <div className="font-serif font-black text-lg sm:text-xl tracking-wide text-amber-100 leading-tight">
                TEQUILA EL COLOTLENSE
              </div>
              <div className="text-[11px] tracking-widest uppercase font-semibold text-amber-400/90">
                Destiladora del Norte · Colotlán, Jal.
              </div>
            </div>
          </Link>

          {/* DESKTOP NAV LINKS */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a href="#catalogo" className="hover:text-amber-400 transition">
              Catálogo de Botellas
            </a>
            <a href="#envios" className="hover:text-amber-400 transition">
              Sistema de Envíos
            </a>
            <a href="#destileria" className="hover:text-amber-400 transition">
              Nuestra Destilería
            </a>
            <a href="#faq" className="hover:text-amber-400 transition">
              Preguntas Frecuentes
            </a>
          </nav>

          {/* ACTIONS & CART BUTTON */}
          <div className="flex items-center gap-3">
            <a
              href={`https://wa.me/${STORE_PHONE_CLEAN}?text=${encodeURIComponent(
                "Hola Destiladora del Norte, me gustaría información sobre sus tequilas y licores para hacer un pedido."
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30 font-medium text-sm transition"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.585 1.961.904 2.8.904h.005c3.18 0 5.768-2.586 5.768-5.766 0-3.18-2.588-5.791-5.777-5.791zm3.36 8.163c-.144.405-.837.774-1.17.822-.312.043-.734.076-2.378-.604-1.979-.817-3.238-2.827-3.337-2.96-.099-.133-.798-1.059-.798-2.02 0-.962.503-1.436.682-1.634.18-.198.394-.247.525-.247.13 0 .261.002.373.007.119.006.279-.046.435.33.161.385.551 1.341.599 1.44.048.099.08.214.015.345-.065.132-.098.214-.196.33-.099.115-.207.256-.296.345-.1.099-.204.207-.088.406.116.198.514.848 1.103 1.372.759.675 1.4.884 1.599.983.199.099.314.083.431-.05.116-.133.498-.58.631-.779.133-.198.266-.165.449-.099.183.066 1.157.545 1.356.644.199.099.331.149.38.232.049.083.049.48-.095.885z" />
              </svg>
              <span>Atención WhatsApp</span>
            </a>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <span className="hidden sm:inline">Ver Pedido</span>
              {totalBottles > 0 && (
                <span className="w-5 h-5 rounded-full bg-slate-950 text-amber-300 font-black text-xs flex items-center justify-center">
                  {totalBottles}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 border-b border-slate-800/80 bg-gradient-to-b from-[#11131a] via-[#090a0f] to-[#090a0f]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(217,119,6,0.15),transparent_60%)] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-6">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Punto de Venta Oficial &middot; Destiladora del Norte
            </div>

            <h1 className="text-4xl sm:text-6xl font-serif font-black tracking-tight text-amber-50 leading-[1.1] mb-6">
              Tequila El Colotlense <br />
              <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600 bg-clip-text text-transparent">
                &amp; Licores Artesanales
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 mb-8 leading-relaxed">
              Venta directa de destilería desde <strong>Colotlán, Jalisco</strong>. Tequilas 100% Puro de Agave Azul Tequilana Weber y licores macerados con fruta natural. Despachamos pedidos para particulares, eventos, restaurantes y mayoristas con <strong>sistema de envío nacional protegido</strong>.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="#catalogo"
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl transition shadow-xl shadow-amber-500/20 text-center"
              >
                Explorar Catálogo y Precios
              </a>
              <a
                href={`https://wa.me/${STORE_PHONE_CLEAN}?text=${encodeURIComponent(
                  "Hola, me gustaría cotizar un pedido de Tequila El Colotlense con envío a mi domicilio."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-3.5 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 font-semibold rounded-xl transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 fill-emerald-400" viewBox="0 0 24 24">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.585 1.961.904 2.8.904h.005c3.18 0 5.768-2.586 5.768-5.766 0-3.18-2.588-5.791-5.777-5.791zm3.36 8.163c-.144.405-.837.774-1.17.822-.312.043-.734.076-2.378-.604-1.979-.817-3.238-2.827-3.337-2.96-.099-.133-.798-1.059-.798-2.02 0-.962.503-1.436.682-1.634.18-.198.394-.247.525-.247.13 0 .261.002.373.007.119.006.279-.046.435.33.161.385.551 1.341.599 1.44.048.099.08.214.015.345-.065.132-.098.214-.196.33-.099.115-.207.256-.296.345-.1.099-.204.207-.088.406.116.198.514.848 1.103 1.372.759.675 1.4.884 1.599.983.199.099.314.083.431-.05.116-.133.498-.58.631-.779.133-.198.266-.165.449-.099.183.066 1.157.545 1.356.644.199.099.331.149.38.232.049.083.049.48-.095.885z" />
                </svg>
                <span>Cotizar por WhatsApp</span>
              </a>
            </div>

            {/* TRUST BADGES */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-14 pt-8 border-t border-slate-800/80 text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  🌱
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-100">100% Agave Azul</div>
                  <div className="text-[11px] text-slate-400">Tequilana Weber selecto</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  🔥
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-100">Doble Destilación</div>
                  <div className="text-[11px] text-slate-400">Alambique de cobre</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  📦
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-100">Embalaje Blindado</div>
                  <div className="text-[11px] text-slate-400">Cámaras de aire inflable</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  🇲🇽
                </div>
                <div>
                  <div className="text-xs font-bold text-amber-100">Envíos a Todo México</div>
                  <div className="text-[11px] text-slate-400">Guía y rastreo en línea</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BANNER INFORMATIVO PARA PAQUETERÍAS Y CLIENTES */}
      <section className="bg-gradient-to-r from-slate-900 via-[#141622] to-slate-900 border-b border-slate-800 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl">
              📍
            </div>
            <div>
              <div className="text-sm font-bold text-amber-200">
                Punto de Venta Autorizado · Destiladora del Norte
              </div>
              <div className="text-xs text-slate-400">
                Planta procesadora y oficinas: {STORE_ADDRESS}. Registro comercial de envío para paqueterías autorizadas.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-slate-800 rounded-lg text-xs font-semibold text-slate-300 border border-slate-700">
              Venta Directa
            </span>
            <span className="px-3 py-1 bg-slate-800 rounded-lg text-xs font-semibold text-slate-300 border border-slate-700">
              Facturación CFDI
            </span>
            <span className="px-3 py-1 bg-slate-800 rounded-lg text-xs font-semibold text-slate-300 border border-slate-700">
              Cajas Homologadas
            </span>
          </div>
        </div>
      </section>

      {/* CATÁLOGO DE PRODUCTOS */}
      <section id="catalogo" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
              Línea Oficial de Botellas
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-black text-amber-50">
              Nuestros Tequilas y Licores
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Selecciona tus botellas, revisa las notas de cata y finaliza tu pedido de forma rápida vía WhatsApp.
            </p>
          </div>

          {/* BUSCADOR Y FILTRO */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar botella o licor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-4 py-2 bg-[#12141c] border border-slate-700/80 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-500"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* TABS DE CATEGORÍA */}
        <div className="flex flex-wrap gap-2 mb-10 pb-4 border-b border-slate-800">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                selectedCategory === cat
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* PRODUCT GRID */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-[#12141c] rounded-2xl border border-slate-800">
            <p className="text-slate-400 text-base">No se encontraron productos en esta categoría.</p>
            <button
              onClick={() => {
                setSelectedCategory("Todos");
                setSearchQuery("");
              }}
              className="mt-4 px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg text-sm"
            >
              Ver todos los productos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProducts.map((product) => {
              const qty = getItemQuantity(product.id);
              const singleUrl = buildSingleProductWhatsAppUrl(product);

              return (
                <div
                  key={product.id}
                  className="group bg-gradient-to-b from-[#141620] to-[#0d0e15] border border-slate-800/90 hover:border-amber-500/40 rounded-2xl overflow-hidden transition duration-300 hover:shadow-2xl hover:shadow-amber-500/10 flex flex-col justify-between"
                >
                  <div>
                    {/* BOTTLE IMAGE CONTAINER */}
                    <div className="relative h-64 sm:h-72 w-full bg-[#08090d] overflow-hidden flex items-center justify-center p-4">
                      {product.badge && (
                        <div className="absolute top-3 left-3 z-10 px-3 py-1 rounded-full bg-amber-500/90 text-slate-950 text-xs font-bold shadow-md">
                          {product.badge}
                        </div>
                      )}
                      <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-amber-200 text-xs font-semibold border border-amber-500/20">
                        {product.volume}
                      </div>

                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-contain p-4 group-hover:scale-105 transition duration-500"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>

                    {/* PRODUCT CONTENT */}
                    <div className="p-6">
                      <div className="flex items-center justify-between text-xs text-amber-400 font-semibold uppercase tracking-wider mb-2">
                        <span>{product.category}</span>
                        {product.alcoholVol && (
                          <span className="text-slate-400 lowercase">{product.alcoholVol}</span>
                        )}
                      </div>

                      <h3 className="text-xl font-serif font-bold text-amber-100 group-hover:text-amber-300 transition leading-snug mb-2">
                        {product.name}
                      </h3>

                      <p className="text-xs text-slate-300 line-clamp-2 mb-4 leading-relaxed">
                        {product.shortDesc}
                      </p>

                      {/* FEATURES PILLS */}
                      <div className="space-y-1.5 mb-5">
                        {product.features.slice(0, 2).map((feat, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="text-amber-400 font-bold">✓</span>
                            <span className="truncate">{feat}</span>
                          </div>
                        ))}
                      </div>

                      {/* BOTÓN VER FICHA TÉCNICA */}
                      <button
                        onClick={() => setActiveModalProduct(product)}
                        className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 mb-4 cursor-pointer"
                      >
                        <span>Ver ficha técnica y notas de cata</span>
                        <span>&rarr;</span>
                      </button>

                      {/* PRECIO */}
                      <div className="pt-4 border-t border-slate-800 flex items-baseline justify-between">
                        <div>
                          <div className="text-2xl font-serif font-black text-amber-200">
                            ${product.price.toLocaleString("es-MX")}{" "}
                            <span className="text-xs font-sans font-normal text-slate-400">MXN</span>
                          </div>
                          {product.originalPrice && (
                            <div className="text-xs text-slate-500 line-through">
                              ${product.originalPrice.toLocaleString("es-MX")} MXN
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-medium">
                          ✓ En Existencia
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ACTION CONTROLS */}
                  <div className="p-6 pt-0 space-y-3">
                    <div className="flex items-center gap-2">
                      {/* STEPPER */}
                      <div className="flex items-center bg-[#090a0f] border border-slate-700 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setItemQuantity(product.id, qty - 1)}
                          className="px-3 py-2 text-slate-300 hover:bg-slate-800 text-sm font-bold cursor-pointer transition"
                        >
                          -
                        </button>
                        <span className="px-3 py-2 text-xs font-bold text-amber-200 w-8 text-center">
                          {qty}
                        </span>
                        <button
                          onClick={() => setItemQuantity(product.id, qty + 1)}
                          className="px-3 py-2 text-slate-300 hover:bg-slate-800 text-sm font-bold cursor-pointer transition"
                        >
                          +
                        </button>
                      </div>

                      {/* AGREGAR AL CARRITO */}
                      <button
                        onClick={() => addToCart(product, qty)}
                        className="flex-1 py-2 px-3 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition cursor-pointer"
                      >
                        + Agregar a Orden
                      </button>
                    </div>

                    {/* BOTÓN DIRECTO COMPRAR POR WHATSAPP */}
                    <a
                      href={singleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md shadow-emerald-900/20"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.585 1.961.904 2.8.904h.005c3.18 0 5.768-2.586 5.768-5.766 0-3.18-2.588-5.791-5.777-5.791zm3.36 8.163c-.144.405-.837.774-1.17.822-.312.043-.734.076-2.378-.604-1.979-.817-3.238-2.827-3.337-2.96-.099-.133-.798-1.059-.798-2.02 0-.962.503-1.436.682-1.634.18-.198.394-.247.525-.247.13 0 .261.002.373.007.119.006.279-.046.435.33.161.385.551 1.341.599 1.44.048.099.08.214.015.345-.065.132-.098.214-.196.33-.099.115-.207.256-.296.345-.1.099-.204.207-.088.406.116.198.514.848 1.103 1.372.759.675 1.4.884 1.599.983.199.099.314.083.431-.05.116-.133.498-.58.631-.779.133-.198.266-.165.449-.099.183.066 1.157.545 1.356.644.199.099.331.149.38.232.049.083.049.48-.095.885z" />
                      </svg>
                      <span>Comprar {qty > 1 ? `(${qty}) ` : ""}por WhatsApp</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECCIÓN SISTEMA DE ENVÍO Y PAQUETERÍA (REQUISITO PAQUETERÍAS) */}
      <section id="envios" className="py-16 bg-[#0f1118] border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
              Logística Certificada para Líquidos y Vidrio
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-black text-amber-50">
              Sistema de Envíos Nacionales
            </h2>
            <p className="text-sm text-slate-300 mt-3 leading-relaxed">
              En Destiladora del Norte contamos con un protocolo homologado de paquetería para garantizar que cada botella de tequila y licor llegue intacta a tu puerta.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[#141622] border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg mb-4">
                1
              </div>
              <h3 className="text-base font-bold text-amber-100 mb-2">
                Embalaje Especializado
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Cada botella se resguarda individualmente en bolsas de aire inflables termo-selladas y cajas de cartón corrugado de alta resistencia con separadores internos.
              </p>
            </div>

            <div className="bg-[#141622] border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg mb-4">
                2
              </div>
              <h3 className="text-base font-bold text-amber-100 mb-2">
                Paqueterías Certificadas
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Alianzas comerciales con guías aseguradas de paqueterías líderes (FedEx, Estafeta, DHL, Paquetexpress y Redpack) con recolección directa en planta.
              </p>
            </div>

            <div className="bg-[#141622] border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg mb-4">
                3
              </div>
              <h3 className="text-base font-bold text-amber-100 mb-2">
                Rastreo y Guía Inmediata
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Al procesar tu pedido, te enviamos la guía con número de rastreo directo a tu WhatsApp para que monitorees el paquete hasta su recepción.
              </p>
            </div>

            <div className="bg-[#141622] border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-lg mb-4">
                4
              </div>
              <h3 className="text-base font-bold text-amber-100 mb-2">
                Seguro de Rotura 100%
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Garantía total de reposición: si por alguna maniobra de traslado una botella sufre cualquier daño, te la reponemos de inmediato sin costo adicional.
              </p>
            </div>
          </div>

          {/* TABLA DE COSTOS ESTIMADOS DE ENVÍO */}
          <div className="mt-12 bg-[#141622] border border-slate-800 rounded-2xl p-6 sm:p-8">
            <h3 className="text-lg font-serif font-bold text-amber-200 mb-4">
              Tarifas y Tiempos Estimados de Entrega (Territorio Nacional)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="pb-3 font-semibold">Modalidad</th>
                    <th className="pb-3 font-semibold">Tiempo Estimado</th>
                    <th className="pb-3 font-semibold">Embalaje Incluido</th>
                    <th className="pb-3 font-semibold text-right">Costo Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  <tr>
                    <td className="py-3 font-bold text-amber-100">Paquetería Estándar Terrestre</td>
                    <td className="py-3 text-slate-300">3 a 5 días hábiles</td>
                    <td className="py-3 text-slate-400">Caja sellada + funda inflable</td>
                    <td className="py-3 text-right font-bold text-emerald-400">
                      $180 MXN <span className="text-slate-400 font-normal">(Gratis en compras &gt; $2,500)</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-amber-100">Paquetería Express Prioritaria</td>
                    <td className="py-3 text-slate-300">24 a 48 horas hábiles</td>
                    <td className="py-3 text-slate-400">Caja sellada + funda inflable alta densidad</td>
                    <td className="py-3 text-right font-bold text-amber-300">$260 MXN</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-amber-100">Envío de Cajas Mayoreo (12+ botellas)</td>
                    <td className="py-3 text-slate-300">3 a 5 días hábiles</td>
                    <td className="py-3 text-slate-400">Caja industrial reforzada con separadores</td>
                    <td className="py-3 text-right font-bold text-emerald-400">GRATIS (Flete cubierto)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* NUESTRA DESTILERÍA */}
      <section id="destileria" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
              Origen y Herencia
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-black text-amber-50 mb-6 leading-tight">
              Destiladora del Norte <br />
              <span className="text-amber-400">El Corazón Tequilero de Colotlán</span>
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Ubicados en la región norte del estado de Jalisco, en Destiladora del Norte combinamos el respeto por los métodos tradicionales tequileros con estándares de pureza rigurosos.
            </p>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              Cada gota de <strong>Tequila El Colotlense</strong> proviene de agaves madurados pacientemente entre 6 y 8 años bajo el sol de Jalisco. La cocción en hornos de mampostería, la fermentación natural lenta y la doble destilación en alambiques de cobre otorgan ese perfil limpio, aromático y untuoso que nos caracteriza.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
              <div>
                <div className="text-2xl font-serif font-black text-amber-400">Colotlán</div>
                <div className="text-xs text-slate-400">Jalisco, México · Tierra de Tradición</div>
              </div>
              <div>
                <div className="text-2xl font-serif font-black text-amber-400">100%</div>
                <div className="text-xs text-slate-400">Agave Azul Weber Certificado</div>
              </div>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-amber-500/30 bg-[#12141d] p-8 shadow-2xl">
            <div className="text-center py-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center font-serif text-3xl font-black text-slate-950 shadow-xl shadow-amber-500/20">
                DN
              </div>
              <h3 className="text-xl font-serif font-bold text-amber-100 mb-1">
                Destiladora del Norte S.A. de C.V.
              </h3>
              <p className="text-xs text-amber-300/80 mb-6 font-mono">
                Punto de Venta Autorizado · Planta &amp; Distribución
              </p>
              <div className="text-left space-y-3 text-xs text-slate-300 max-w-sm mx-auto bg-black/40 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">📍</span>
                  <span>{STORE_ADDRESS}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">📱</span>
                  <span>WhatsApp de Ventas: {STORE_PHONE}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">✉️</span>
                  <span>{STORE_EMAIL}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">⏱️</span>
                  <span>Lunes a Sábado: 9:00 AM – 7:00 PM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PREGUNTAS FRECUENTES (FAQ) */}
      <section id="faq" className="py-16 bg-[#0c0d14] border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
              Dudas y Compras
            </div>
            <h2 className="text-3xl font-serif font-black text-amber-50">
              Preguntas Frecuentes
            </h2>
          </div>

          <div className="space-y-4">
            <div className="bg-[#141622] border border-slate-800 p-5 rounded-xl">
              <h3 className="font-bold text-amber-200 text-sm mb-2">
                ¿Cómo funciona el proceso de compra por WhatsApp?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Seleccionas las botellas que deseas en esta tienda online o agregas al carrito, y al hacer clic en &ldquo;Comprar por WhatsApp&rdquo; se genera un mensaje detallado con tus productos. Nuestro equipo de ventas te responde de inmediato para confirmarte existencias, verificar tu dirección y proporcionarte los datos de pago bancario (SPEI o tarjeta).
              </p>
            </div>

            <div className="bg-[#141622] border border-slate-800 p-5 rounded-xl">
              <h3 className="font-bold text-amber-200 text-sm mb-2">
                ¿Qué métodos de pago aceptan?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Aceptamos transferencias electrónicas interbancarias (SPEI), depósito en practicajas u OXXO, y enlaces de pago seguro con tarjeta de crédito/débito. Si requieres factura fiscal (CFDI), te la emitimos sin costo adicional al compartirnos tu Constancia de Situación Fiscal.
              </p>
            </div>

            <div className="bg-[#141622] border border-slate-800 p-5 rounded-xl">
              <h3 className="font-bold text-amber-200 text-sm mb-2">
                ¿Cómo protegen las botellas de vidrio durante el envío?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Utilizamos embalaje certificado de grado logístico para botellas de licor: fundas de bolsas de aire neumáticas de alta resistencia que absorben cualquier golpe o vibración durante el transporte, además de cajas selladas con cinta de seguridad. Todas nuestras órdenes cuentan con seguro de reposición contra roturas.
              </p>
            </div>

            <div className="bg-[#141622] border border-slate-800 p-5 rounded-xl">
              <h3 className="font-bold text-amber-200 text-sm mb-2">
                ¿Tienen precios especiales para eventos, bodas o mayoreo?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sí. Contamos con paquetes por caja cerrada de 12 botellas con descuento mayorista y flete gratis a cualquier parte de la República. También ofrecemos servicio completo de barra móvil y cócteles a través de nuestra división hermana Tequilitros Eventos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#06070a] border-t border-slate-800/80 py-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-serif font-black text-slate-950 text-base">
                  DN
                </div>
                <span className="font-serif font-bold text-amber-100 text-sm tracking-wide">
                  DESTILADORA DEL NORTE
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed mb-3">
                Tequila El Colotlense y licores artesanales elaborados con pasión, tradición y 100% de agave en Colotlán, Jalisco.
              </p>
              <div className="text-[11px] text-amber-300/80">
                Punto de Venta Oficial en Línea
              </div>
            </div>

            <div>
              <div className="font-bold text-amber-200 text-xs uppercase tracking-wider mb-3">
                Catálogo Directo
              </div>
              <ul className="space-y-1.5 text-[11px]">
                <li><a href="#catalogo" className="hover:text-amber-400 transition">Tequila El Colotlense Blanco</a></li>
                <li><a href="#catalogo" className="hover:text-amber-400 transition">Tequila El Colotlense Reposado</a></li>
                <li><a href="#catalogo" className="hover:text-amber-400 transition">Tequila El Colotlense Añejo</a></li>
                <li><a href="#catalogo" className="hover:text-amber-400 transition">Licor Artesanal de Zarzamora</a></li>
                <li><a href="#catalogo" className="hover:text-amber-400 transition">Packs de Degustación y Mayoreo</a></li>
              </ul>
            </div>

            <div>
              <div className="font-bold text-amber-200 text-xs uppercase tracking-wider mb-3">
                Políticas y Paquetería
              </div>
              <ul className="space-y-1.5 text-[11px]">
                <li><a href="#envios" className="hover:text-amber-400 transition">Proceso de Empaque y Envío</a></li>
                <li><Link href="/terms-of-service" className="hover:text-amber-400 transition">Términos de Servicio y Venta</Link></li>
                <li><Link href="/privacy-policy" className="hover:text-amber-400 transition">Aviso de Privacidad</Link></li>
                <li><Link href="/support" className="hover:text-amber-400 transition">Soporte y Atención al Cliente</Link></li>
              </ul>
            </div>

            <div>
              <div className="font-bold text-amber-200 text-xs uppercase tracking-wider mb-3">
                Contacto Directo
              </div>
              <div className="space-y-2 text-[11px]">
                <div>WhatsApp: <a href={`https://wa.me/${STORE_PHONE_CLEAN}`} className="text-amber-400 font-bold hover:underline">{STORE_PHONE}</a></div>
                <div>Correo: {STORE_EMAIL}</div>
                <div>Ubicación: {STORE_ADDRESS}</div>
                <div className="pt-2 text-emerald-400 font-semibold">
                  ● Horario de Atención: Lunes a Sábado 9:00 - 19:00 hrs
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800/80 text-center text-[11px] text-slate-400 space-y-2">
            <p className="font-bold text-slate-300">
              EL ABUSO EN EL CONSUMO DE ESTE PRODUCTO ES NOCIVO PARA LA SALUD. PROHIBIDA LA VENTA A MENORES DE 18 AÑOS.
            </p>
            <p>
              &copy; {new Date().getFullYear()} Destiladora del Norte S.A. de C.V. &middot; Tequila El Colotlense. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>

      {/* DRAWER / MODAL DEL CARRITO Y COTIZADOR DE ENVÍO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-[#11131c] border-l border-slate-800 h-full flex flex-col justify-between shadow-2xl p-6 overflow-y-auto">
            <div>
              {/* HEADER DEL CARRITO */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    🛒
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-lg text-amber-100">
                      Tu Pedido de Tequila
                    </h3>
                    <div className="text-[11px] text-slate-400">
                      {totalBottles} botella(s) seleccionada(s)
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* LISTA DE PRODUCTOS EN EL CARRITO */}
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🍾</div>
                  <p className="text-sm text-slate-400 mb-4">Aún no has agregado botellas a tu orden.</p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Explorar Catálogo
                  </button>
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between gap-3 p-3 bg-[#161824] rounded-xl border border-slate-800"
                    >
                      <div className="relative w-12 h-16 rounded-lg bg-[#0a0a0f] overflow-hidden flex-shrink-0">
                        <Image
                          src={item.product.image}
                          alt={item.product.name}
                          fill
                          className="object-contain p-1"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-xs text-amber-100 truncate">
                          {item.product.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          ${item.product.price.toLocaleString("es-MX")} MXN &middot; {item.product.volume}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                            className="w-5 h-5 rounded bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold text-amber-300 px-1">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                            className="w-5 h-5 rounded bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-xs text-amber-200">
                          ${(item.product.price * item.quantity).toLocaleString("es-MX")} MXN
                        </div>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, 0)}
                          className="text-[11px] text-red-400 hover:text-red-300 mt-1 cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* COTIZADOR DE ENVÍO Y DATOS DE ENTREGA */}
              {cart.length > 0 && (
                <div className="p-4 bg-[#161824] border border-slate-800 rounded-xl space-y-4 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-200 uppercase tracking-wider">
                      Datos de Envío para Paquetería
                    </span>
                    {isFreeShipping && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                        ¡Envío Estándar Gratis!
                      </span>
                    )}
                  </div>

                  {/* SELECCIÓN DE MODALIDAD DE ENVÍO */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => setShippingType("standard")}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition ${
                        shippingType === "standard"
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-200"
                          : "bg-slate-900 border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="font-bold">Estándar (3-5 días)</div>
                      <div className="text-[11px] text-slate-400">
                        {isFreeShipping ? "GRATIS" : "$180 MXN"}
                      </div>
                    </button>

                    <button
                      onClick={() => setShippingType("express")}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition ${
                        shippingType === "express"
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-200"
                          : "bg-slate-900 border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="font-bold">Express (24-48 hrs)</div>
                      <div className="text-[11px] text-slate-400">
                        {isFreeShipping ? "$120 MXN" : "$260 MXN"}
                      </div>
                    </button>
                  </div>

                  {/* FORMULARIO RÁPIDO */}
                  <div className="space-y-2 text-xs">
                    <input
                      type="text"
                      placeholder="Nombre de quien recibe"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full p-2 bg-[#0d0e15] border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Código Postal (C.P.)"
                        value={customerZip}
                        onChange={(e) => setCustomerZip(e.target.value)}
                        className="w-full p-2 bg-[#0d0e15] border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                      <input
                        type="text"
                        placeholder="Ciudad / Estado"
                        value={customerCity}
                        onChange={(e) => setCustomerCity(e.target.value)}
                        className="w-full p-2 bg-[#0d0e15] border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Calle, número y colonia"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full p-2 bg-[#0d0e15] border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* TOTALES Y ACCIÓN FINAL */}
            {cart.length > 0 && (
              <div className="pt-4 border-t border-slate-800 space-y-4">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal botellas:</span>
                    <span className="text-slate-200 font-semibold">
                      ${cartSubtotal.toLocaleString("es-MX")} MXN
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Costo de envío paquetería:</span>
                    <span className="text-slate-200 font-semibold">
                      {shippingCost === 0 ? "GRATIS" : `$${shippingCost.toLocaleString("es-MX")} MXN`}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-amber-200 pt-2 border-t border-slate-800">
                    <span>Total a pagar:</span>
                    <span>${orderTotal.toLocaleString("es-MX")} MXN</span>
                  </div>
                </div>

                <a
                  href={buildCartWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-xl shadow-emerald-900/30"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.585 1.961.904 2.8.904h.005c3.18 0 5.768-2.586 5.768-5.766 0-3.18-2.588-5.791-5.777-5.791zm3.36 8.163c-.144.405-.837.774-1.17.822-.312.043-.734.076-2.378-.604-1.979-.817-3.238-2.827-3.337-2.96-.099-.133-.798-1.059-.798-2.02 0-.962.503-1.436.682-1.634.18-.198.394-.247.525-.247.13 0 .261.002.373.007.119.006.279-.046.435.33.161.385.551 1.341.599 1.44.048.099.08.214.015.345-.065.132-.098.214-.196.33-.099.115-.207.256-.296.345-.1.099-.204.207-.088.406.116.198.514.848 1.103 1.372.759.675 1.4.884 1.599.983.199.099.314.083.431-.05.116-.133.498-.58.631-.779.133-.198.266-.165.449-.099.183.066 1.157.545 1.356.644.199.099.331.149.38.232.049.083.049.48-.095.885z" />
                  </svg>
                  <span>Enviar Orden por WhatsApp</span>
                </a>

                <div className="text-[11px] text-center text-slate-400">
                  🔒 No se realiza cargo automático. Se genera la orden y acuerdas pago seguro con la destilería.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DETALLES DE FICHA TÉCNICA */}
      {activeModalProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141622] border border-amber-500/40 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setActiveModalProduct(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>

            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start mb-6">
              <div className="relative w-36 h-48 sm:w-44 sm:h-60 bg-[#090a0f] rounded-xl overflow-hidden flex-shrink-0 p-2">
                <Image
                  src={activeModalProduct.image}
                  alt={activeModalProduct.name}
                  fill
                  className="object-contain p-2"
                />
              </div>

              <div className="flex-1 text-center sm:text-left">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                  {activeModalProduct.category} {activeModalProduct.alcoholVol && `· ${activeModalProduct.alcoholVol}`}
                </div>
                <h3 className="text-2xl font-serif font-black text-amber-100 mb-2">
                  {activeModalProduct.name}
                </h3>
                <div className="text-xl font-serif font-bold text-amber-300 mb-4">
                  ${activeModalProduct.price.toLocaleString("es-MX")}{" "}
                  <span className="text-xs font-sans text-slate-400">MXN / {activeModalProduct.volume}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                  {activeModalProduct.description}
                </p>
              </div>
            </div>

            {/* NOTAS DE CATA */}
            {activeModalProduct.tastingNotes && (
              <div className="bg-[#0b0c12] p-4 rounded-xl border border-slate-800 mb-6 space-y-2 text-xs">
                <div className="font-bold text-amber-300 uppercase tracking-wider text-[11px] mb-2">
                  Notas de Cata del Maestro Destilador
                </div>
                {activeModalProduct.tastingNotes.aroma && (
                  <div>
                    <strong className="text-amber-100">Aroma:</strong>{" "}
                    <span className="text-slate-300">{activeModalProduct.tastingNotes.aroma}</span>
                  </div>
                )}
                {activeModalProduct.tastingNotes.taste && (
                  <div>
                    <strong className="text-amber-100">Paladar:</strong>{" "}
                    <span className="text-slate-300">{activeModalProduct.tastingNotes.taste}</span>
                  </div>
                )}
                {activeModalProduct.tastingNotes.finish && (
                  <div>
                    <strong className="text-amber-100">Final:</strong>{" "}
                    <span className="text-slate-300">{activeModalProduct.tastingNotes.finish}</span>
                  </div>
                )}
              </div>
            )}

            {/* ESPECIFICACIONES */}
            <div className="space-y-1.5 mb-6 text-xs text-slate-300">
              {activeModalProduct.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-amber-400">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  addToCart(activeModalProduct, 1);
                  setActiveModalProduct(null);
                }}
                className="flex-1 py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Agregar a Mi Pedido
              </button>
              <a
                href={buildSingleProductWhatsAppUrl(activeModalProduct)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
              >
                <span>Comprar Directo por WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
