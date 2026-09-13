import { CoffeeIcon, HeartIcon } from "@/components/ui/icons";

export default function AppFooter() {
  return (
    <footer className="mt-10 border-t border-outline-variant px-4 py-6 text-center sm:px-6">
      <p className="text-sm font-semibold text-on-surface-variant">
        Destiladora del Norte v2.0
      </p>

      <p className="mt-2 flex items-center justify-center gap-1.5 text-xs leading-5 text-outline">
        Hecho con
        <CoffeeIcon className="h-3.5 w-3.5" />
        código y mucho
        <HeartIcon className="h-3.5 w-3.5" />
        para Destiladora del Norte.
      </p>
    </footer>
  );
}