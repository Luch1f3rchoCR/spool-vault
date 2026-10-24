const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadReportValuations, matchReportValuation, missingReportRates, requestReportRate, summarizeValuations, valuationAmount, valuationNote, valuationCsvCells } = require("../lib/inventory-valuation-report.ts");

const row = { roll_id: "roll-1", user_id: "owner", status: "open", initial_weight_g: 1000, available_weight_g: 500 };
const value = { ...row, original_currency: "USD", remaining_original_value: 10, remaining_crc_value: 5000, remaining_usd_value: 10, fx_status: "complete", incompleteness_reason: null, acquisition_date: "2026-09-30", fx_source: "BCCR", cost_basis_source: "purchase_order_landed", cost_confidence: "actual" };

test("keeps historical currencies separate and totals only the filtered non-archived rows", () => {
  const archived = { ...row, roll_id: "old", status: "archived" };
  const unrelated = { ...value, roll_id: "filtered-out", remaining_crc_value: 99999 };
  assert.deepEqual(summarizeValuations([row, archived], new Map([[row.roll_id, value], [unrelated.roll_id, unrelated]])), [
    { currency: "CRC", total: 5000, included: 1, missing: 0 },
    { currency: "USD", total: 10, included: 1, missing: 0 }
  ]);
});

test("only offers distinct pending dates/currencies for visible, matching active rolls", () => {
  const second = { ...row, roll_id: "roll-2" };
  const pending = { ...value, fx_status: "incomplete", incompleteness_reason: "missing_fx_snapshot" };
  const map = new Map([[row.roll_id, pending], [second.roll_id, { ...pending, roll_id: second.roll_id }]]);
  assert.deepEqual(missingReportRates([row, second], map), [["2026-09-30:USD", { acquisition_date: "2026-09-30", source_currency: "USD" }]]);
  for (const patch of [{ incompleteness_reason: "missing_cost" }, { original_currency: "JPY" }, { acquisition_date: null }, { status: "archived" }, { available_weight_g: 12 }]) {
    assert.deepEqual(missingReportRates([row], new Map([[row.roll_id, { ...pending, ...patch }]])), []);
  }
  assert.deepEqual(missingReportRates([], map), []);
});

const fxRequest = { acquisition_date: "2026-09-30", source_currency: "USD" };
const sessionClient = { auth: { getSession: async () => ({ data: { session: { access_token: "fixture", user: { id: "owner" } } }, error: null }) } };
const snapshot = { id: "snapshot-1", user_id: "owner", source: "BCCR", ...fxRequest };
test("requests only the existing same-origin endpoint with session bearer and stable retry payload", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push([url, options]);
    return Response.json({ snapshot, reused: calls.length > 1 });
  };
  assert.deepEqual(await requestReportRate(sessionClient, fxRequest, new AbortController().signal, fetcher), { reused: false });
  assert.deepEqual(await requestReportRate(sessionClient, fxRequest, new AbortController().signal, fetcher), { reused: true });
  assert.equal(calls[0][0], "/api/financial/historical-fx");
  assert.equal(calls[0][1].method, "POST");
  assert.equal(calls[0][1].headers.Authorization, "Bearer fixture");
  assert.equal(calls[0][1].body, calls[1][1].body);
  assert.deepEqual(JSON.parse(calls[0][1].body), fxRequest);
});

test("rejects expired session, server failures and malformed or mismatched confirmations", async () => {
  await assert.rejects(requestReportRate({ auth: { getSession: async () => ({ data: { session: null }, error: null }) } }, fxRequest, new AbortController().signal, () => { throw new Error("must not fetch"); }), /sesión/);
  for (const status of [401, 409, 502, 503]) {
    await assert.rejects(requestReportRate(sessionClient, fxRequest, new AbortController().signal, async () => Response.json({ error: "Consulta rechazada" }, { status })), /Consulta rechazada/);
  }
  for (const patch of [{ id: null }, { user_id: "other" }, { acquisition_date: "2026-09-29" }, { source_currency: "CRC" }, { source: "Manual" }]) {
    await assert.rejects(requestReportRate(sessionClient, fxRequest, new AbortController().signal, async () => Response.json({ snapshot: { ...snapshot, ...patch } })), /no confirma/);
  }
  await assert.rejects(requestReportRate(sessionClient, fxRequest, new AbortController().signal, async () => new Response("not JSON")), /no confirma/);
});

test("cancellation also releases a stalled session lookup without making a request", async () => {
  const controller = new AbortController();
  const pending = requestReportRate({ auth: { getSession: () => new Promise(() => {}) } }, fxRequest, controller.signal, () => { throw new Error("must not fetch"); });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("missing FX retains native value but never substitutes zero for missing conversion", () => {
  const missing = { ...value, remaining_crc_value: null, fx_status: "incomplete", incompleteness_reason: "missing_fx_snapshot" };
  assert.deepEqual(summarizeValuations([row], new Map([[row.roll_id, missing]])), [
    { currency: "CRC", total: null, included: 0, missing: 1 },
    { currency: "USD", total: 10, included: 1, missing: 0 }
  ]);
  assert.match(valuationNote(missing), /BCCR pendiente/);
  assert.equal(valuationCsvCells(missing)[0], null);
});

test("zero is a legitimate exhausted balance, never a fabricated missing price", () => {
  assert.equal(valuationAmount({ ...value, fx_status: "complete_zero", remaining_crc_value: 0 }, "CRC"), 0);
  assert.equal(valuationAmount({ ...value, fx_status: "excluded_archived" }, "CRC"), null);
  for (const invalid of [null, NaN, Infinity, -1]) assert.equal(valuationAmount({ ...value, remaining_crc_value: invalid }, "CRC"), null);
});

test("rejects unavailable, other-owner and stale physical balances", () => {
  assert.equal(matchReportValuation(row), undefined);
  for (const patch of [{ user_id: "other" }, { roll_id: "other" }, { status: "archived" }, { available_weight_g: 200 }, { initial_weight_g: 900 }]) {
    assert.equal(matchReportValuation(row, { ...value, ...patch }), undefined);
  }
  assert.equal(matchReportValuation(row, value), value);
  assert.equal(summarizeValuations([row], new Map())[0].total, null);
});

test("reports correction, cost, date and currency gaps and exports their provenance", () => {
  for (const reason of ["missing_cost", "missing_acquisition_date", "unsupported_currency", "corrected_order_mismatch"]) {
    assert.ok(valuationNote({ ...value, incompleteness_reason: reason }));
  }
  assert.match(valuationNote({ ...value, incompleteness_reason: "corrected_order_mismatch" }), /conciliar/);
  assert.deepEqual(valuationCsvCells(value).slice(0, 9), [5000, 10, "Tasa histórica BCCR guardada", "2026-09-30", "USD", 10, "purchase_order_landed", "actual", "BCCR"]);
});

test("reads only the valuation view in bounded batches, deduplicating IDs", async () => {
  const calls = [];
  const client = { from(name) {
    assert.equal(name, "filament_inventory_valuation");
    return { select(columns) { assert.equal(columns, "*"); return this; }, in(column, ids) {
      assert.equal(column, "roll_id"); calls.push(ids); return this;
    }, async abortSignal(signal) { assert.ok(signal); return { data: [value], error: null }; } };
  } };
  const ids = Array.from({ length: 401 }, (_, i) => String(i));
  const data = await loadReportValuations(client, [...ids, ids[0]], new AbortController().signal);
  assert.deepEqual(calls.map((ids) => ids.length), [200, 200, 1]);
  assert.equal(data.length, 3);
});

test("query rejection and cancellation do not return a partial or stale success; retry can succeed", async () => {
  let fail = true;
  const client = { from() { return { select() { return this; }, in() { return this; }, async abortSignal() {
    return fail ? { error: new Error("offline"), data: null } : { data: [value], error: null };
  } }; } };
  await assert.rejects(loadReportValuations(client, [row.roll_id], new AbortController().signal), /offline/);
  fail = false;
  assert.equal((await loadReportValuations(client, [row.roll_id], new AbortController().signal)).length, 1);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadReportValuations(client, [row.roll_id], controller.signal), { name: "AbortError" });
});
