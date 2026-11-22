"use client";

import { useEffect, useState } from "react";
import type { Alert, Telemetry } from "@/lib/types";

/** Consulta una ruta de la API cada tanto. Si falla, conserva el último dato recibido. */
function usePolling<T>(url: string, everyMs: number): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as T;
        if (alive) setData(json);
      } catch {
        // Sin conexión: se mantiene lo último que llegó.
      }
    };
    void load();
    const id = setInterval(load, everyMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url, everyMs]);
  return data;
}

export const useTelemetry = () => usePolling<Telemetry>("/api/telemetry", 4000);
export const useAlerts = () => usePolling<Alert[]>("/api/alerts", 30000);
