/**
 * ==========================================================
 * MAESTRO
 * Sistema Operativo de la Destilería
 * ----------------------------------------------------------
 * Set de iconos de la aplicación.
 *
 * Reemplaza el uso de emojis por iconos SVG consistentes
 * (estilo trazo, 24x24, sin dependencias externas —
 * el registro de npm no está disponible en este entorno,
 * así que se definen a mano en vez de instalar lucide-react).
 * ==========================================================
 */

import { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4h4v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function FactoryIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 20V9l6 4V9l6 4V6l6 4v10z" />
      <path d="M3 20h18" />
      <path d="M8 20v-3M13 20v-3" />
    </svg>
  );
}

export function MartiniIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4h16l-8 9-8-9Z" />
      <path d="M12 13v7M8 20h8" />
    </svg>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h13A1.5 1.5 0 0 1 19 7.5v9A1.5 1.5 0 0 1 17.5 18h-13A1.5 1.5 0 0 1 3 16.5Z" />
      <path d="M16 12.5h2.5a1.5 1.5 0 0 0 0-3H16v3Z" />
      <path d="M3 9.5h13" />
    </svg>
  );
}

export function PackageIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m3.5 7.5 8.5-4 8.5 4-8.5 4-8.5-4Z" />
      <path d="M3.5 7.5v9l8.5 4 8.5-4v-9" />
      <path d="M12 11.5v9" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.5 14.2c2.3.3 4 2 4 4.8" />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3s-5 4.5-5 9.5a5 5 0 0 0 10 0c0-1.6-.8-2.8-1.5-3.7.2 1.3-.4 2-1 2 .3-2.5-1-4.3-2.5-5.8Z" />
    </svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.8 6.2l-1.4 1.4M7.6 16.4l-1.4 1.4M17.8 17.8l-1.4-1.4M7.6 7.6 6.2 6.2" />
    </svg>
  );
}

export function FlaskIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 3h4" />
      <path d="M11 3v6.5L5.5 19a1.8 1.8 0 0 0 1.6 2.7h9.8a1.8 1.8 0 0 0 1.6-2.7L13 9.5V3" />
      <path d="M8 15.5h8" />
    </svg>
  );
}

export function GlassWaterIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 4h12l-1.3 15a2 2 0 0 1-2 1.8H9.3a2 2 0 0 1-2-1.8Z" />
      <path d="M6.5 10.5h11" />
    </svg>
  );
}

export function CoinsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <ellipse cx="9" cy="8" rx="5.5" ry="3" />
      <path d="M3.5 8v4c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3V8" />
      <path d="M9.5 15c.4 1.2 2.6 2 5 2s4.6-.8 5-2" />
      <path d="M14.5 11c2.7.2 5 1.4 5 3s-2.5 3-5.5 3" />
    </svg>
  );
}

export function BrainIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 4.5a2.5 2.5 0 0 0-2.5 2.5v.3A2.7 2.7 0 0 0 4.5 10c0 .7.2 1.3.6 1.8A2.6 2.6 0 0 0 5 14.5a2.6 2.6 0 0 0 2.2 2.6A2.5 2.5 0 0 0 9.5 19V7A2.5 2.5 0 0 0 9 4.5Z" />
      <path d="M15 4.5a2.5 2.5 0 0 1 2.5 2.5v.3a2.7 2.7 0 0 1 2 2.7c0 .7-.2 1.3-.6 1.8A2.6 2.6 0 0 1 19 14.5a2.6 2.6 0 0 1-2.2 2.6A2.5 2.5 0 0 1 14.5 19V7A2.5 2.5 0 0 1 15 4.5Z" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5Z" />
    </svg>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12.5 4H6a2 2 0 0 0-2 2v6.5a1 1 0 0 0 .3.7l9 9a1.5 1.5 0 0 0 2.1 0l6-6a1.5 1.5 0 0 0 0-2.1l-9-9a1 1 0 0 0-.7-.3Z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </svg>
  );
}

export function BottleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 2h4v3.2l1.5 2.3a3 3 0 0 1 .5 1.7V20a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9.2a3 3 0 0 1 .5-1.7L10 5.2Z" />
      <path d="M9 13h6" />
    </svg>
  );
}

export function QrIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
      <path d="M14.5 14.5h2.5v2.5h-2.5ZM19.5 14.5h1v1M14.5 19.5h1v1M17.5 17.5h3v3h-3Z" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
    </svg>
  );
}

export function ChartLineIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4v16h16" />
      <path d="m6.5 15 3.5-4 3 2.5L18 8" />
    </svg>
  );
}

export function ChartBarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20V10M10 20V4M16 20v-7" />
      <path d="M4 20h16" />
    </svg>
  );
}

export function StoreIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 10v8.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V10" />
      <path d="M3 5h18l1.3 4a2 2 0 0 1-2 2.5H3.7a2 2 0 0 1-2-2.5Z" />
      <path d="M9.5 19.5V15a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v4.5" />
    </svg>
  );
}

export function ReceiptIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 15.5v-11M8 8l4-4 4 4" />
      <path d="M4 16.5v2A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="11" width="14" height="9.5" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
      <circle cx="12" cy="15.5" r="1.3" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.5-4.5" />
    </svg>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5.5" y="4.5" width="13" height="17" rx="2" />
      <path d="M9 4.5V3.8A1.3 1.3 0 0 1 10.3 2.5h3.4A1.3 1.3 0 0 1 15 3.8v.7" />
      <path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4.5" />
    </svg>
  );
}

export function PartyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20 15 9l1 1-11 11Z" />
      <path d="M13 3.5 15 5M18 6l1.5 1.5M9.5 2 11 3.5M19 11l1.5 1M15 16.5l.5 2" />
    </svg>
  );
}

export function ToolboxIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="9.5" width="18" height="10" rx="2" />
      <path d="M8.5 9.5V7a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2.5" />
      <path d="M3 13.5h18M10.5 13.5v2.5M13.5 13.5v2.5" />
    </svg>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12.5h4.2l1.3 2.5h4.9l1.3-2.5H20" />
      <path d="M5.5 5h13L20 12.5v5A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-5Z" />
    </svg>
  );
}

export function ListChecksIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m3.5 6 1.5 1.5L8 4.5M3.5 13l1.5 1.5L8 11.5M3.5 20l1.5 1.5L8 18.5" />
      <path d="M11 6h9.5M11 13h9.5M11 20h9.5" />
    </svg>
  );
}

export function DollarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.5v19" />
      <path d="M16.5 6.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3S9.5 9.5 12 9.5s4.5 1.3 4.5 3.5-2 3.5-4.5 3.5-4.5-1.3-4.5-3.5" />
    </svg>
  );
}

export function StillIcon(props: IconProps) {
  /* Alambique — icono de marca para el logo de MAESTRO */
  return (
    <svg {...base(props)}>
      <path d="M8 13.5a4 4 0 1 1 8 0c0 2.5-1.5 3.5-1.5 5.5a2.5 2.5 0 0 1-5 0c0-2-1.5-3-1.5-5.5Z" />
      <path d="M14 6.5h4.5M18.5 6.5v2.5M12 4v3" />
      <circle cx="12" cy="13.5" r=".3" fill="currentColor" />
    </svg>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3" />
      <path d="M14.5 16.5 19 12l-4.5-4.5M19 12H9" />
    </svg>
  );
}

export function LoginIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M15 20h3a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
      <path d="M9.5 16.5 5 12l4.5-4.5M5 12h10" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14.5 4.5 7 12l7.5 7.5" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9.5 4.5 17 12l-7.5 7.5" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 5l14 14M19 5 5 19" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
      <path d="M6.5 7 7.3 19a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.3" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5 21.5 20H2.5L12 3.5Z" strokeLinejoin="round" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 5.5v13M16 5.5v13" />
    </svg>
  );
}

export function PrinterIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 8V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4" />
      <rect x="3.5" y="8" width="17" height="8" rx="1.5" />
      <path d="M7 13.5h10V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1Z" />
      <circle cx="16.5" cy="11" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8.5 8 12l4-6.5 4 6.5 4-3.5V17H4Z" strokeLinejoin="round" />
      <path d="M4 19.5h16" />
    </svg>
  );
}

export function ArrowDownRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 7 17 17" />
      <path d="M9 17h8V9" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function AgaveIcon(props: IconProps) {
  /* Agave — rosette de pencas, para trazabilidad de lotes. */
  return (
    <svg {...base(props)}>
      <path d="M12 21V9" />
      <path d="M12 12c-2.6-1.7-3.8-4.6-3.3-8" />
      <path d="M12 12c2.6-1.7 3.8-4.6 3.3-8" />
      <path d="M12 15.5c-3-1-5-3-6-6" />
      <path d="M12 15.5c3-1 5-3 6-6" />
    </svg>
  );
}

export function CoffeeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" />
      <path d="M16 10.5h1.5a2.3 2.3 0 0 1 0 4.6H16" />
      <path d="M8 6c-.6-.8-.6-1.6 0-2.5M11.5 6c-.6-.8-.6-1.6 0-2.5" />
    </svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 20s-7.5-4.7-9.5-9.4C1 7 3 4 6.3 4c2 0 3.4 1.2 4.2 2.6.3.5.5.9 1 1 .5-.1.7-.5 1-1C13.3 5.2 14.7 4 16.7 4 20 4 22 7 20.5 10.6 18.5 15.3 12 20 12 20Z" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.7-5.4" />
      <path d="M17.5 3v4h-4" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.7 5.4" />
      <path d="M6.5 21v-4h4" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 8.5a6 6 0 0 1 12 0c0 4.2 1.2 6.2 2 7.1H4c.8-.9 2-2.9 2-7.1Z" />
      <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

export function BellOffIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 8.5a6 6 0 0 1 10.4-4" />
      <path d="M18 8.5c0 4.2 1.2 6.2 2 7.1H8" />
      <path d="M4 15.6c.8-.9 2-2.9 2-7.1" />
      <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export function ThermometerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 14.5V4.5a2 2 0 1 0-4 0v10a4 4 0 1 0 4 0Z" />
      <path d="M12 9.5h2" />
    </svg>
  );
}

export function BucketIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8h16l-1.6 11.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8L4 8Z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </svg>
  );
}

export function ScissorsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="6" cy="6.5" r="2.2" />
      <circle cx="6" cy="17.5" r="2.2" />
      <path d="M7.8 8L19 19" />
      <path d="M7.8 16L19 5" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20l1-4.2L15.4 5.4a1.8 1.8 0 0 1 2.6 0l.6.6a1.8 1.8 0 0 1 0 2.6L8.2 19l-4.2 1Z" />
      <path d="M13.5 7.3l3.2 3.2" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5l7 2.7v5.4c0 4.8-3 8-7 9.4-4-1.4-7-4.6-7-9.4V6.2Z" />
    </svg>
  );
}

export function HashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9.5 3.5L7.5 20.5" />
      <path d="M16.5 3.5L14.5 20.5" />
      <path d="M4 9h16" />
      <path d="M3 15h16" />
    </svg>
  );
}

export function ArrowsRangeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 12h17" />
      <path d="M7 8L3.5 12L7 16" />
      <path d="M17 8L20.5 12L17 16" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5l2.6 5.4 5.9.7-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9-4.3-4.1 5.9-.7Z" />
    </svg>
  );
}

export function CashRegisterIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 9.5h15l-1.2-4.2a1.5 1.5 0 0 0-1.44-1.08H7.14A1.5 1.5 0 0 0 5.7 5.3Z" />
      <path d="M3.5 9.5h17V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1Z" />
      <path d="M9 13.5h6M9 17h6" />
      <path d="M12 9.5V13" />
    </svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </svg>
  );
}

/* Alias de compatibilidad para las pantallas de estado global. */
export const ChevronDownIcon = ChevronRightIcon;
export const LogOutIcon = LogoutIcon;
export const SettingsIcon = GearIcon;
export const MenuIcon = GridIcon;
export const AlertCircleIcon = InfoIcon;
export const CheckCircleIcon = CheckIcon;
export const AlertTriangleIcon = AlertIcon;
export const RefreshCwIcon = RefreshIcon;
