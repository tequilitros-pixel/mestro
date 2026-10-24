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
  hasFrost: boolean;
  frostType: "tajin" | "sal" | "none";
  transmission: number;
  roughness: number;
  description: string;
  ingredients: string;
  photoUrl: string;
};

export const DRINK_FLAVORS: DrinkFlavor[] = [
  {
    id: "cantarito",
    name: "Cantarito",
    subtitle: "Cítricos, tequila blanco y escarchado Tajín",
    liquidColor: 0xf7961d, // Cítrico mandarina/naranja brillante
    frostColor: 0xb83818, // Escarchado rojo terracota chile-tajín
    hasFrost: true,
    frostType: "tajin",
    transmission: 0.68,
    roughness: 0.16,
    description: "Naranja, toronja y limón recién exprimidos con tequila blanco, refresco de toronja y escarchado abundante de sal con chile tajín.",
    ingredients: "Jugo de naranja, toronja y limón, tequila blanco de la casa, refresco de toronja y escarchado de sal y chile.",
    photoUrl: "/tequilitros/productos/cantarito.png",
  },
  {
    id: "paloma",
    name: "Paloma Tradicional",
    subtitle: "Toronja, limón, tequila reposado y sal de mar",
    liquidColor: 0xf0cfbe, // Tono translúcido rubor toronja / durazno escarchado
    frostColor: 0xfbfaf8, // Sal de grano fina blanca brillante
    hasFrost: true,
    frostType: "sal",
    transmission: 0.78,
    roughness: 0.18,
    description: "Toronja rosada, jugo de limón, tequila reposado y escarchado tradicional de sal fina de mar.",
    ingredients: "Toronja, limón fresco, tequila reposado de barrica, toque de sal marina y refresco de toronja.",
    photoUrl: "/tequilitros/productos/paloma.png",
  },
  {
    id: "vampiro",
    name: "Vampiro del Norte",
    subtitle: "Sangrita de la casa, cítricos y tequila blanco",
    liquidColor: 0xd83b16, // Rojo sangrita intenso / blood orange
    frostColor: 0x8c1b12, // Escarchado oscuro de chile y sal
    hasFrost: true,
    frostType: "tajin",
    transmission: 0.58,
    roughness: 0.15,
    description: "Sangrita tradicional de la casa con cítricos frescos, tequila blanco, hielo abundante y escarchado picante.",
    ingredients: "Sangrita especial de la casa, tequila blanco, jugo de limón, sal y refresco cítrico.",
    photoUrl: "/tequilitros/productos/vampiro.png",
  },
  {
    id: "tequimojito",
    name: "Tequimojito",
    subtitle: "Menta fresca, cítricos, tequila y toque turquesa",
    liquidColor: 0x0ebfae, // Turquesa eléctrico / menta cyan brillante
    frostColor: 0xffffff,
    hasFrost: false, // Borde liso limpio de plástico termoformado
    frostType: "none",
    transmission: 0.72,
    roughness: 0.12,
    description: "Menta fresca macerada con limón, tequila blanco, refresco lima-limón y toque cítrico color turquesa, servido a tope con hielo.",
    ingredients: "Hojas de menta natural, tequila blanco, jugo de limón recién exprimido, refresco de lima y jarabe cítrico turquesa.",
    photoUrl: "/tequilitros/productos/tequimojito.png",
  },
  {
    id: "tequimora",
    name: "Tequimora",
    subtitle: "Zarzamora silvestre, cítricos y tequila",
    liquidColor: 0x8a2884, // Morado zarzamora royal translúcido
    frostColor: 0xffffff,
    hasFrost: false, // Borde liso limpio con hielos sobresalientes
    frostType: "none",
    transmission: 0.62,
    roughness: 0.14,
    description: "Zarzamora macerada artesanalmente con tequila blanco, cítricos y jarabe natural, con hielo en cubos que sobresalen de la copa.",
    ingredients: "Zarzamora macerada natural, tequila blanco, limón fresco, jarabe y agua mineral gasificada.",
    photoUrl: "/tequilitros/productos/tequimora.png",
  },
  {
    id: "tequimiche",
    name: "Tequimiche",
    subtitle: "Salsas negras, limón, sazonadores y escarchado botanero",
    liquidColor: 0x481f10, // Ámbar oscuro / clamato-salsas sazonadoras
    frostColor: 0x9e2d14, // Chamoy y chile tajín abundante
    hasFrost: true,
    frostType: "tajin",
    transmission: 0.42,
    roughness: 0.22,
    description: "Mezcla de salsas sazonadoras negras estilo michelada, limón, chile en polvo, toque de tequila o cerveza y escarchado botanero completo.",
    ingredients: "Salsas negras preparadas, limón, jugo sazonador, sal con chile en polvo y base de tequila o cerveza.",
    photoUrl: "/tequilitros/productos/tequimiche.png",
  },
  {
    id: "coscorron",
    name: "Coscorrón",
    subtitle: "Tequila blanco, limón, sal y Peñafiel toronja",
    liquidColor: 0xf4deb3, // Dorado cítrico pálido tradicional
    frostColor: 0xfbfaf8, // Sal fina de mar
    hasFrost: true,
    frostType: "sal",
    transmission: 0.76,
    roughness: 0.17,
    description: "El clásico de cantina: tequila blanco de la casa, limón fresco, toque de sal marina y Peñafiel toronja con abundante hielo.",
    ingredients: "Sal, limón, tequila y refresco de toronja.",
    photoUrl: "/tequilitros/productos/paloma.png",
  },
];

// Genera una textura procedimental de escarchado para sal o chile tajín
function createRimTexture(type: "tajin" | "sal"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const numGrains = type === "tajin" ? 900 : 700;

    for (let i = 0; i < numGrains; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = 1 + Math.random() * 2.8;

      if (type === "tajin") {
        // Mezcla de granos rojos, terracota oscuro, naranja chile y destellos de sal
        const colors = [
          "rgba(195, 45, 20, 0.95)",
          "rgba(145, 25, 12, 0.95)",
          "rgba(225, 80, 25, 0.9)",
          "rgba(105, 18, 10, 0.98)",
          "rgba(255, 245, 230, 0.85)", // Grano de sal entre el chile
        ];
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      } else {
        // Cristales de sal blanca con transparencia y brillo
        const alpha = 0.5 + Math.random() * 0.45;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(4, 1);
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

    // Comprobación de WebGL
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

    // 1. Escena, cámara y renderizador optimizado
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 0.22, 4.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 2. Iluminación realista de estudio fotográfico
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 1.1);
    scene.add(ambientLight);

    // Luz principal (Key Light) cálida de estudio
    const keyLight = new THREE.DirectionalLight(0xfff0db, 2.8);
    keyLight.position.set(3.5, 4.5, 3.2);
    scene.add(keyLight);

    // Luz de relleno (Fill Light) fría para dar volumen al plástico translúcido
    const fillLight = new THREE.DirectionalLight(0x8cb6d4, 1.4);
    fillLight.position.set(-3.5, 2.5, -1.5);
    scene.add(fillLight);

    // Luz trasera de recorte (Rim Light) que perfila el borde y el escarchado
    const rimLight = new THREE.PointLight(0xffb766, 3.6, 12);
    rimLight.position.set(0, 2.8, -2.6);
    scene.add(rimLight);

    // Luz inferior tenue para iluminar la base escalonada
    const bottomLight = new THREE.DirectionalLight(0xffe8d6, 0.6);
    bottomLight.position.set(0, -3, 2);
    scene.add(bottomLight);

    // Grupo contenedor para rotación 360 interactiva
    const cupGroup = new THREE.Group();
    scene.add(cupGroup);

    // 3. Geometría fidedigna del Vaso Reyma 32 EU (32 oz / 946 ml)
    // Coordenadas exactas tomadas de las fotografías:
    // Altura total normalizada h = 1.8 (desde y = -0.9 hasta y = +0.9)
    // Base escalonada + 3 estrías de refuerzo termoformadas + labio superior enrollado
    const cupPoints: THREE.Vector2[] = [];

    // Base plana con reborde inferior
    cupPoints.push(new THREE.Vector2(0, -0.90));
    cupPoints.push(new THREE.Vector2(0.265, -0.90));
    cupPoints.push(new THREE.Vector2(0.278, -0.89));

    // Pie cilíndrico inferior característico del vaso Reyma 32
    cupPoints.push(new THREE.Vector2(0.282, -0.71));
    // Escalón exterior
    cupPoints.push(new THREE.Vector2(0.315, -0.68));
    cupPoints.push(new THREE.Vector2(0.325, -0.65));

    // Estría 1 de termoformado
    cupPoints.push(new THREE.Vector2(0.332, -0.58));
    cupPoints.push(new THREE.Vector2(0.348, -0.56));
    cupPoints.push(new THREE.Vector2(0.338, -0.54));

    // Estría 2 de termoformado
    cupPoints.push(new THREE.Vector2(0.352, -0.47));
    cupPoints.push(new THREE.Vector2(0.368, -0.45));
    cupPoints.push(new THREE.Vector2(0.360, -0.43));

    // Estría 3 de termoformado
    cupPoints.push(new THREE.Vector2(0.375, -0.36));
    cupPoints.push(new THREE.Vector2(0.392, -0.34));
    cupPoints.push(new THREE.Vector2(0.385, -0.32));

    // Cuerpo principal cónico liso donde asienta la etiqueta
    cupPoints.push(new THREE.Vector2(0.425, 0.05));
    cupPoints.push(new THREE.Vector2(0.468, 0.45));
    cupPoints.push(new THREE.Vector2(0.510, 0.82));

    // Cuello y labio enrollado exterior (Rolled rim Reyma)
    cupPoints.push(new THREE.Vector2(0.522, 0.875));
    cupPoints.push(new THREE.Vector2(0.542, 0.895)); // Borde exterior redondeado
    cupPoints.push(new THREE.Vector2(0.536, 0.905)); // Cúspide del labio
    cupPoints.push(new THREE.Vector2(0.520, 0.902)); // Borde interior
    cupPoints.push(new THREE.Vector2(0.510, 0.875));

    const cupGeometry = new THREE.LatheGeometry(cupPoints, 64);
    const cupMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.85,
      opacity: 0.96,
      transparent: true,
      roughness: 0.18,
      ior: 1.49, // Índice de refracción del polipropileno (PP)
      thickness: 0.22,
      specularIntensity: 1.25,
      side: THREE.DoubleSide,
    });
    const cupMesh = new THREE.Mesh(cupGeometry, cupMaterial);
    cupGroup.add(cupMesh);

    // 4. Geometría del Líquido interior fiel al perfil del vaso
    const liquidPoints: THREE.Vector2[] = [];
    liquidPoints.push(new THREE.Vector2(0, -0.87));
    liquidPoints.push(new THREE.Vector2(0.26, -0.87));
    liquidPoints.push(new THREE.Vector2(0.27, -0.70));
    liquidPoints.push(new THREE.Vector2(0.305, -0.66));
    liquidPoints.push(new THREE.Vector2(0.32, -0.56));
    liquidPoints.push(new THREE.Vector2(0.34, -0.45));
    liquidPoints.push(new THREE.Vector2(0.365, -0.34));
    liquidPoints.push(new THREE.Vector2(0.41, 0.05));
    liquidPoints.push(new THREE.Vector2(0.45, 0.45));
    liquidPoints.push(new THREE.Vector2(0.495, 0.78)); // Nivel superior de la bebida
    liquidPoints.push(new THREE.Vector2(0, 0.78));

    const liquidGeometry = new THREE.LatheGeometry(liquidPoints, 48);
    const liquidMaterial = new THREE.MeshPhysicalMaterial({
      color: activeDrink.liquidColor,
      transmission: activeDrink.transmission,
      opacity: 0.98,
      transparent: true,
      roughness: activeDrink.roughness,
      ior: 1.333, // Agua / cóctel
    });
    const liquidMesh = new THREE.Mesh(liquidGeometry, liquidMaterial);
    cupGroup.add(liquidMesh);

    // 5. Cubos de Hielo flotantes realistas en la superficie
    // En las fotos reales, los hielos sobresalen visiblemente del borde del vaso
    const iceGroup = new THREE.Group();
    const iceGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.92,
      opacity: 0.89,
      transparent: true,
      roughness: 0.08,
      ior: 1.31, // Hielo
      specularIntensity: 1.6,
    });

    // Posiciones agrupadas en el tope del vaso (algunos asomando sobre el borde)
    const icePositions = [
      { x: -0.12, y: 0.81, z: 0.08, r: [0.35, 0.45, 0.15], s: 1.05 },
      { x: 0.14, y: 0.79, z: -0.06, r: [0.12, 0.78, 0.48], s: 0.95 },
      { x: 0.03, y: 0.88, z: 0.09, r: [0.65, 0.25, 0.38], s: 1.1 }, // Sobresale arriba
      { x: -0.16, y: 0.76, z: -0.12, r: [0.42, 0.18, 0.82], s: 0.9 },
      { x: 0.12, y: 0.84, z: 0.14, r: [0.28, 0.62, 0.18], s: 0.98 },
      { x: -0.02, y: 0.82, z: -0.15, r: [0.55, 0.35, 0.22], s: 1.0 },
    ];

    icePositions.forEach((pos) => {
      const ice = new THREE.Mesh(iceGeo, iceMat);
      ice.position.set(pos.x, pos.y, pos.z);
      ice.rotation.set(pos.r[0], pos.r[1], pos.r[2]);
      ice.scale.setScalar(pos.s);
      iceGroup.add(ice);
    });
    cupGroup.add(iceGroup);

    // 6. Etiqueta / Escudo Oficial Tequilitros (Circular con Greca y Agave)
    // Extraída de las fotografías en alta resolución con fondo transparente
    const textureLoader = new THREE.TextureLoader();
    const labelTexture = textureLoader.load(
      "/tequilitros/logo-tequilitros-vaso.png",
      () => {
        labelTexture.colorSpace = THREE.SRGBColorSpace;
        labelTexture.needsUpdate = true;
      }
    );

    // Patch cilíndrico curvado sobre el cono superior del vaso (y = 0.16)
    // Radio superior 0.458, radio inferior 0.412, altura 0.54, ángulo ~ 56 grados
    const labelGeo = new THREE.CylinderGeometry(
      0.458,
      0.412,
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
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.y = 0.16;
    cupGroup.add(labelMesh);

    // 7. Escarchado Superior (Rim Frosting) Dinámico
    // Para Cantarito, Vampiro y Tequimiche: chile tajín con textura granular y relieve
    // Para Paloma: sal marina blanca brillante
    // Para Tequimora y Tequimojito: borde liso transparente (hasFrost = false)
    const frostGroup = new THREE.Group();
    const tajinTexture = createRimTexture("tajin");
    const salTexture = createRimTexture("sal");

    const frostGeometry = new THREE.TorusGeometry(0.536, 0.032, 16, 64);
    const frostMaterial = new THREE.MeshStandardMaterial({
      color: activeDrink.frostColor,
      roughness: 0.94,
      metalness: 0.05,
      map: activeDrink.frostType === "sal" ? salTexture : tajinTexture,
    });
    const frostMesh = new THREE.Mesh(frostGeometry, frostMaterial);
    frostMesh.rotation.x = Math.PI / 2;
    frostMesh.position.y = 0.902;
    frostGroup.add(frostMesh);

    // Anillo secundario irregular con salpicaduras de chile para emular el escarchado real
    const dripGeometry = new THREE.CylinderGeometry(0.54, 0.528, 0.06, 48, 1, true);
    const dripMaterial = new THREE.MeshStandardMaterial({
      color: activeDrink.frostColor,
      roughness: 0.98,
      transparent: true,
      opacity: 0.88,
      map: activeDrink.frostType === "sal" ? salTexture : tajinTexture,
      side: THREE.DoubleSide,
    });
    const dripMesh = new THREE.Mesh(dripGeometry, dripMaterial);
    dripMesh.position.y = 0.875;
    frostGroup.add(dripMesh);

    frostGroup.visible = activeDrink.hasFrost;
    cupGroup.add(frostGroup);

    // Inclinación inicial estética para apreciar la etiqueta y el borde
    cupGroup.rotation.x = 0.18;
    cupGroup.rotation.y = -0.28;

    // Interacción táctil y mouse con arrastre 360° fluido
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

    // Render loop con IntersectionObserver para ahorro de batería
    let animationFrameId: number;
    let isVisible = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.1 }
    );
    observer.observe(container);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isVisible) return;

      if (autoRotate) {
        cupGroup.rotation.y += 0.0035;
      }

      // Animación suave de los hielos en la superficie
      iceGroup.rotation.y = Math.sin(Date.now() * 0.001) * 0.035;

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

    // Función interna para actualizar el material dinámicamente al cambiar bebida
    (container as unknown as { _updateDrink?: (d: DrinkFlavor) => void })._updateDrink = (
      drink: DrinkFlavor
    ) => {
      liquidMaterial.color.setHex(drink.liquidColor);
      liquidMaterial.transmission = drink.transmission;
      liquidMaterial.roughness = drink.roughness;

      frostGroup.visible = drink.hasFrost;
      if (drink.hasFrost) {
        frostMaterial.color.setHex(drink.frostColor);
        dripMaterial.color.setHex(drink.frostColor);
        const tex = drink.frostType === "sal" ? salTexture : tajinTexture;
        frostMaterial.map = tex;
        dripMaterial.map = tex;
        frostMaterial.needsUpdate = true;
        dripMaterial.needsUpdate = true;
      }
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
      dripGeometry.dispose();
      dripMaterial.dispose();
      tajinTexture.dispose();
      salTexture.dispose();
      labelGeo.dispose();
      labelMat.dispose();
      labelTexture.dispose();
      renderer.dispose();

      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }
    };
  }, [webglSupported]);

  // Actualizar materiales al seleccionar otra bebida
  useEffect(() => {
    const container = containerRef.current as unknown as {
      _updateDrink?: (d: DrinkFlavor) => void;
    };
    if (container?._updateDrink) {
      container._updateDrink(activeDrink);
    }
  }, [activeDrink]);

  const selectDrink = (drink: DrinkFlavor) => {
    setInternalDrinkId(drink.id);
    onSelectDrink?.(drink.id);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[#2A343D] bg-[#0E1318]/90 p-4 sm:p-8 backdrop-blur-xl">
      {/* Encabezado y Especificaciones del Vaso */}
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-[#242E37] pb-6 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-[#E28735]">
              Especificación Técnica 3D · 946 ml
            </span>
            <span className="inline-flex h-2 w-2 rounded-full bg-[#30D158] animate-pulse" />
          </div>
          <h3 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#F5F2EB] sm:text-3xl">
            Vaso Reyma 32 EU Oficial
          </h3>
          <p className="mt-1 text-xs text-[#9AA5AC] sm:text-sm">
            Modelado con base en las fotos de producto de alta resolución de Tequilitros: pie escalonado,
            estrías termoformadas, hielos reales a tope y etiqueta oficial de la marca.
          </p>
        </div>

        {/* Ficha de medidas reales de ingeniería */}
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
      <div className="relative min-h-[460px] sm:min-h-[520px] w-full">
        {webglSupported ? (
          <>
            <div
              ref={containerRef}
              className="h-[460px] sm:h-[520px] w-full select-none cursor-grab active:cursor-grabbing"
            />
            {/* Indicador interactivo */}
            <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-[#2A343D] bg-[#0E1318]/85 px-3 py-1 text-[11px] font-mono text-[#9AA5AC] backdrop-blur">
              <span className="text-[#E28735]">↻</span>
              <span>Arrastra para girar 360° · Inspecciona el vaso</span>
            </div>
          </>
        ) : (
          /* Fallback visual 2.5D optimizado con fotografía real de alta resolución */
          <div className="flex h-[460px] sm:h-[520px] w-full items-center justify-center p-6 text-center">
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
                  Fotografía de Producto Real
                </span>
                <h4 className="text-xl font-bold text-[#F5F2EB]">{activeDrink.name}</h4>
                <p className="text-xs text-[#9AA5AC]">{activeDrink.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tarjeta flotante con la fotografía real de referencia para comparar de inmediato */}
        {webglSupported && (
          <div className="pointer-events-none absolute right-4 top-4 hidden h-48 w-36 overflow-hidden rounded-xl border border-[#D4AF37]/30 bg-[#080B0E]/80 p-2 shadow-2xl backdrop-blur-md sm:flex sm:flex-col sm:items-center sm:justify-between">
            <div className="relative h-36 w-full">
              <Image
                src={activeDrink.photoUrl}
                alt={activeDrink.name}
                fill
                sizes="144px"
                className="object-contain p-1 drop-shadow-2xl"
              />
            </div>
            <div className="w-full rounded bg-[#141B22]/90 py-1 text-center">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#E28735]">
                Foto Real de Referencia
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Selector de Bebidas (Reactivo al Vaso 3D) */}
      <div className="mt-6 border-t border-[#242E37] pt-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#9AA5AC]">
            Selecciona una bebida para simular en el vaso 3D:
          </p>
          <span className="font-mono text-[11px] text-[#E28735]">
            {activeDrink.hasFrost
              ? activeDrink.frostType === "sal"
                ? "🧂 Escarchado con Sal de Mar"
                : "🌶️ Escarchado con Sal y Chile"
              : "🧊 Borde Liso · Hielos a Tope"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
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
                    className="h-3.5 w-3.5 rounded-full border border-white/20 shadow-sm"
                    style={{
                      backgroundColor: `#${drink.liquidColor.toString(16).padStart(6, "0")}`,
                    }}
                  />
                  {isSelected && (
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#E28735]">
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
        <div className="mt-4 rounded-xl border border-[#242E37] bg-[#141B22]/60 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h4 className="text-base font-bold text-[#F5F2EB]">
              <span className="text-[#E28735]">{activeDrink.name}:</span> {activeDrink.subtitle}
            </h4>
            <span className="font-mono text-xs text-[#9AA5AC]">
              {activeDrink.hasFrost
                ? activeDrink.frostType === "sal"
                  ? "Escarchado de sal fina"
                  : "Escarchado con chile tajín"
                : "Sin escarcha · Borde clásico"}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#D2DAE0] sm:text-sm">
            {activeDrink.description}
          </p>
          <p className="mt-1 font-mono text-[11px] text-[#9AA5AC]">
            <strong className="text-[#A8B4BC]">Ingredientes:</strong> {activeDrink.ingredients}
          </p>
        </div>
      </div>
    </div>
  );
}
