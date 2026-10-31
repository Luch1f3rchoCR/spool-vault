const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { transform, loadBindings } = require('next/dist/build/swc');
const vm = require('node:vm');
async function load() {
  await loadBindings();
  const exports = {};
  const result = await transform(fs.readFileSync('lib/filament-print-profiles.ts', 'utf8'), { jsc: { parser: { syntax: 'typescript' }, target: 'es2022' }, module: { type: 'commonjs' } });
  vm.runInNewContext(result.code,
    { exports, require: () => require('../lib/filament-print-profile-fields.ts'), FormData, Number, Object, JSON, Error });
  return exports;
}
const helpers = load();
const roll = 'da250000-0000-4000-8000-000000000021', printer = 'da250000-0000-4000-8000-000000000011';
test('cancellation releases a stalled request, including the pre-fetch auth wait', async () => {
  const { awaitPrintProfileRequest } = await helpers;
  const controller = new AbortController();
  const pending = awaitPrintProfileRequest(new Promise(() => {}), controller.signal);
  controller.abort();
  await assert.rejects(pending, /tiempo de espera/);
});
test('form parsing preserves missing, zero and comma decimals; rejects invalid values', async () => {
  const { printProfileValues } = await helpers;
  const form = new FormData(); form.set('profile_name', ' Perfil '); form.set('printer_id', printer); form.set('nozzle_diameter_mm', '0,4'); form.set('bed_temperature_c', '0');
  const values = printProfileValues(form, roll);
  assert.equal(values.nozzle_diameter_mm, .4); assert.equal(values.bed_temperature_c, 0); assert.equal(values.flow_ratio, null); assert.equal(values.name, 'Perfil');
  form.set('flow_ratio', '98%'); assert.throws(() => printProfileValues(form, roll), /Flujo|flujo/);
});
test('pending operations survive reload and reject another roll; confirmations match owner and exact attempt', async () => {
  const { confirmedPrintProfile, restorePrintProfileOperation } = await helpers;
  const values = { roll_id: roll, printer_id: printer, name: 'Perfil', flow_ratio: null };
  const operation = { p_request_id: crypto.randomUUID(), p_profile_id: crypto.randomUUID(), p_expected_version: 0, p_values: values };
  assert.equal(restorePrintProfileOperation(JSON.stringify(operation), roll).p_request_id, operation.p_request_id);
  assert.throws(() => restorePrintProfileOperation(JSON.stringify(operation), 'other'));
  const row = { ...values, id: 'revision', user_id: 'owner', profile_id: operation.p_profile_id, request_id: operation.p_request_id, version: 1 };
  assert.ok(confirmedPrintProfile(row, operation, 'owner'));
  for (const changed of [{ user_id: 'other' }, { version: 2 }, { flow_ratio: 0 }, { request_id: 'other' }]) assert.ok(!confirmedPrintProfile({ ...row, ...changed }, operation, 'owner'));
});
