"use client";

import { useEffect, useState } from "react";
import { formatArs } from "@/data/catalog";
import { TOWNS } from "@/lib/route";
import type { Alert } from "@/lib/types";
import { useCatalog } from "./catalog-context";
import { useTrip } from "./trip";

type Step = "review" | "paying" | "wallet" | "done";
type Method = "mp" | "stripe" | "stellar";

const METHODS: Array<{ id: Method; label: string; hint: string }> = [
  { id: "mp", label: "Mercado Pago", hint: "Pesos" },
  { id: "stripe", label: "Tarjeta del exterior", hint: "USD, EUR o BRL" },
  { id: "stellar", label: "USDC (Stellar)", hint: "Desde tu wallet" },
];
const CARD_CURRENCIES = ["USD", "EUR", "BRL"];

interface WalletInfo {
  orderId: string;
  uri: string;
  destination: string;
  amount: string;
  memo: string;
  network: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onRequestOpen: () => void;
  alerts: Alert[];
}

/** "Mi viaje": itinerario por estación, total y pago con POST /api/checkout. Sin claves del proveedor el pago es simulado. */
export function TripDrawer({ open, onClose, onRequestOpen, alerts }: Props) {
  const trip = useTrip();
  const { byId } = useCatalog();
  const [step, setStep] = useState<Step>("review");
  const [orderCode, setOrderCode] = useState("");
  const [paidArs, setPaidArs] = useState<number | null>(null);
  const [paidLive, setPaidLive] = useState(false);
  const [method, setMethod] = useState<Method>("mp");
  const [currency, setCurrency] = useState("USD");
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Al volver de Mercado Pago o Stripe la URL trae ?order=...: confirmamos el pago contra el servidor.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order");
    if (!orderId) return;
    const sessionId = params.get("session_id");
    window.history.replaceState(null, "", window.location.pathname);
    let cancelled = false;
    (async () => {
      onRequestOpen();
      setStep("paying");
      setOrderCode(orderId);
      for (let attempt = 0; attempt < 8 && !cancelled; attempt++) {
        const res = await fetch(`/api/orders/${orderId}${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`).catch(() => null);
        const data = res?.ok ? ((await res.json()) as { status?: string }) : null;
        if (data?.status === "paid") {
          setPaidLive(true);
          setStep("done");
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!cancelled) {
        setNotice(`Todavía no vemos acreditado el pago de la orden ${orderId}. Si ya pagaste, puede demorar unos minutos.`);
        setStep("review");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Con USDC esperamos a que Horizon vea el pago con el memo de la orden.
  useEffect(() => {
    if (step !== "wallet" || !wallet) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/orders/${wallet.orderId}`).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { status?: string }) : null;
      if (data?.status === "paid") {
        setPaidLive(true);
        setStep("done");
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [step, wallet]);

  const lines = trip.items.flatMap((item) => {
    const listing = byId.get(item.listingId);
    return listing ? [{ item, listing }] : [];
  });
  const townIds = TOWNS.filter((t) => lines.some((l) => l.listing.townId === t.id)).map((t) => t.id);

  const pay = async () => {
    setStep("paying");
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: trip.items.map((i) => ({ id: i.listingId, qty: i.qty })),
          method,
          currency: method === "stripe" ? currency : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No pudimos iniciar el pago.");
      setOrderCode(data.orderId);
      setPaidArs(trip.totalArs);
      if (data.live && data.url) {
        window.location.assign(data.url);
        return;
      }
      if (data.live && data.stellar) {
        setWallet({ orderId: data.orderId, ...data.stellar });
        setStep("wallet");
        return;
      }
      // Sin claves del proveedor: pago de prueba.
      await fetch(`/api/orders/${data.orderId}/simulate`, { method: "POST" }).catch(() => null);
      setPaidLive(false);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos iniciar el pago.");
      setStep("review");
    }
  };
  const finish = () => {
    trip.clear();
    setStep("review");
    setWallet(null);
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
            <div className="rounded-xl border border-impact/30 bg-impact/10 p-4">
              <p className="text-sm font-medium text-impact">{paidLive ? "Pago aprobado" : "Pago aprobado (prueba)"}</p>
              <p className="mt-1 text-xs text-white/70">Orden {orderCode}{paidArs !== null ? ` · ${formatArs(paidArs)}` : ""}</p>
              <p className="mt-2 text-xs text-white/70">
                Te avisamos por WhatsApp con el resumen y las alertas de los pueblos del viaje. En esta demo el aviso se simula.
              </p>
            </div>
            <AlertsForTrip alerts={alerts} townIds={townIds} />
          </div>
        ) : step === "wallet" && wallet ? (
          <div className="flex-1 space-y-3 overflow-y-auto p-4 pt-0 text-sm">
            <p className="font-medium">Pagá {wallet.amount} USDC desde tu wallet</p>
            <p className="text-xs text-white/65">Red: {wallet.network}. Cuando llegue el pago, esta pantalla se actualiza sola.</p>
            <dl className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
              <div><dt className="text-white/50">Destino</dt><dd className="font-mono break-all">{wallet.destination}</dd></div>
              <div><dt className="text-white/50">Memo (obligatorio)</dt><dd className="font-mono">{wallet.memo}</dd></div>
            </dl>
            <a href={wallet.uri} className="block rounded-lg border border-solar/60 px-4 py-2 text-center text-xs text-amber-50 hover:bg-solar/10">Abrir en mi wallet</a>
            <button onClick={() => { setWallet(null); setStep("review"); }} className="text-xs text-white/60 underline-offset-2 hover:underline">Elegir otro medio</button>
          </div>
        ) : step === "paying" && lines.length === 0 ? (
          <p className="p-4 pt-0 text-sm text-white/70">Confirmando el pago de la orden {orderCode}…</p>
        ) : lines.length === 0 ? (
          <p className="p-4 pt-0 text-sm text-white/60">Todavía no sumaste nada. Elegí una estación y sumá excursiones, hospedajes o productos.</p>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 pt-0">
              {TOWNS.filter((t) => townIds.includes(t.id)).map((town) => (
                <section key={town.id}>
                  <h3 className="mb-1.5 text-[11px] tracking-[0.25em] text-arena/70 uppercase">{town.name}</h3>
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
              <p className="text-xs text-impact/90">{formatArs(Math.round(trip.communityArs))} quedan en las comunidades de la Quebrada</p>
              <fieldset className="space-y-1.5 pt-1">
                <legend className="mb-1 text-[11px] tracking-[0.2em] text-white/50 uppercase">Medio de pago</legend>
                <div className="grid grid-cols-3 gap-1.5">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      aria-pressed={method === m.id}
                      className={`rounded-lg border px-2 py-1.5 text-left text-[11px] leading-tight transition ${method === m.id ? "border-solar/80 bg-solar/15 text-amber-50" : "border-white/15 text-white/70 hover:border-white/40"}`}
                    >
                      <span className="block font-medium">{m.label}</span>
                      <span className="text-white/50">{m.hint}</span>
                    </button>
                  ))}
                </div>
                {method === "stripe" && (
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Moneda de la tarjeta" className="w-full rounded-lg border border-white/20 bg-black/40 px-2 py-1 text-xs text-white">
                    {CARD_CURRENCIES.map((c) => <option key={c} value={c}>Cobrar en {c}</option>)}
                  </select>
                )}
              </fieldset>
              {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
              {notice && <p className="text-xs text-arena">{notice}</p>}
              <button onClick={pay} disabled={step === "paying"} className="w-full rounded-lg bg-solar px-4 py-2 text-sm font-medium text-black transition hover:bg-solar disabled:opacity-60">
                {step === "paying" ? "Procesando pago…" : `Pagar con ${METHODS.find((m) => m.id === method)?.label}`}
              </button>
              <p className="text-center text-[10px] text-white/40">Sin claves del proveedor el pago es de prueba: no se cobra dinero real.</p>
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
          <li key={alert.id} className="rounded-lg border border-solar/25 bg-amber-400/10 px-3 py-1.5 text-xs text-arena">{alert.message}</li>
        ))}
      </ul>
    </section>
  );
}
