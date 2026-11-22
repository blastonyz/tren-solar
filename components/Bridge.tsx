const STEPS = [
  { n: "01", title: "Explorá", text: "Recorré la Quebrada estación por estación y mirá el clima y las alertas del día." },
  { n: "02", title: "Elegí", text: "Excursiones, hospedajes y productos de familias, cooperativas y emprendedores locales." },
  { n: "03", title: "Generá impacto", text: "Cada oferta muestra cuánto de lo que pagás queda en la comunidad que la hace posible." },
];

/** Puente entre el hero 3D y el catálogo: del paisaje a su gente. */
export function Bridge() {
  return (
    <section className="relative z-10 bg-arena text-carbon">
      <div aria-hidden className="absolute inset-x-0 -top-24 h-24 bg-gradient-to-b from-transparent to-arena" />
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-20">
        <p className="text-[11px] tracking-[0.35em] text-carbon/60 uppercase">Del paisaje a su gente</p>
        <h2 className="mt-3 max-w-3xl text-3xl leading-tight font-semibold sm:text-5xl">Un viaje que transforma el territorio.</h2>
        <p className="mt-4 max-w-2xl text-base text-carbon/70">
          Cada parada conecta a quien viaja con productores, familias y experiencias locales, para una economía regional más conectada.
        </p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="rounded-2xl border border-carbon/10 bg-white/60 p-5">
              <span className="text-xs font-semibold tracking-widest text-carbon/45">{step.n}</span>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-carbon/70">{step.text}</p>
            </li>
          ))}
        </ol>
        <a
          href="#catalogo"
          className="mt-8 inline-block rounded-full bg-carbon px-5 py-2.5 text-sm font-medium text-arena transition hover:bg-black"
        >
          Ver las ofertas ↓
        </a>
      </div>
    </section>
  );
}
