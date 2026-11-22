import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { test } from "node:test";
import { SANDBOX_URL, normalizePhone, sendWhatsApp, verifySignature } from "../lib/vonage";

const SECRET = "secreto-de-firma";
const now = new Date("2026-11-22T15:00:00Z");
const nowS = Math.floor(now.getTime() / 1000);

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

function sign(claims: object, secret = SECRET, header: object = { alg: "HS256", typ: "JWT" }) {
  const unsigned = `${b64(header)}.${b64(claims)}`;
  return `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
}

const body = JSON.stringify({ channel: "whatsapp", text: "alertas" });
const hash = createHash("sha256").update(body).digest("hex");

test("normalizePhone deja solo dígitos con código de país", () => {
  assert.equal(normalizePhone("+54 9 388 412-3456"), "5493884123456");
  assert.equal(normalizePhone("005493884123456"), "5493884123456");
  assert.equal(normalizePhone("123"), null);
  assert.equal(normalizePhone("hola"), null);
});

test("sendWhatsApp usa el Sandbox con autenticación Basic", async () => {
  let request: { url: string; init: RequestInit } | undefined;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    request = { url, init };
    return Response.json({ message_uuid: "abc" }, { status: 202 });
  }) as unknown as typeof fetch;

  const result = await sendWhatsApp("5493884123456", "hola", {
    credentials: { apiKey: "key", apiSecret: "secret" },
    from: "14157386102",
    fetchImpl,
  });

  assert.deepEqual(result, { to: "5493884123456", sent: true, simulated: false, messageUuid: "abc" });
  assert.equal(request?.url, SANDBOX_URL);
  const headers = request?.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Basic ${Buffer.from("key:secret").toString("base64")}`);
  assert.deepEqual(JSON.parse(String(request?.init.body)), {
    from: "14157386102",
    to: "5493884123456",
    channel: "whatsapp",
    message_type: "text",
    text: "hola",
  });
});

test("sendWhatsApp sin credenciales simula y con error no tira", async () => {
  assert.deepEqual(await sendWhatsApp("5493884123456", "hola", { credentials: null }), {
    to: "5493884123456",
    sent: false,
    simulated: true,
  });
  const failing = (async () =>
    Response.json({ title: "Unauthorized" }, { status: 401 })) as unknown as typeof fetch;
  const result = await sendWhatsApp("5493884123456", "hola", {
    credentials: { apiKey: "k", apiSecret: "s" },
    fetchImpl: failing,
  });
  assert.equal(result.sent, false);
  assert.match(result.error ?? "", /401/);
});

test("verifySignature acepta un JWT válido con el hash del cuerpo", () => {
  const token = sign({ iat: nowS, payload_hash: hash, api_key: "key" });
  assert.deepEqual(verifySignature(`Bearer ${token}`, body, SECRET, { apiKey: "key", now }), { ok: true });
});

test("verifySignature rechaza firmas falsas, cuerpos cambiados y tokens viejos", () => {
  const check = (authorization: string | null, raw = body) =>
    verifySignature(authorization, raw, SECRET, { apiKey: "key", now });

  assert.equal(check(null).ok, false);
  assert.equal(check(`Bearer ${sign({ iat: nowS, payload_hash: hash }, "otro")}`).ok, false);
  assert.equal(check(`Bearer ${sign({ iat: nowS, payload_hash: hash })}`, `${body} `).ok, false);
  assert.equal(check(`Bearer ${sign({ iat: nowS - 3600, payload_hash: hash })}`).ok, false);
  assert.equal(check(`Bearer ${sign({ iat: nowS, api_key: "otra" })}`).ok, false);
  assert.equal(check(`Bearer ${sign({ iat: nowS }, SECRET, { alg: "none" })}`).ok, false);
  assert.equal(check("Bearer a.b").ok, false);
});
