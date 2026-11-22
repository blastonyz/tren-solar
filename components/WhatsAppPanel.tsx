"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIES, formatArs } from "@/data/catalog";
import { TOWNS } from "@/lib/route";
import type { Alert, Category, Listing } from "@/lib/types";
import { useCatalog } from "./catalog-context";

/** Número compartido del Sandbox de Vonage. Se puede cambiar con NEXT_PUBLIC_SANDBOX_NUMBER. */
const SANDBOX_NUMBER = process.env.NEXT_PUBLIC_SANDBOX_NUMBER ?? "14157386102";
/** Solo se muestra si el equipo decide publicarla con NEXT_PUBLIC_PASS_PHRASE (es un valor visible para cualquiera). */
const PASS_PHRASE = process.env.NEXT_PUBLIC_PASS_PHRASE;

interface Props {
  open: boolean;
  onClose: () => void;
  alerts: Alert[];
  defaultTownId: string | null;
}

type Chat = { from: "user" | "bot"; text: string };

const CATEGORY_WORDS: Array<[Category, RegExp]> = [
  ["excursion", /caminata|excursi|paseo|trekking|gu[ií]a|cabalgata/i],
  ["lodging", /hospedaje|posada|habitaci|caba[ñn]a|alojamiento|hostel/i],
  ["food", /comida|empanada|almuerzo|cena|locro|humita|restaurante|pe[ñn]a/i],
  ["culture", /taller|ritual|museo|visita|cultura|ceremonia/i],
  ["transport", /traslado|bici|transporte|alquiler de/i],
  ["product", /tejid|artesan|cer[aá]mic|quinoa|queso|dulce|poncho|producto|lana|miel/i],
];

interface Draft {
  category: Category;
  townId: string;
  title: string;
  priceArs: number;
}

/**
 * Interpreta un mensaje libre de un oferente. En producción lo hace DeepSeek en el servidor
 * (docs/SPEC.md, 4.3); acá es un parser simple para poder ensayar el flujo sin mandar nada real.
 */
function parseOffer(text: string, fallbackTown: string): Draft {
  const category = CATEGORY_WORDS.find(([, re]) => re.test(text))?.[0] ?? "product";
  const lower = text.toLowerCase();
  const townId = TOWNS.find((t) => lower.includes(t.name.toLowerCase()))?.id ?? fallbackTown;
  const price = text.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{3,6})/);
  const priceArs = price ? Number(price[1].replace(/[.\s]/g, "")) : 0;
  const firstSentence = text.split(/[.\n]/)[0].trim().replace(/\s+/g, " ");
  const title = (firstSentence.length > 60 ? `${firstSentence.slice(0, 57)}…` : firstSentence) || "Oferta local";
  return { category, townId, title: title.charAt(0).toUpperCase() + title.slice(1), priceArs };
}

/** Respuestas del bot simulado: imitan los comandos de POST /api/whatsapp sin mandar nada real. */
function botReply(command: string, alerts: Alert[]): string {
  const [name, ...rest] = command.trim().toLowerCase().split(/\s+/);
  const wanted = rest.join(" ");
  const town = wanted ? TOWNS.find((t) => t.id === wanted || t.name.toLowerCase() === wanted) : undefined;
  if (name === "alertas") {
    if (wanted && !town) return `No conozco el pueblo "${wanted}".`;
    const list = alerts.filter((a) => !town || a.townId === town.id);
    return list.length ? list.slice(0, 5).map((a) => `• ${a.message}`).join("\n") : "No hay alertas vigentes.";
  }
  if (name === "suscribir") return town ? `Listo: te avisamos de las alertas de ${town.name}.` : "Decime el pueblo: suscribir tilcara";
  if (name === "baja") return "Listo: te di de baja de los avisos.";
  return "Comandos: alertas, alertas <pueblo>, suscribir <pueblo> y baja.";
}

export function WhatsAppPanel({ open, onClose, alerts, defaultTownId }: Props) {
  const [phone, setPhone] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  // Hasta que elija otro, el pueblo es el de la estación abierta.
  const townId = picked ?? defaultTownId ?? "tilcara";
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [chat, setChat] = useState<Chat[]>([]);
  const { publish } = useCatalog();
  const [pubChat, setPubChat] = useState<Chat[]>([]);
  const [pubStep, setPubStep] = useState<"idle" | "describe" | "confirm" | "done">("idle");
  const [pubText, setPubText] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const subscribe = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, town: townId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; town?: string; created?: boolean };
      setStatus(
        res.ok
          ? { ok: true, text: data.created ? `Listo: te avisamos de ${data.town}.` : `Ya estabas suscripto a ${data.town}.` }
          : { ok: false, text: data.error ?? "No se pudo suscribir." },
      );
    } catch {
      setStatus({ ok: false, text: "Sin conexión con la API. Probá de nuevo." });
    } finally {
      setSending(false);
    }
  };

  const say = (lines: Chat[]) => setPubChat((prev) => [...prev, ...lines]);

  const startPublishing = () => {
    setPubChat([
      { from: "bot", text: "¡Hola! ¿Sos turista o local?" },
      { from: "user", text: "Soy local" },
      { from: "bot", text: "Genial. Contame qué ofrecés: qué es, en qué pueblo y cuánto cuesta." },
    ]);
    setPubStep("describe");
    setDraft(null);
  };

  const sendOffer = (event: FormEvent) => {
    event.preventDefault();
    const text = pubText.trim();
    if (!text) return;
    const parsed = parseOffer(text, townId);
    setDraft(parsed);
    setPubText("");
    const town = TOWNS.find((t) => t.id === parsed.townId);
    const category = CATEGORIES.find((c) => c.id === parsed.category);
    if (!parsed.priceArs) {
      say([
        { from: "user", text },
        { from: "bot", text: "¿Cuánto cuesta? Escribí el precio en pesos, por ejemplo 12000." },
      ]);
      setDraft({ ...parsed });
      return;
    }
    say([
      { from: "user", text },
      {
        from: "bot",
        text: `Entendí esto:\n• ${parsed.title}\n• Categoría: ${category?.label}\n• Pueblo: ${town?.name}\n• Precio: ${formatArs(parsed.priceArs)}\n¿Publico?`,
      },
    ]);
    setPubStep("confirm");
  };

  const confirmPublish = (yes: boolean) => {
    if (!draft) return;
    if (!yes) {
      say([{ from: "user", text: "No" }, { from: "bot", text: "Listo, no publiqué nada. Escribí de nuevo lo que ofrecés cuando quieras." }]);
      setPubStep("describe");
      return;
    }
    const id = Math.random().toString(36).slice(2, 7);
    const town = TOWNS.find((t) => t.id === draft.townId);
    const listing: Listing = {
      id: `wa-${id}`,
      category: draft.category,
      townId: draft.townId,
      providerId: `wa-prov-${id}`,
      title: draft.title,
      summary: "Publicada por su oferente a través del canal de WhatsApp.",
      images: [],
      priceArs: draft.priceArs,
      priceUnit: "unidad",
      communityShare: 0.9,
      location: town?.location ?? { lat: -23.5, lng: -65.4 },
      extra: { source: "whatsapp" },
    };
    publish(listing, {
      id: listing.providerId,
      name: `Oferente local de ${town?.name ?? "la Quebrada"}`,
      kind: "emprendedor",
      story: "Se sumó por WhatsApp y publicó su oferta desde el celular.",
    });
    say([
      { from: "user", text: "Sí, publicá" },
      { from: "bot", text: `Publicada. Código JUJ-${id.toUpperCase()}. Ya aparece en el catálogo. Escribí "mis ofertas" para gestionarla.` },
    ]);
    setPubStep("done");
  };

  const ask = (command: string) => setChat((prev) => [...prev, { from: "user", text: command }, { from: "bot", text: botReply(command, alerts) }]);

  return (
    <div
      className={`pointer-events-none fixed inset-y-0 right-0 z-50 flex w-full max-w-md transition-transform duration-300 ${open ? "translate-x-0" : "invisible translate-x-full"}`}
      aria-hidden={!open}
    >
      <aside className="pointer-events-auto m-3 flex w-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/75 backdrop-blur-xl">
        <header className="flex items-center justify-between p-4">
          <h2 className="text-xl font-semibold">Avisos por WhatsApp</h2>
          <button onClick={onClose} className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:border-white/50">Cerrar</button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 pt-0 text-sm">
          <section className="space-y-1 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/75">
            <p className="text-white/90">Antes de suscribirte (Sandbox de prueba)</p>
            <p>
              Mandá la frase de acceso al número <span className="font-medium text-white">+{SANDBOX_NUMBER}</span> desde tu WhatsApp.
              {PASS_PHRASE ? <> La frase es: <span className="font-medium text-amber-100">{PASS_PHRASE}</span>.</> : " Pedísela al equipo."}
            </p>
            <p className="text-white/45">El Sandbox solo le escribe a teléfonos autorizados.</p>
          </section>

          <form onSubmit={subscribe} className="space-y-2">
            <label className="block text-xs text-white/60">
              Tu número (formato internacional)
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="+54 9 388 412 3456"
                className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-200/70"
              />
            </label>
            <label className="block text-xs text-white/60">
              Pueblo
              <select
                value={townId}
                onChange={(e) => setPicked(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-200/70"
              >
                {TOWNS.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <button disabled={sending || !phone.trim()} className="w-full rounded-lg bg-amber-300 px-4 py-2 text-sm font-medium text-black transition hover:bg-amber-200 disabled:opacity-50">
              {sending ? "Enviando…" : "Suscribirme"}
            </button>
            {status && <p className={`text-xs ${status.ok ? "text-emerald-200" : "text-red-200"}`}>{status.text}</p>}
          </form>

          <section>
            <h3 className="mb-2 text-[11px] tracking-[0.25em] text-white/50 uppercase">Probar el bot (simulado)</h3>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {["alertas", `alertas ${defaultTownId ?? "tilcara"}`, `suscribir ${defaultTownId ?? "tilcara"}`, "baja"].map((command) => (
                <button key={command} onClick={() => ask(command)} className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/75 hover:border-white/50">
                  {command}
                </button>
              ))}
            </div>
            <ul className="space-y-1.5">
              {chat.slice(-8).map((line, i) => (
                <li key={i} className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs whitespace-pre-line ${line.from === "user" ? "ml-auto bg-emerald-500/25 text-emerald-50" : "bg-white/10 text-white/85"}`}>
                  {line.text}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-white/40">No manda mensajes reales: sirve para ensayar sin gastar el cupo del Sandbox.</p>
          </section>

          <section>
            <h3 className="mb-2 text-[11px] tracking-[0.25em] text-white/50 uppercase">Publicar una oferta (simulado)</h3>
            {pubStep === "idle" ? (
              <button onClick={startPublishing} className="rounded-lg border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-100 hover:bg-emerald-400/20">
                Soy local y quiero publicar lo mío
              </button>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {pubChat.map((line, i) => (
                    <li key={i} className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs whitespace-pre-line ${line.from === "user" ? "ml-auto bg-emerald-500/25 text-emerald-50" : "bg-white/10 text-white/85"}`}>
                      {line.text}
                    </li>
                  ))}
                </ul>
                {pubStep === "describe" && (
                  <form onSubmit={sendOffer} className="mt-2 flex gap-2">
                    <input
                      value={pubText}
                      onChange={(e) => setPubText(e.target.value)}
                      placeholder="Ej: Tejidos en lana de llama en Tilcara, 28000"
                      className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-amber-200/70"
                    />
                    <button disabled={!pubText.trim()} className="rounded-lg bg-amber-300 px-3 py-2 text-xs font-medium text-black disabled:opacity-50">Enviar</button>
                  </form>
                )}
                {pubStep === "confirm" && (
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => confirmPublish(true)} className="rounded-full bg-amber-300 px-4 py-1.5 text-xs font-medium text-black">Sí, publicar</button>
                    <button onClick={() => confirmPublish(false)} className="rounded-full border border-white/25 px-4 py-1.5 text-xs text-white/75">No</button>
                  </div>
                )}
                {pubStep === "done" && (
                  <button onClick={startPublishing} className="mt-2 rounded-full border border-white/25 px-4 py-1.5 text-xs text-white/75">Publicar otra</button>
                )}
              </>
            )}
            <p className="mt-2 text-[10px] text-white/40">Simulado: en producción un modelo (DeepSeek) interpreta el mensaje en el servidor y el servidor valida antes de publicar.</p>
          </section>
        </div>
      </aside>
    </div>
  );
}
