const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  BCCR_USD_CRC_INDICATOR,
  BCCR_EUR_USD_INDICATOR,
  parseBccrObservation,
  resolveBccrObservations
} = require("../lib/historical-fx.ts");

const response = (date, value) => ({ estado: true, datos: [{ series: [{ fecha: date, valorDatoPorPeriodo: value }] }] });

test("validates and preserves an exact-date BCCR observation", () => {
  assert.deepEqual(parseBccrObservation(response("2026-09-30", 501.123456), 318, "2026-09-30"), {
    indicator: 318,
    effectiveDate: "2026-09-30",
    rawValue: "501.123456"
  });
});

test("rejects failed, missing, duplicate, wrong-date and non-positive BCCR data", () => {
  const invalid = [
    { estado: false, datos: [] },
    { estado: true, datos: [] },
    response("2026-09-29", 500),
    { estado: true, datos: [{ series: [
      { fecha: "2026-09-30", valorDatoPorPeriodo: 500 },
      { fecha: "2026-09-30", valorDatoPorPeriodo: 501 }
    ] }] },
    response("2026-09-30", 0)
  ];
  for (const payload of invalid) assert.throws(() => parseBccrObservation(payload, 318, "2026-09-30"));
});

test("requests 318 for CRC/USD and both 318 and 333 for EUR without exposing the token in the URL", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    const indicator = url.includes("/333/") ? 333 : 318;
    return { ok: true, json: async () => response("2026-09-30", indicator === 318 ? 500 : 1.1) };
  };
  const resolved = await resolveBccrObservations("server-secret", "EUR", "2026-09-30", fetcher);
  assert.equal(resolved.usdCrc.indicator, BCCR_USD_CRC_INDICATOR);
  assert.equal(resolved.eurUsd.indicator, BCCR_EUR_USD_INDICATOR);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.options.headers.Authorization === "Bearer server-secret"));
  assert.ok(calls.every(call => !call.url.includes("server-secret")));
});

test("does not invent a rate when BCCR fails", async () => {
  const fetcher = async () => ({ ok: false, status: 503, json: async () => ({}) });
  await assert.rejects(() => resolveBccrObservations("server-secret", "USD", "2026-09-30", fetcher));
});
