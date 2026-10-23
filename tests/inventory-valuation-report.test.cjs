const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadReportValuations, matchReportValuation, summarizeValuations, valuationAmount, valuationNote, valuationCsvCells } = require("../lib/inventory-valuation-report.ts");

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
