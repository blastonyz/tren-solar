import { buildAlerts } from "./alerts";
import { getFires } from "./fires";
import { simulateTelemetry } from "./telemetry";
import type { Alert } from "./types";
import { getWeather } from "./weather";

/** Alertas vigentes con los datos del momento (o sus fixtures). */
export async function getCurrentAlerts(now: Date = new Date()): Promise<Alert[]> {
  const [weather, fires] = await Promise.all([getWeather(), getFires()]);
  return buildAlerts({ now, telemetry: simulateTelemetry(now), weather, fires });
}
