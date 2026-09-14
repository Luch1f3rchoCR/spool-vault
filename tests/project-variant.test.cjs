// Pure recipe tests. Run with Node >= 22.18; no account or database access.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createVariantDraft } = require('../lib/project-variant.ts');

const project = Object.freeze({ id: 'p1', name: 'Caja decorativa', description: 'Montar imanes', version: '2', license_name: 'Personal', commercial_use_allowed: false, estimated_minutes: 305, file_path: 'private/original.stl' });
const requirements = Object.freeze([
  Object.freeze({ project_id: 'p1', position: 2, preferred_roll_id: 'archived', planned_grams: 5, label: 'Tapa' }),
  Object.freeze({ project_id: 'other', position: 1, preferred_roll_id: 'r1', planned_grams: 99, label: 'Ajeno' }),
  Object.freeze({ project_id: 'p1', position: 1, preferred_roll_id: 'r1', planned_grams: 50, label: 'Cuerpo' })
]);
const components = Object.freeze([
  Object.freeze({ project_id: 'p1', position: 1, name: 'Imán', unit: 'unidad', quantity: 2, unit_cost: 250, currency: 'CRC', supplier_name: 'Proveedor', notes: '6×2' }),
  Object.freeze({ project_id: 'other', position: 1, name: 'No copiar', unit: 'unidad', quantity: 1, unit_cost: 20, currency: 'USD' })
]);
const rolls = Object.freeze([Object.freeze({ id: 'r1', status: 'open' }), Object.freeze({ id: 'archived', status: 'archived' })]);

test('copies recipe metadata, costs and ordered own lines, never the source file or id', () => {
  const result = createVariantDraft(project, requirements, components, rolls);
  assert.equal(result.name, 'Caja decorativa · variante');
  assert.equal(result.estimated_minutes, 305);
  assert.equal(result.license_name, 'Personal');
  assert.equal(result.commercial_use_allowed, false);
  assert.deepEqual(result.requirements, [{ roll_id: 'r1', planned_grams: 50, label: 'Cuerpo' }, { roll_id: '', planned_grams: 5, label: 'Tapa' }]);
  assert.deepEqual(result.components, [{ name: 'Imán', unit: 'unidad', quantity: 2, unit_cost: 250, currency: 'CRC', supplier_name: 'Proveedor', notes: '6×2' }]);
  assert.equal('file_path' in result, false);
  assert.equal('id' in result, false);
});
test('editing a draft leaves the original and later drafts unchanged', () => {
  const result = createVariantDraft(project, requirements, components, rolls);
  result.requirements[0].roll_id = 'new-color';
  result.components[0].unit_cost = 99;
  const second = createVariantDraft(project, requirements, components, rolls);
  assert.equal(second.requirements[0].roll_id, 'r1');
  assert.equal(second.components[0].unit_cost, 250);
  assert.equal(requirements[0].position, 2);
});
test('missing rolls require an explicit replacement, never silently choose another color', () => {
  const result = createVariantDraft(project, requirements, components, []);
  assert.ok(result.requirements.every(item => item.roll_id === ''));
  assert.equal(result.requirements[0].planned_grams, 50);
});
test('nullable metadata and maximum project name length remain valid', () => {
  const result = createVariantDraft({ ...project, name: 'a'.repeat(120), description: null, version: null, license_name: null, estimated_minutes: null }, [], [], []);
  assert.ok(result.name.length <= 120);
  assert.equal(result.description, '');
  assert.equal(result.estimated_minutes, null);
  assert.deepEqual(result.requirements, []);
});
