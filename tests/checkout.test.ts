import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOrder, parseCheckoutBody, type PricedListing } from "../lib/checkout";
import { chargeCurrency } from "../lib/payments/types";

const catalog = new Map<string, PricedListing>([
  ["a", { id: "a", title: "Excursión", priceArs: 10000, communityShare: 0.5 }],
  ["b", { id: "b", title: "Quinoa", priceArs: 2000, communityShare: 1 }],
]);
const lookup = (id: string) => catalog.get(id);

test("parseCheckoutBody rechaza pedidos mal formados", () => {
  assert.equal(parseCheckoutBody(null), null);
  assert.equal(parseCheckoutBody({ items: [], method: "mp" }), null);
  assert.equal(parseCheckoutBody({ items: [{ id: "a", qty: 0 }], method: "mp" }), null);
  assert.equal(parseCheckoutBody({ items: [{ id: "a", qty: 1 }], method: "paypal" }), null);
  assert.equal(parseCheckoutBody({ items: [{ id: "a", qty: 1.5 }], method: "mp" }), null);
});

test("el precio sale del catálogo y se suman los ítems repetidos", async () => {
  const input = parseCheckoutBody({ items: [{ id: "a", qty: 1 }, { id: "a", qty: 1 }, { id: "b", qty: 3 }], method: "mp", price: 1 });
  assert.ok(input);
  const built = await buildOrder(input, lookup);
  assert.ok(built.ok);
  assert.equal(built.order.totalArs, 26000);
  assert.equal(built.order.communityArs, 16000);
  assert.equal(built.order.lines.length, 2);
  assert.equal(built.order.currency, "ARS");
  assert.equal(built.order.amount, 26000);
  assert.equal(built.order.status, "pending");
});

test("un ítem que no está en el catálogo se rechaza", async () => {
  const input = parseCheckoutBody({ items: [{ id: "zzz", qty: 1 }], method: "mp" });
  assert.ok(input);
  const built = await buildOrder(input, lookup);
  assert.equal(built.ok, false);
});

test("la moneda de cobro depende del medio", () => {
  assert.equal(chargeCurrency("mp", "EUR"), "ARS");
  assert.equal(chargeCurrency("stellar", "EUR"), "USD");
  assert.equal(chargeCurrency("stripe", "EUR"), "EUR");
  assert.equal(chargeCurrency("stripe", "CLP"), "USD");
});
