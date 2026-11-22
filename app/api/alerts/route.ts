import { connection } from "next/server";
import { getCurrentAlerts } from "@/lib/current-alerts";

/** Alertas vigentes de crecida, fuego y aglomeración, ordenadas por severidad. */
export async function GET() {
  await connection();
  try {
    const alerts = await getCurrentAlerts();
    return Response.json(alerts, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[alerts]", error instanceof Error ? error.message : "error desconocido");
    return Response.json({ error: "No se pudieron calcular las alertas." }, { status: 503 });
  }
}
