import { test } from "node:test";
import assert from "node:assert/strict";
import { distance, intlPhone, money, normalizePhone } from "../src/lib/format";
import { toE164 } from "../src/lib/notify";

test("mobile numbers from each country", () => {
  assert.equal(normalizePhone("92345678", "OM"), "96892345678");
  assert.equal(normalizePhone("0770 123 4567", "IQ"), "9647701234567");
  assert.equal(normalizePhone("+964 770 123 4567", "IQ"), "9647701234567");
  assert.equal(normalizePhone("٠٧٧٠١٢٣٤٥٦٧", "IQ"), "9647701234567");
  assert.equal(normalizePhone("55123456", "KW"), "96555123456");
  assert.equal(normalizePhone("36123456", "BH"), "97336123456");
  assert.equal(normalizePhone("03 123456", "LB"), "9613123456");
  assert.equal(normalizePhone("71 123 456", "LB"), "96171123456");
  assert.equal(normalizePhone("12345", "OM"), null);
  assert.equal(normalizePhone("6701234567", "IQ"), null);
});

test("international digits and E.164 for texting", () => {
  assert.equal(intlPhone("+964 770 123 4567"), "9647701234567");
  assert.equal(intlPhone("0096892345678"), "96892345678");
  assert.equal(intlPhone("92345678"), null); // no country code: unknown
  assert.equal(toE164("9647701234567"), "+9647701234567");
  assert.equal(toE164("not a phone"), null);
});

test("money in minor units", () => {
  assert.equal(money(125000, "USD", "en"), "$1,250.00");
  assert.equal(money(125000, "USD", "ar"), "1,250.00 $");
  assert.equal(money(1500000, "IQD", "ar"), "1,500,000 د.ع");
  assert.equal(money(null), "—");
});

test("distance to the shrine", () => {
  assert.equal(distance(150, "ar"), "150 م");
  assert.equal(distance(1250, "en"), "1.3 km");
});
