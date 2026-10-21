"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Image from "next/image";

export type DrinkFlavor = {
  id: string;
  name: string;
  subtitle: string;
  liquidColor: number;
  frostColor: number;
  frostType: "sal_chile" | "sal_fina" | "chamoy_tajin";
  description: string;
  photoUrl: string;
};

export const DRINK_FLAVORS: DrinkFlavor[] = [
  {
    id: "cantarito",
    name: "Cantarito",
    subtitle: "Cítricos, tequila blanco y escarchado",
    liquidColor: 0xe59424,
    frostColor: 0xc84224,
    frostType: "sal_chile",
    description: "Naranja, toronja y limón con tequila blanco, refresco de toronja y escarchado. La receta se confirma por evento.",
    photoUrl: "/tequilitros/productos/cantarito.png",
  },
  {
    id: "paloma",
    name: "Paloma",
    subtitle: "Toronja, limón y tequila reposado",
    liquidColor: 0xe89785,
    frostColor: 0xf5f0ea,
    frostType: "sal_fina",
    description: "Toronja, limón, tequila reposado y escarchado. La receta se confirma por evento.",
    photoUrl: "/tequilitros/productos/paloma.png",
  },
  {
    id: "vampiro",
    name: "Vampiro",
    subtitle: "Sangrita, cítricos y tequila",
    liquidColor: 0x8a181b,
    frostColor: 0xb52c1b,
    frostType: "sal_chile",
    description: "Sangrita, cítricos, tequila blanco y sal. La receta se confirma por evento.",
    photoUrl: "/tequilitros/productos/vampiro.png",
  },
  {
    id: "tequimango",
    name: "Tequimango",
    subtitle: "Mango fresco y toque agridulce",
    liquidColor: 0xe6a817,
    frostColor: 0x9b2418,
    frostType: "chamoy_tajin",
    description: "Mango, licor de mango, tequila y escarchado. La receta se confirma por evento.",
    photoUrl: "/tequilitros/tequimango.jpg",
  },
  {
    id: "tequimora",
    name: "Tequimora",
    subtitle: "Zarzamora, cítricos y tequila",
    liquidColor: 0x5a1838,
    frostColor: 0xe0d4cb,
    frostType: "sal_fina",
    description: "Zarzamora macerada con tequila blanco y cítricos. La receta se confirma por evento.",
    photoUrl: "/tequilitros/productos/tequimora.png",
  },
  {
    id: "tequimiche",
    name: "Tequimiche",
    subtitle: "Salsas negras y mezcla michelada",
    liquidColor: 0x542b14,
    frostColor: 0xb8381d,
    frostType: "sal_chile",
    description: "Salsas sazonadoras, limón y escarchado. La receta se confirma por evento.",
    photoUrl: "/tequilitros/productos/tequimiche.png",
  },
];

function createLabelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo sutil del sticker
    ctx.fillStyle = "rgba(18, 14, 12, 0.94)";
    ctx.beginPath();
    ctx.roundRect(140, 60, 744, 392, 40);
    ctx.fill();

    // Borde doble dorado
    ctx.strokeStyle = "#D4AF37";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(154, 74, 716, 364, 32);
    ctx.stroke();

    ctx.strokeStyle = "rgba(226, 135, 53, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(166, 86, 692, 340, 26);
    ctx.stroke();

    // Sello superior
    ctx.fillStyle = "#E28735";
    ctx.font = "bold 44px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("✳", 512, 140);

    // Marca TEQUILITROS
    ctx.fillStyle = "#F5F2EB";
    ctx.font = "900 68px Arial, sans-serif";
    ctx.letterSpacing = "6px";
    ctx.fillText("TEQUILITROS", 512, 225);

    // Subtítulo
    ctx.fillStyle = "#D4AF37";
    ctx.font = "bold 26px Georgia, serif";
    ctx.letterSpacing = "4px";
    ctx.fillText("DESTILADORA DEL NORTE", 512, 275);

    // Línea separadora
    ctx.strokeStyle = "#E28735";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(320, 305);
    ctx.lineTo(704, 305);
    ctx.stroke();

    // Origen y especificación
    ctx.fillStyle = "#A8B4BC";
    ctx.font = "600 20px monospace";
    ctx.letterSpacing = "3px";
    ctx.fillText("COLOTLÁN, JALISCO", 512, 345);

    ctx.fillStyle = "#F5F2EB";
    ctx.font = "bold 24px monospace";
    ctx.letterSpacing = "2px";
    ctx.fillText("VASO 946 ML · REYMA 32 EU", 512, 395);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function TequilitrosCup3D({
  selectedDrinkId,
  onSelectDrink,
}: {
  selectedDrinkId?: string;
  onSelectDrink?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalDrinkId, setInternalDrinkId] = useState(DRINK_FLAVORS[0].id);
  const activeDrink =
    DRINK_FLAVORS.find((drink) => drink.id === selectedDrinkId) ??
    DRINK_FLAVORS.find((drink) => drink.id === internalDrinkId) ??
    DRINK_FLAVORS[0];
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Comprobar soporte WebGL
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
      if (!gl) {
        startTransition(() => setWebglSupported(false));
        return;
      }
    } catch {
      startTransition(() => setWebglSupported(false));
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight || 520;

    // Escena, cámara y renderizador
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 4.3);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // Iluminación de estudio
    const ambientLight = new THREE.AmbientLight(0xfff6ea, 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffe2b8, 2.4);
    keyLight.position.set(3, 4, 3);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7aa5c2, 1.2);
    fillLight.position.set(-3, 2, -2);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xffaa44, 3.2, 10);
    rimLight.position.set(0, 2.5, -2.5);
    scene.add(rimLight);

    // Grupo principal para rotación
    const cupGroup = new THREE.Group();
    scene.add(cupGroup);

    // 1. Geometría fiel del Vaso Reyma 32 EU (18cm alto, 10.6cm sup, 6.4cm inf)
    // Coordenadas normalizadas: h = 1.8 (y entre -0.9 y 0.9)
    const cupPoints: THREE.Vector2[] = [];
    cupPoints.push(new THREE.Vector2(0, -0.9));
    cupPoints.push(new THREE.Vector2(0.28, -0.9));
    cupPoints.push(new THREE.Vector2(0.32, -0.87)); // Base biselada

    // Cuerpo con estrías de termoformado Reyma
    cupPoints.push(new THREE.Vector2(0.36, -0.42));
    cupPoints.push(new THREE.Vector2(0.38, -0.40));
    cupPoints.push(new THREE.Vector2(0.375, -0.38));

    cupPoints.push(new THREE.Vector2(0.42, 0.16));
    cupPoints.push(new THREE.Vector2(0.44, 0.18));
    cupPoints.push(new THREE.Vector2(0.435, 0.20));

    cupPoints.push(new THREE.Vector2(0.48, 0.58));
    cupPoints.push(new THREE.Vector2(0.50, 0.60));
    cupPoints.push(new THREE.Vector2(0.495, 0.62));

    // Labio superior curvado
    cupPoints.push(new THREE.Vector2(0.525, 0.86));
    cupPoints.push(new THREE.Vector2(0.54, 0.885));
    cupPoints.push(new THREE.Vector2(0.542, 0.90));
    cupPoints.push(new THREE.Vector2(0.528, 0.90));

    const cupGeometry = new THREE.LatheGeometry(cupPoints, 52);
    const cupMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.84,
      opacity: 0.95,
      transparent: true,
      roughness: 0.24,
      ior: 1.49,
      thickness: 0.22,
      specularIntensity: 1.2,
      side: THREE.DoubleSide,
    });
    const cupMesh = new THREE.Mesh(cupGeometry, cupMaterial);
    cupGroup.add(cupMesh);

    // 2. Líquido dinámico interior
    const liquidGeometry = new THREE.CylinderGeometry(0.495, 0.295, 1.55, 40);
    const liquidMaterial = new THREE.MeshPhysicalMaterial({
      color: DRINK_FLAVORS[0].liquidColor,
      transmission: 0.72,
      opacity: 0.96,
      transparent: true,
      roughness: 0.12,
      ior: 1.33,
    });
    const liquidMesh = new THREE.Mesh(liquidGeometry, liquidMaterial);
    liquidMesh.position.y = -0.09;
    cupGroup.add(liquidMesh);

    // 3. Cubos de hielo flotantes
    const iceGroup = new THREE.Group();
    const iceGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.92,
      opacity: 0.88,
      transparent: true,
      roughness: 0.08,
      ior: 1.31,
    });

    const icePositions = [
      { x: -0.12, y: 0.54, z: 0.1, r: [0.3, 0.4, 0.1] },
      { x: 0.14, y: 0.52, z: -0.08, r: [0.1, 0.7, 0.5] },
      { x: 0.02, y: 0.62, z: 0.06, r: [0.6, 0.2, 0.4] },
      { x: -0.05, y: 0.42, z: -0.12, r: [0.4, 0.1, 0.8] },
    ];

    icePositions.forEach((pos) => {
      const ice = new THREE.Mesh(iceGeo, iceMat);
      ice.position.set(pos.x, pos.y, pos.z);
      ice.rotation.set(pos.r[0], pos.r[1], pos.r[2]);
      iceGroup.add(ice);
    });
    cupGroup.add(iceGroup);

    // 4. Escarchado (Rim Frosting de sal de grano y chile)
    const frostGeometry = new THREE.TorusGeometry(0.536, 0.024, 12, 52);
    const frostMaterial = new THREE.MeshStandardMaterial({
      color: DRINK_FLAVORS[0].frostColor,
      roughness: 0.92,
      metalness: 0.05,
    });
    const frostMesh = new THREE.Mesh(frostGeometry, frostMaterial);
    frostMesh.rotation.x = Math.PI / 2;
    frostMesh.position.y = 0.902;
    cupGroup.add(frostMesh);

    // 5. Etiqueta frontal original
    const labelTexture = createLabelTexture();
    const labelGeo = new THREE.CylinderGeometry(
      0.442,
      0.395,
      0.54,
      36,
      1,
      true,
      -Math.PI / 4,
      Math.PI / 2
    );
    const labelMat = new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.y = 0.05;
    cupGroup.add(labelMesh);

    // Inclinación inicial estética
    cupGroup.rotation.x = 0.18;
    cupGroup.rotation.y = -0.3;

    // Manejo de interacción de arrastre (touch y mouse)
    let isDragging = false;
    let previousMouseX = 0;
    let autoRotate = true;

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      autoRotate = false;
      previousMouseX = e.clientX;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMouseX;
      cupGroup.rotation.y += deltaX * 0.008;
      previousMouseX = e.clientX;
    };

    const handlePointerUp = () => {
      isDragging = false;
      setTimeout(() => {
        if (!isDragging) autoRotate = true;
      }, 2500);
    };

    const domElement = renderer.domElement;
    domElement.style.touchAction = "none";
    domElement.style.cursor = "grab";

    domElement.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    // Render loop con IntersectionObserver para cuidar la batería y CPU
    let animationFrameId: number;
    let isVisible = true;

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    }, { threshold: 0.1 });
    observer.observe(container);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isVisible) return;

      if (autoRotate) {
        cupGroup.rotation.y += 0.004;
      }

      // Animación suave de los hielos
      iceGroup.rotation.y = Math.sin(Date.now() * 0.001) * 0.04;

      renderer.render(scene, camera);
    };
    animate();

    // Redimensionado responsivo
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight || 520;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener("resize", handleResize);

    // Guardar referencia para actualizar color del líquido
    (container as unknown as { _updateLiquid?: (d: DrinkFlavor) => void })._updateLiquid = (
      drink: DrinkFlavor
    ) => {
      liquidMaterial.color.setHex(drink.liquidColor);
      frostMaterial.color.setHex(drink.frostColor);
    };

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      domElement.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);

      cupGeometry.dispose();
      cupMaterial.dispose();
      liquidGeometry.dispose();
      liquidMaterial.dispose();
      iceGeo.dispose();
      iceMat.dispose();
      frostGeometry.dispose();
      frostMaterial.dispose();
      labelGeo.dispose();
      labelMat.dispose();
      labelTexture.dispose();
      renderer.dispose();

      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }
    };
  }, [webglSupported]);

  // Actualizar material cuando cambie la bebida
  useEffect(() => {
    const container = containerRef.current as unknown as {
      _updateLiquid?: (d: DrinkFlavor) => void;
    };
    if (container?._updateLiquid) {
      container._updateLiquid(activeDrink);
    }
  }, [activeDrink]);

  const selectDrink = (drink: DrinkFlavor) => {
    setInternalDrinkId(drink.id);
    onSelectDrink?.(drink.id);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[#2A343D] bg-[#0E1318]/90 p-4 sm:p-8 backdrop-blur-xl">
      {/* Encabezado y Medidas de Ingeniería */}
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-[#242E37] pb-6 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-[#E28735]">
              Especificación Técnica 3D · 946 ml
            </span>
            <span className="inline-flex h-2 w-2 rounded-full bg-[#30D158] animate-pulse" />
          </div>
          <h3 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#F5F2EB] sm:text-3xl">
            Vaso Reyma 32 EU
          </h3>
          <p className="mt-1 text-xs text-[#9AA5AC] sm:text-sm">
            Capacidad nominal de 946 ml. La presentación se confirma para cada evento.
          </p>
        </div>

        {/* Ficha de medidas reales */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="rounded-lg border border-[#242E37] bg-[#141B22] px-3 py-1.5 text-center">
            <p className="font-mono text-[10px] uppercase text-[#9AA5AC]">Altura</p>
            <p className="font-mono text-xs font-bold text-[#F5F2EB]">18.0 cm</p>
          </div>
          <div className="rounded-lg border border-[#242E37] bg-[#141B22] px-3 py-1.5 text-center">
            <p className="font-mono text-[10px] uppercase text-[#9AA5AC]">Ø Superior</p>
            <p className="font-mono text-xs font-bold text-[#F5F2EB]">10.6 cm</p>
          </div>
          <div className="rounded-lg border border-[#242E37] bg-[#141B22] px-3 py-1.5 text-center">
            <p className="font-mono text-[10px] uppercase text-[#9AA5AC]">Ø Inferior</p>
            <p className="font-mono text-xs font-bold text-[#F5F2EB]">6.4 cm</p>
          </div>
          <div className="rounded-lg border border-[#E28735]/30 bg-[#E28735]/10 px-3 py-1.5 text-center">
            <p className="font-mono text-[10px] uppercase text-[#E28735]">Capacidad</p>
            <p className="font-mono text-xs font-bold text-[#F5F2EB]">946 ml (32 oz)</p>
          </div>
        </div>
      </div>

      {/* Área del Canvas 3D / Fallback */}
      <div className="relative min-h-[440px] sm:min-h-[500px] w-full">
        {webglSupported ? (
          <>
            <div
              ref={containerRef}
              className="h-[440px] sm:h-[500px] w-full select-none cursor-grab active:cursor-grabbing"
            />
            {/* Indicador de interacción 360 */}
            <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-[#2A343D] bg-[#0E1318]/80 px-3 py-1 text-[11px] font-mono text-[#9AA5AC] backdrop-blur">
              <span>↻ Arrastra para girar 360°</span>
            </div>
          </>
        ) : (
          /* Fallback visual 2.5D optimizado con fotografía real de alta resolución */
          <div className="flex h-[440px] sm:h-[500px] w-full items-center justify-center p-6 text-center">
            <div className="relative h-full w-full max-w-md overflow-hidden rounded-xl border border-[#2A343D] bg-[radial-gradient(circle_at_50%_30%,rgba(226,135,53,0.28),transparent_40%),linear-gradient(145deg,#1B242C_0%,#0B1014_58%,#17100D_100%)]">
              <Image
                src={activeDrink.photoUrl}
                alt={activeDrink.name}
                fill
                className="object-contain p-6 drop-shadow-2xl"
                sizes="(max-width: 768px) 100vw, 450px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080B0E] via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-left">
                <span className="font-mono text-[10px] uppercase text-[#E28735]">
                  Vista de Producto Real
                </span>
                <h4 className="text-xl font-bold text-[#F5F2EB]">{activeDrink.name}</h4>
                <p className="text-xs text-[#9AA5AC]">{activeDrink.description}</p>
              </div>
            </div>
          </div>
        )}
        {webglSupported && (
          <div className="pointer-events-none absolute right-4 top-4 hidden h-40 w-28 overflow-hidden rounded-xl border border-[#D4AF37]/25 bg-[#080B0E]/65 p-1.5 shadow-2xl backdrop-blur-md sm:block">
            <Image
              src={activeDrink.photoUrl}
              alt=""
              fill
              sizes="112px"
              className="object-contain p-1 drop-shadow-2xl"
            />
            <span className="absolute bottom-1.5 left-2 right-2 text-center font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-[#F5F2EB]/80">
              Referencia real
            </span>
          </div>
        )}
      </div>

      {/* Selector de Bebidas (Reactivo al Vaso 3D) */}
      <div className="mt-6 border-t border-[#242E37] pt-6">
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-[#9AA5AC]">
          Selecciona una bebida para simular en el vaso:
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {DRINK_FLAVORS.map((drink) => {
            const isSelected = activeDrink.id === drink.id;
            return (
              <button
                key={drink.id}
                type="button"
                onClick={() => selectDrink(drink)}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all duration-200 ${
                  isSelected
                    ? "border-[#E28735] bg-[#E28735]/15 shadow-lg shadow-[#E28735]/10"
                    : "border-[#242E37] bg-[#141B22]/70 hover:border-[#3A4652] hover:bg-[#1A222B]"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className="h-3 w-3 rounded-full border border-white/20 shadow-sm"
                    style={{
                      backgroundColor: `#${drink.liquidColor.toString(16).padStart(6, "0")}`,
                    }}
                  />
                  {isSelected && (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[#E28735]">
                      Activo
                    </span>
                  )}
                </div>
                <span className="mt-2 text-sm font-bold text-[#F5F2EB]">{drink.name}</span>
                <span className="mt-0.5 line-clamp-1 text-[11px] text-[#9AA5AC]">
                  {drink.subtitle}
                </span>
              </button>
            );
          })}
        </div>

        {/* Ficha descriptiva de la bebida activa */}
        <div className="mt-4 rounded-xl border border-[#242E37] bg-[#141B22]/50 p-4">
          <p className="text-xs text-[#F5F2EB]/90 leading-relaxed sm:text-sm">
            <strong className="text-[#E28735]">{activeDrink.name}:</strong> {activeDrink.description}
          </p>
        </div>
      </div>
    </div>
  );
}
