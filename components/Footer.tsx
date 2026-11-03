export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>
          &copy; {new Date().getFullYear()} E-Dusun · Dusun Permata Anyar, Desa
          Ubung Kaja, Kecamatan Denpasar Utara, Kota Denpasar, Bali.
        </p>
        <p className="footer-muted">
          Prototype inovasi web berbasis AI untuk pelayanan administrasi desa.
        </p>
      </div>
    </footer>
  );
}
