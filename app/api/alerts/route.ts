import { connection } from "next/server";
import { buildAlerts } from "@/lib/alerts";
import { getFires } from "@/lib/fires";
import { simulateTelemetry } from "@/lib/telemetry";
import { getWeather } from "@/lib/weather";

/** Alertas vigentes de crecida, fuego y aglomeración, ordenadas por severidad. */
export async function GET() {
  await connection();
  try {
    const now = new Date();
    const [weather, fires] = await Promise.all([getWeather(), getFires()]);
    const alerts = buildAlerts({ now, telemetry: simulateTelemetry(now), weather, fires });
    return Response.json(alerts, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[alerts]", error instanceof Error ? error.message : "error desconocido");
    return Response.json({ error: "No se pudieron calcular las alertas." }, { status: 503 });
  }
}
