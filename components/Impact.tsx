"use client";

import { useMemo } from "react";
import { useCatalog } from "./catalog-context";

/** Capa de transparencia: lo que muestra el catálogo de ejemplo. Los datos verificables llegan con las órdenes pagas. */
export function Impact() {
  const { listings, providers } = useCatalog();
  const stats = useMemo(() => {
    const withOffers = providers.filter((p) => listings.some((l) => l.providerId === p.id));
    const communities = withOffers.filter((p) => p.kind === "comunidad").length;
    const share = listings.length ? listings.reduce((sum, l) => sum + l.communityShare, 0) / listings.length : 0;
    return [
      { label: "Productores y comunidades", value: String(withOffers.length) },
      { label: "Comunidades originarias y vecinales", value: String(communities) },
      { label: "Ofertas publicadas", value: String(listings.length) },
      { label: "Promedio que queda en la comunidad", value: `${Math.round(share * 100)}%` },
    ];
  }, [listings, providers]);

  return (
    <section className="relative z-10 bg-carbon px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] tracking-[0.35em] text-impact uppercase">Impacto</p>
        <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Transparencia sobre a dónde va la plata</h2>
        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <dd className="text-3xl font-semibold text-impact tabular-nums">{s.value}</dd>
              <dt className="mt-1 text-xs text-white/60">{s.label}</dt>
              <span className="mt-3 inline-block rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-white/55">Simulado · catálogo de ejemplo</span>
            </div>
          ))}
        </dl>
        <p className="mt-5 max-w-2xl text-xs text-white/50">
          Todavía no hay pagos reales registrados. Cuando existan, acá se van a mostrar los ingresos que llegaron a las comunidades y las
          transacciones verificables, separados de estos números de ejemplo.
        </p>
      </div>
    </section>
  );
}
