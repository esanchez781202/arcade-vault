// Stub de la pantalla "Acerca de" (ruta /acerca-de).
// La pantalla About + Contacto real (references/templates/home-about/about.jsx)
// se implementa en una spec posterior. Aquí solo un marcador para que el enlace
// del nav no dé 404. Sin lógica.

export default function AcercaDe() {
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ACERCA DE</h1>
        <div className="sub">
          LA HISTORIA DETRÁS DE LA MÁQUINA <span className="blink">_</span>
        </div>
      </section>

      <div
        style={{
          textAlign: "center",
          padding: 80,
          color: "var(--ink-faint)",
        }}
      >
        <div
          className="pixel neon-magenta"
          style={{ fontSize: 18, marginBottom: 12 }}
        >
          PRÓXIMAMENTE
        </div>
        <div>Esta pantalla llegará en una próxima actualización.</div>
      </div>
    </div>
  );
}
