"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/login";
import type { User } from "@prisma/client";
import {
  ChevronDownIcon,
  HomeIcon,
  LogOutIcon,
  SettingsIcon,
  MenuIcon,
  XIcon,
} from "@/components/ui/icons";
import { useState } from "react";

interface GlobalHeaderProps {
  user: User;
}

export default function GlobalHeader({ user }: GlobalHeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // No mostrar header en login o páginas públicas
  if (pathname === "/login" || pathname === "/forgot-password" || pathname === "/reset-password" || pathname === "/privacy-policy" || pathname === "/terms-of-service" || pathname === "/support") {
    return null;
  }

  const firstName = user.name.trim().split(/\s+/)[0] || "Usuario";
  const isAdmin = user.role === "ADMIN";

  const handleLogout = async () => {
    await logoutAction();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant bg-surface-container backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo / Branding */}
          <Link href="/" className="flex items-center gap-2 font-bold text-primary hover:opacity-80 transition">
            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">M</span>
            </div>
            <span className="hidden sm:inline">Maestro</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className={`text-sm font-medium transition ${
                pathname === "/"
                  ? "text-primary"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              Home
            </Link>

            {isAdmin && (
              <Link
                href="/administration"
                className={`text-sm font-medium transition ${
                  pathname.includes("/administration")
                    ? "text-primary"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                Administración
              </Link>
            )}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Profile Dropdown */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm font-medium text-on-surface hover:border-primary hover:bg-surface-container transition"
              >
                <span className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {firstName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:inline">{firstName}</span>
                <ChevronDownIcon className={`h-4 w-4 transition ${profileDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-outline-variant bg-surface-container shadow-lg">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-3 text-sm text-on-surface hover:bg-surface-container-high transition"
                    onClick={() => setProfileDropdownOpen(false)}
                  >
                    <SettingsIcon className="h-4 w-4" />
                    Mi Perfil
                  </Link>
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-error hover:bg-surface-container-high transition border-t border-outline-variant"
                  >
                    <LogOutIcon className="h-4 w-4" />
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-on-surface hover:bg-surface-container-high transition"
            >
              {mobileMenuOpen ? (
                <XIcon className="h-6 w-6" />
              ) : (
                <MenuIcon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-outline-variant bg-surface-container py-3">
            <Link
              href="/"
              className="block px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high rounded transition"
              onClick={() => setMobileMenuOpen(false)}
            >
              <HomeIcon className="h-4 w-4 inline mr-2" />
              Home
            </Link>

            {isAdmin && (
              <Link
                href="/administration"
                className="block px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high rounded transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                <SettingsIcon className="h-4 w-4 inline mr-2" />
                Administración
              </Link>
            )}

            <Link
              href="/profile"
              className="block px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high rounded transition"
              onClick={() => setMobileMenuOpen(false)}
            >
              <SettingsIcon className="h-4 w-4 inline mr-2" />
              Mi Perfil
            </Link>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full text-left px-4 py-2 text-sm font-medium text-error hover:bg-surface-container-high rounded transition border-t border-outline-variant mt-2"
            >
              <LogOutIcon className="h-4 w-4 inline mr-2" />
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
