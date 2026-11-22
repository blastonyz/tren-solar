"use client";

import { useEffect, useRef, useState } from "react";
import { formatArs } from "@/data/catalog";
import { TOWNS } from "@/lib/route";
import type { Alert } from "@/lib/types";
import { useCatalog } from "./catalog-context";
import { useTrip } from "./trip";

type Step = "review" | "paying" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
  alerts: Alert[];
}

/** "Mi viaje": itinerario por estación, total y pago. El pago es simulado hasta conectar /api/checkout. */
export function TripDrawer({ open, onClose, alerts }: Props) {
  const trip = useTrip();
  const { byId } = useCatalog();
  const [step, setStep] = useState<Step>("review");
  const [orderCode, setOrderCode] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const lines = trip.items.flatMap((item) => {
    const listing = byId.get(item.listingId);
    return listing ? [{ item, listing }] : [];
  });
  const townIds = TOWNS.filter((t) => lines.some((l) => l.listing.townId === t.id)).map((t) => t.id);

  const pay = () => {
    setStep("paying");
    timer.current = setTimeout(() => {
      setOrderCode(`JUJ-${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
      setStep("done");
    }, 1800);
  };
  const finish = () => {
    trip.clear();
    setStep("review");
    onClose();
  };

  return (
    <div
      className={`pointer-events-none fixed inset-y-0 right-0 z-50 flex w-full max-w-md transition-transform duration-300 ${open ? "translate-x-0" : "invisible translate-x-full"}`}
      aria-hidden={!open}
    >
      <aside className="pointer-events-auto m-3 flex w-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/75 backdrop-blur-xl">
        <header className="flex items-center justify-between p-4">
          <h2 className="text-xl font-semibold">Mi viaje</h2>
          <button onClick={step === "done" ? finish : onClose} className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:border-white/50">
            {step === "done" ? "Listo" : "Cerrar"}
          </button>
        </header>

        {step === "done" ? (
          <div className="flex-1 space-y-4 overflow-y-auto p-4 pt-0">
            <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-4">
              <p className="text-sm font-medium text-emerald-100">Pago aprobado (prueba)</p>
              <p className="mt-1 text-xs text-white/70">Orden {orderCode} · {formatArs(trip.totalArs)}</p>
              <p className="mt-2 text-xs text-white/70">
                Te avisamos por WhatsApp con el resumen y las alertas de los pueblos del viaje. En esta demo el aviso se simula.
              </p>
            </div>
            <AlertsForTrip alerts={alerts} townIds={townIds} />
          </div>
        ) : lines.length === 0 ? (
          <p className="p-4 pt-0 text-sm text-white/60">Todavía no sumaste nada. Elegí una estación y sumá excursiones, hospedajes o productos.</p>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 pt-0">
              {TOWNS.filter((t) => townIds.includes(t.id)).map((town) => (
                <section key={town.id}>
                  <h3 className="mb-1.5 text-[11px] tracking-[0.25em] text-amber-100/70 uppercase">{town.name}</h3>
                  <ul className="space-y-2">
                    {lines.filter((l) => l.listing.townId === town.id).map(({ item, listing }) => (
                      <li key={listing.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="flex justify-between gap-3 text-sm">
                          <span>{listing.title}</span>
                          <span className="tabular-nums">{formatArs(listing.priceArs * item.qty)}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-white/60">
                          <span className="flex items-center gap-2">
                            <button aria-label="Restar uno" onClick={() => trip.setQty(listing.id, item.qty - 1)} className="h-6 w-6 rounded-full border border-white/25 hover:border-white/60">−</button>
                            <span className="w-4 text-center tabular-nums">{item.qty}</span>
                            <button aria-label="Sumar uno" onClick={() => trip.setQty(listing.id, item.qty + 1)} className="h-6 w-6 rounded-full border border-white/25 hover:border-white/60">+</button>
                          </span>
                          <button onClick={() => trip.remove(listing.id)} className="underline-offset-2 hover:underline">Quitar</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <AlertsForTrip alerts={alerts} townIds={townIds} />
            </div>
            <footer className="space-y-2 border-t border-white/10 p-4">
              <div className="flex justify-between text-sm"><span>Total</span><span className="font-semibold tabular-nums">{formatArs(trip.totalArs)}</span></div>
              <p className="text-xs text-emerald-200/90">{formatArs(Math.round(trip.communityArs))} quedan en las comunidades de la Quebrada</p>
              <button onClick={pay} disabled={step === "paying"} className="w-full rounded-lg bg-amber-300 px-4 py-2 text-sm font-medium text-black transition hover:bg-amber-200 disabled:opacity-60">
                {step === "paying" ? "Procesando pago…" : "Pagar con Mercado Pago (prueba)"}
              </button>
              <p className="text-center text-[10px] text-white/40">Entorno de prueba: no se cobra dinero real.</p>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

function AlertsForTrip({ alerts, townIds }: { alerts: Alert[]; townIds: string[] }) {
  const relevant = alerts.filter((a) => townIds.includes(a.townId));
  if (relevant.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] tracking-[0.25em] text-white/50 uppercase">Alertas en tu recorrido</h3>
      <ul className="space-y-1.5">
        {relevant.slice(0, 4).map((alert) => (
          <li key={alert.id} className="rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100">{alert.message}</li>
        ))}
      </ul>
    </section>
  );
}
