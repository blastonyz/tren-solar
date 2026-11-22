import { TOWNS, findTown } from "./route";
import type { SubscriptionStore } from "./subscriptions";
import type { Alert, Severity } from "./types";

/** Comandos del webhook de WhatsApp (docs/SPEC.md, sección 9.4). */
export type Command =
  | { kind: "alerts"; townQuery?: string }
  | { kind: "subscribe"; townQuery?: string }
  | { kind: "unsubscribe" }
  | { kind: "help" };

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export function parseCommand(text: string): Command {
  const [word = "", ...rest] = normalize(text).split(" ");
  const argument = rest.join(" ") || undefined;
  if (word === "alertas" || word === "alerta") return { kind: "alerts", townQuery: argument };
  if (word === "suscribir" || word === "suscribirme" || word === "alta") {
    return { kind: "subscribe", townQuery: argument };
  }
  if (word === "baja" || word === "stop") return { kind: "unsubscribe" };
  return { kind: "help" };
}

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "CRÍTICA",
  warning: "Atención",
  info: "Info",
};

/** Una alerta en una línea, lista para WhatsApp. */
export function formatAlert(alert: Alert): string {
  const example = alert.simulated ? " (dato de ejemplo)" : "";
  return `${SEVERITY_LABEL[alert.severity]} · ${alert.town}: ${alert.message}${example}`;
}

const TOWN_NAMES = TOWNS.map((town) => town.name).join(", ");

export const HELP_TEXT = [
  "Tren Solar · alertas de la Quebrada.",
  "Escribí:",
  "• alertas",
  "• alertas <pueblo>",
  "• suscribir <pueblo>",
  "• baja",
  `Pueblos: ${TOWN_NAMES}.`,
].join("\n");

function alertList(alerts: Alert[], where?: string): string {
  if (alerts.length === 0) return `No hay alertas vigentes${where ? ` en ${where}` : ""}.`;
  const title = `Alertas vigentes${where ? ` en ${where}` : ""} (${alerts.length}):`;
  return [title, ...alerts.map((alert) => `• ${formatAlert(alert)}`)].join("\n");
}

export interface CommandContext {
  phone: string;
  store: SubscriptionStore;
  getAlerts: () => Promise<Alert[]>;
  now?: Date;
}

/** Ejecuta el comando recibido y devuelve el texto de la respuesta. */
export async function handleCommand(text: string, context: CommandContext): Promise<string> {
  const command = parseCommand(text);

  if (command.kind === "help") return HELP_TEXT;

  if (command.kind === "unsubscribe") {
    const removed = context.store.unsubscribe(context.phone);
    return removed > 0
      ? "Listo, ya no vas a recibir avisos. Para volver: suscribir <pueblo>."
      : "No tenías avisos activos.";
  }

  const town = command.townQuery ? findTown(command.townQuery) : undefined;
  if (command.townQuery && !town) {
    return `No conozco "${command.townQuery}". Pueblos: ${TOWN_NAMES}.`;
  }

  if (command.kind === "subscribe") {
    if (!town) return `¿De qué pueblo? Escribí: suscribir <pueblo>. Pueblos: ${TOWN_NAMES}.`;
    const { created } = context.store.subscribe(context.phone, town.id, context.now);
    const alerts = (await context.getAlerts()).filter((alert) => alert.townId === town.id);
    const head = created
      ? `Listo, te aviso de las alertas de ${town.name}.`
      : `Ya estabas suscripto a ${town.name}.`;
    return `${head}\n${alertList(alerts, town.name)}`;
  }

  const alerts = await context.getAlerts();
  return town
    ? alertList(
        alerts.filter((alert) => alert.townId === town.id),
        town.name,
      )
    : alertList(alerts);
}
