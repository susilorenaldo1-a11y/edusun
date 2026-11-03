import Link from "next/link";

const NAV = [
  { href: "/", label: "Beranda" },
  { href: "/ajukan", label: "Ajukan Dokumen" },
  { href: "/lacak", label: "Lacak Status" },
  { href: "/admin", label: "Panel Admin" },
];

export default function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">E</span>
          <span className="brand-text">
            E-Dusun
            <small>Dusun Permata Anyar</small>
          </span>
        </Link>
        <nav className="nav">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
