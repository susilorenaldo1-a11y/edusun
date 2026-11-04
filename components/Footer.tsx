import Image from "next/image";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Image
            src="/brand/edusun-mark.svg"
            alt=""
            aria-hidden
            width={34}
            height={34}
            className="footer-logo"
          />
          <div>
            <strong>E-Dusun</strong>
            <p className="footer-muted">
              Prototype inovasi web berbasis AI untuk pelayanan administrasi desa.
            </p>
          </div>
        </div>
        <p className="footer-meta">
          &copy; {new Date().getFullYear()} E-Dusun · Dusun Permata Anyar, Desa
          Ubung Kaja, Kecamatan Denpasar Utara, Kota Denpasar, Bali.
        </p>
      </div>
    </footer>
  );
}
