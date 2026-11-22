"use client";

import { ROUTE_LENGTH_KM, TOWNS } from "@/lib/route";
import type { Alert, Severity, Telemetry } from "@/lib/types";

const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };
const DOT_STYLE: Record<Severity | "none", string> = {
  none: "bg-white/70",
  info: "bg-sky-300",
  warning: "bg-solar",
  critical: "bg-red-400",
};

function worstSeverity(alerts: Alert[], townId: string): Severity | "none" {
  let worst: Severity | "none" = "none";
  for (const alert of alerts) {
    if (alert.townId !== townId) continue;
    if (worst === "none" || SEVERITY_RANK[alert.severity] > SEVERITY_RANK[worst]) worst = alert.severity;
  }
  return worst;
}

interface Props {
  selectedId: string | null;
  onSelect: (townId: string) => void;
  telemetry: Telemetry | null;
  alerts: Alert[];
}

/** Recorrido del tren: una línea con las estaciones clickeables y el tren moviéndose en vivo. */
export function RouteBar({ selectedId, onSelect, telemetry, alerts }: Props) {
  const progress = telemetry?.train.progress ?? 0;
  return (
    <div className="pointer-events-auto rounded-2xl border border-white/15 bg-black/45 px-5 pt-4 pb-3 backdrop-blur-md">
      <div className="relative mx-4 h-14">
        <div className="absolute top-5 right-0 left-0 h-0.5 rounded bg-white/25" />
        {TOWNS.map((town) => {
          const left = `${(town.kmFromStart / ROUTE_LENGTH_KM) * 100}%`;
          const active = town.id === selectedId;
          const occupancy = telemetry?.towns.find((t) => t.townId === town.id)?.occupancyPct;
          return (
            <button
              key={town.id}
              onClick={() => onSelect(town.id)}
              aria-label={`Ir a ${town.name}`}
              aria-pressed={active}
              style={{ left }}
              className="group absolute top-0 flex -translate-x-1/2 flex-col items-center"
            >
              <span
                className={`block h-[18px] w-[18px] rounded-full border-2 transition ${
                  active ? "scale-125 border-solar bg-solar/30" : "border-white/60 bg-black/50 group-hover:border-white"
                }`}
              >
                <span className={`m-[3px] block h-2 w-2 rounded-full ${DOT_STYLE[worstSeverity(alerts, town.id)]}`} />
              </span>
              <span className={`mt-1.5 text-[11px] whitespace-nowrap ${active ? "text-arena" : "text-white/70"}`}>
                {town.name}
              </span>
              {occupancy !== undefined && <span className="text-[10px] text-white/40 tabular-nums">{occupancy}%</span>}
            </button>
          );
        })}
        <div
          aria-hidden
          className="pointer-events-none absolute top-[14px] h-3.5 w-5 -translate-x-1/2 rounded-sm bg-solar shadow-[0_0_14px_rgba(251,191,36,0.8)] transition-[left] duration-[4000ms] ease-linear"
          style={{ left: `${progress * 100}%` }}
        />
      </div>
      <p className="mt-1 text-center text-[10px] tracking-widest text-white/40 uppercase">
        Tren Solar en vivo (simulado) · punto de color: alertas vigentes
      </p>
    </div>
  );
}
