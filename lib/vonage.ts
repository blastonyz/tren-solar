import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Vonage Messages API Sandbox por WhatsApp (docs/SPEC.md, sección 9.4).
 * Las credenciales se leen solo en el servidor y nunca se escriben en logs.
 */

export const SANDBOX_URL = "https://messages-sandbox.nexmo.com/v1/messages";
/** Número compartido del Sandbox de WhatsApp; se puede cambiar con `VONAGE_WHATSAPP_NUMBER`. */
export const SANDBOX_NUMBER = "14157386102";
const TIMEOUT_MS = 8000;
/** Un webhook firmado hace más de esto se rechaza (defensa contra repeticiones). */
const MAX_TOKEN_AGE_S = 5 * 60;

export interface VonageCredentials {
  /** `MASTER_KEY`: la clave de API, usuario de la autenticación Basic. */
  apiKey: string;
  /** `VONAGE_API_KEY`: el secreto de la cuenta, contraseña de la autenticación Basic. */
  apiSecret: string;
}

export function credentialsFromEnv(env: NodeJS.ProcessEnv = process.env): VonageCredentials | null {
  const apiKey = env.MASTER_KEY;
  const apiSecret = env.VONAGE_API_KEY;
  return apiKey && apiSecret ? { apiKey, apiSecret } : null;
}

/** Solo dígitos, con código de país y sin "+", como lo pide Vonage. `null` si no parece un teléfono. */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/[\s\-().]/g, "").replace(/^\+|^00/, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export interface SendResult {
  to: string;
  sent: boolean;
  /** true si no hay credenciales y el mensaje solo se escribió en el log del servidor. */
  simulated: boolean;
  messageUuid?: string;
  error?: string;
}

export interface SendOptions {
  credentials?: VonageCredentials | null;
  from?: string;
  fetchImpl?: typeof fetch;
}

/** Manda un texto por WhatsApp. Sin credenciales no falla: lo simula. */
export async function sendWhatsApp(
  to: string,
  text: string,
  options: SendOptions = {},
): Promise<SendResult> {
  const credentials = "credentials" in options ? options.credentials : credentialsFromEnv();
  const from = options.from ?? process.env.VONAGE_WHATSAPP_NUMBER ?? SANDBOX_NUMBER;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!credentials) {
    console.info(`[vonage] Sin credenciales: mensaje simulado a ...${to.slice(-4)}.`);
    return { to, sent: false, simulated: true };
  }

  const auth = Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString("base64");
  try {
    const response = await fetchImpl(SANDBOX_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ from, to, channel: "whatsapp", message_type: "text", text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => ({}))) as {
      message_uuid?: string;
      title?: string;
      detail?: string;
    };
    if (!response.ok) {
      const error = `Vonage respondió ${response.status}${body.title ? `: ${body.title}` : ""}.`;
      console.warn("[vonage]", error);
      return { to, sent: false, simulated: false, error };
    }
    return { to, sent: true, simulated: false, messageUuid: body.message_uuid };
  } catch (error) {
    const message = error instanceof Error ? error.message : "error desconocido";
    console.warn("[vonage] No se pudo enviar.", message);
    return { to, sent: false, simulated: false, error: message };
  }
}

const base64url = (input: string) => Buffer.from(input, "base64url");

export type SignatureCheck = { ok: true } | { ok: false; reason: string };

/**
 * Valida el JWT (HS256) que Vonage manda en `Authorization: Bearer` con el secreto de firma
 * de la cuenta, y que `payload_hash` sea el SHA-256 del cuerpo recibido.
 */
export function verifySignature(
  authorization: string | null,
  rawBody: string,
  signatureSecret: string,
  options: { apiKey?: string; now?: Date } = {},
): SignatureCheck {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return { ok: false, reason: "Falta el JWT en Authorization." };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "JWT mal formado." };
  const [header64, payload64, signature64] = parts;

  let header: { alg?: string };
  let claims: { iat?: number; exp?: number; nbf?: number; payload_hash?: string; api_key?: string };
  try {
    header = JSON.parse(base64url(header64).toString("utf8"));
    claims = JSON.parse(base64url(payload64).toString("utf8"));
  } catch {
    return { ok: false, reason: "JWT mal formado." };
  }
  if (header.alg !== "HS256") return { ok: false, reason: "Algoritmo de firma inesperado." };

  const expected = createHmac("sha256", signatureSecret).update(`${header64}.${payload64}`).digest();
  const received = base64url(signature64);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: "Firma inválida." };
  }

  const nowS = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (typeof claims.exp === "number" && nowS > claims.exp) return { ok: false, reason: "JWT vencido." };
  if (typeof claims.nbf === "number" && nowS + 60 < claims.nbf) {
    return { ok: false, reason: "JWT todavía no es válido." };
  }
  if (typeof claims.iat === "number" && nowS - claims.iat > MAX_TOKEN_AGE_S) {
    return { ok: false, reason: "JWT demasiado viejo." };
  }
  if (options.apiKey && claims.api_key && claims.api_key !== options.apiKey) {
    return { ok: false, reason: "El JWT es de otra cuenta." };
  }
  if (claims.payload_hash) {
    const hash = createHash("sha256").update(rawBody).digest("hex");
    if (hash !== claims.payload_hash.toLowerCase()) {
      return { ok: false, reason: "El cuerpo no coincide con la firma." };
    }
  }
  return { ok: true };
}
