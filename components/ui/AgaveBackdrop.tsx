/*
 * Ilustración vectorial de un campo de agave al atardecer.
 * Sustituye la foto /images/agave-field.jpg que nunca existió
 * en /public. Usa los tokens de color del sistema (Stitch/M3)
 * para quedar en armonía con el resto de la app.
 */

type LeafProps = {
  angle: number;
  length: number;
  width: number;
  color: string;
  opacity?: number;
};

function Leaf({ angle, length, width, color, opacity = 1 }: LeafProps) {
  const d = `M 0,0 C ${-width},${-length * 0.32} ${-width * 0.55},${
    -length * 0.78
  } 0,${-length} C ${width * 0.55},${-length * 0.78} ${width},${
    -length * 0.32
  } 0,0 Z`;

  return (
    <path
      d={d}
      fill={color}
      opacity={opacity}
      transform={`rotate(${angle})`}
    />
  );
}

function AgavePlant({
  cx,
  cy,
  scale,
  color,
  opacity = 1,
  leafCount = 15,
}: {
  cx: number;
  cy: number;
  scale: number;
  color: string;
  opacity?: number;
  leafCount?: number;
}) {
  const leaves = Array.from({ length: leafCount }, (_, i) => {
    const angle = (360 / leafCount) * i - 90;
    const variance = i % 3 === 0 ? 1 : i % 2 === 0 ? 0.82 : 0.94;

    return (
      <Leaf
        key={i}
        angle={angle}
        length={70 * variance}
        width={13 * variance}
        color={color}
      />
    );
  });

  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`} opacity={opacity}>
      {leaves}
      <circle r={10} fill={color} />
    </g>
  );
}

export default function AgaveBackdrop({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      role="img"
      aria-label="Campo de agave al atardecer"
    >
      <defs>
        <linearGradient id="agave-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-surface-dim)" />
          <stop offset="55%" stopColor="var(--color-surface-container-low)" />
          <stop
            offset="100%"
            stopColor="var(--color-secondary-container)"
            stopOpacity="0.35"
          />
        </linearGradient>

        <radialGradient id="agave-glow" cx="50%" cy="78%" r="60%">
          <stop
            offset="0%"
            stopColor="var(--color-secondary)"
            stopOpacity="0.35"
          />
          <stop
            offset="45%"
            stopColor="var(--color-secondary)"
            stopOpacity="0.12"
          />
          <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="agave-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-surface-container)" />
          <stop offset="100%" stopColor="var(--color-surface-dim)" />
        </linearGradient>
      </defs>

      {/* Cielo de atardecer */}
      <rect width="1600" height="900" fill="url(#agave-sky)" />
      <rect width="1600" height="900" fill="url(#agave-glow)" />

      {/* Sol */}
      <circle
        cx="800"
        cy="560"
        r="120"
        fill="var(--color-secondary)"
        opacity="0.18"
      />
      <circle
        cx="800"
        cy="560"
        r="70"
        fill="var(--color-secondary)"
        opacity="0.28"
      />

      {/* Horizonte / tierra */}
      <path
        d="M0,640 C 320,600 480,660 800,630 C 1120,600 1280,650 1600,610 L1600,900 L0,900 Z"
        fill="url(#agave-ground)"
      />

      {/* Agaves lejanos (fila trasera, tenues) */}
      <AgavePlant cx={140} cy={640} scale={0.55} color="var(--color-outline)" opacity={0.35} leafCount={13} />
      <AgavePlant cx={330} cy={620} scale={0.4} color="var(--color-outline)" opacity={0.3} leafCount={11} />
      <AgavePlant cx={560} cy={648} scale={0.5} color="var(--color-outline)" opacity={0.32} leafCount={13} />
      <AgavePlant cx={780} cy={615} scale={0.42} color="var(--color-outline)" opacity={0.28} leafCount={11} />
      <AgavePlant cx={1020} cy={645} scale={0.55} color="var(--color-outline)" opacity={0.33} leafCount={13} />
      <AgavePlant cx={1250} cy={618} scale={0.45} color="var(--color-outline)" opacity={0.3} leafCount={11} />
      <AgavePlant cx={1470} cy={642} scale={0.5} color="var(--color-outline)" opacity={0.32} leafCount={13} />

      {/* Agaves de primer plano (silueta marcada) */}
      <AgavePlant cx={90} cy={780} scale={1.15} color="var(--color-surface-container-highest)" leafCount={17} />
      <AgavePlant cx={420} cy={830} scale={0.95} color="var(--color-surface-container-highest)" leafCount={15} />
      <AgavePlant cx={760} cy={800} scale={1.05} color="var(--color-surface-container-highest)" leafCount={17} />
      <AgavePlant cx={1130} cy={840} scale={1} color="var(--color-surface-container-highest)" leafCount={15} />
      <AgavePlant cx={1480} cy={790} scale={1.2} color="var(--color-surface-container-highest)" leafCount={17} />
      <AgavePlant cx={1590} cy={860} scale={1.3} color="var(--color-surface-container-highest)" leafCount={15} />
      <AgavePlant cx={10} cy={870} scale={1.25} color="var(--color-surface-container-highest)" leafCount={15} />
    </svg>
  );
}
