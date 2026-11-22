"use client";

import { useEffect, useState } from "react";
import type { Telemetry } from "@/lib/types";

const TOWNS = [
  { name: "Purmamarca", base: 92 },
  { name: "Tilcara", base: 85 },
  { name: "Humahuaca", base: 64 },
  { name: "Maimará", base: 38 },
  { name: "Uquía", base: 21 },
];

const wave = (t: number, phase: number, amp: number) => Math.sin(t / 3 + phase) * amp;

export function Hud({ telemetry }: { telemetry: Telemetry | null }) {
  const [t, setT] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setT((v) => v + 1), 1500);
    return () => clearInterval(id);
  }, []);

  const solar = telemetry?.train.solarKw ?? 38 + wave(t, 0, 6);
  const battery = telemetry?.train.batteryPct ?? 78 + wave(t, 1, 4);
  const passengers = telemetry?.train.passengers ?? Math.round(118 + wave(t, 2, 9));

  const rows = telemetry
    ? telemetry.towns.filter((town) => town.townId !== "volcan").map((town) => ({ name: town.town, pct: town.occupancyPct }))
    : TOWNS.map((town, i) => ({ name: town.name, pct: Math.max(5, Math.min(100, Math.round(town.base + wave(t, i, 4)))) }));

  return (
    <aside className="pointer-events-auto w-full rounded-2xl border border-white/15 bg-black/40 p-4 backdrop-blur-md sm:w-80">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] tracking-[0.25em] text-white/60 uppercase">Telemetría</span>
        <span className="rounded-full bg-amber-200/15 px-2 py-0.5 text-[10px] text-amber-100">
          datos simulados
        </span>
      </div>

      <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Solar" value={`${solar.toFixed(1)} kW`} />
        <Stat label="Batería" value={`${battery.toFixed(0)}%`} />
        <Stat label="A bordo" value={`${passengers}`} />
      </dl>

      <p className="mb-2 text-[11px] tracking-[0.2em] text-white/50 uppercase">
        Ocupación por pueblo
      </p>
      <ul className="space-y-2">
        {rows.map((town) => {
          const pct = town.pct;
          return (
            <li key={town.name}>
              <div className="flex justify-between text-xs text-white/80">
                <span>{town.name}</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-200 to-orange-500 transition-all duration-1000"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-2 py-2">
      <dt className="text-[10px] tracking-widest text-white/50 uppercase">{label}</dt>
      <dd className="mt-1 text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
