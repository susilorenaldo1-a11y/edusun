"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAV = [
  { href: "/", label: "Beranda" },
  { href: "/ajukan", label: "Ajukan Dokumen" },
  { href: "/lacak", label: "Lacak Status" },
  { href: "/admin", label: "Panel Admin" },
];

export default function Header() {
  const pathname = usePathname();
  // The menu is open only for the path it was opened on, so navigating closes it
  // automatically without a state-syncing effect.
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const open = menuPath === pathname;
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Escape closes and returns focus to the toggle.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuPath(null);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Close when the viewport grows back to the desktop layout.
  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia("(min-width: 761px)");
    const onChange = () => {
      if (query.matches) setMenuPath(null);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [open]);

  // Close when tapping outside the header.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMenuPath(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <header className="site-header" ref={headerRef}>
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label="E-Dusun — kembali ke beranda">
          <span className="brand-mark">E</span>
          <span className="brand-text">
            E-Dusun
            <small>Dusun Permata Anyar</small>
          </span>
        </Link>

        <nav className="nav" aria-label="Navigasi utama">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${isActive(item.href) ? " is-active" : ""}`}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          ref={toggleRef}
          className={`nav-toggle${open ? " is-open" : ""}`}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Tutup menu navigasi" : "Buka menu navigasi"}
          onClick={() => setMenuPath(open ? null : pathname)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="mobile-nav">
          <nav aria-label="Navigasi ponsel">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-nav-link${isActive(item.href) ? " is-active" : ""}`}
                aria-current={isActive(item.href) ? "page" : undefined}
                onClick={() => setMenuPath(null)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
