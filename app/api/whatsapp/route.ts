import { after, type NextRequest } from "next/server";
import { getCurrentAlerts } from "@/lib/current-alerts";
import { subscriptions } from "@/lib/subscriptions";
import { normalizePhone, sendWhatsApp, verifySignature } from "@/lib/vonage";
import { handleCommand } from "@/lib/whatsapp";

interface InboundMessage {
  channel?: string;
  message_type?: string;
  from?: string;
  to?: string;
  text?: string;
}

const ok = () => new Response(null, { status: 200 });

/**
 * Webhook entrante de Vonage (mensajes y estados). Responde 200 enseguida;
 * la respuesta al usuario sale por una llamada aparte a la API de mensajes.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const secret = process.env.VONAGE_SIGNATURE_SECRET;
  if (secret) {
    const check = verifySignature(request.headers.get("authorization"), rawBody, secret, {
      apiKey: process.env.MASTER_KEY,
    });
    if (!check.ok) {
      console.warn("[whatsapp] Webhook rechazado:", check.reason);
      return new Response(null, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("[whatsapp] Falta VONAGE_SIGNATURE_SECRET: en producción no se aceptan webhooks sin firma.");
    return new Response(null, { status: 503 });
  } else {
    console.warn("[whatsapp] Sin VONAGE_SIGNATURE_SECRET: la firma no se valida (solo desarrollo).");
  }

  let message: InboundMessage;
  try {
    message = JSON.parse(rawBody);
  } catch {
    // Un 200 evita que Vonage reintente algo que nunca se va a poder leer.
    return ok();
  }

  // Los avisos de estado (entregado, leído) y los mensajes que no son texto se ignoran.
  const phone = message.from ? normalizePhone(message.from) : null;
  if (message.channel !== "whatsapp" || message.message_type !== "text" || !phone) return ok();

  const text = message.text ?? "";
  const from = message.to ? (normalizePhone(message.to) ?? undefined) : undefined;
  after(async () => {
    try {
      const reply = await handleCommand(text, {
        phone,
        store: subscriptions,
        getAlerts: () => getCurrentAlerts(),
      });
      await sendWhatsApp(phone, reply, { from });
    } catch (error) {
      console.error("[whatsapp]", error instanceof Error ? error.message : "error desconocido");
    }
  });
  return ok();
}
