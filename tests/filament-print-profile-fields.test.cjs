// Run directly: node --test tests/filament-print-profile-fields.test.cjs
// No shared runner, database, network, browser session or application writes.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {printProfileNumericFields,validatePrintProfileNumber,validatePrintProfileName}=require('../lib/filament-print-profile-fields.ts');

test('empty settings remain unknown, never silently zero',()=>{
  for(const field of printProfileNumericFields) {
    assert.deepEqual(validatePrintProfileNumber('',field.positive),{value:null,error:null});
    assert.deepEqual(validatePrintProfileNumber('  ',field.positive),{value:null,error:null});
    assert.equal('defaultValue' in field,false);
  }
});
test('dot and comma decimals produce the same numeric value',()=>{
  for(const text of ['0.4','0,4',' 0,4 ','.4',',4']) assert.deepEqual(validatePrintProfileNumber(text,true),{value:0.4,error:null});
  assert.equal(validatePrintProfileNumber('1,03',true).value,1.03);
});
test('zero temperature is distinct from missing; diameter and ratio must be positive',()=>{
  assert.deepEqual(validatePrintProfileNumber('0',false),{value:0,error:null});
  assert.equal(validatePrintProfileNumber('-0',false).value,0);
  for(const field of printProfileNumericFields.filter(f=>f.positive)) assert.ok(validatePrintProfileNumber('0',field.positive).error);
  for(const positive of [true,false]) assert.ok(validatePrintProfileNumber('-1',positive).error);
});
test('rejects nonfinite values, units, percentages and ambiguous separators',()=>{
  for(const raw of ['NaN','Infinity','1e309','0xFF','210°C','103%','1,234.5','1.234,5','1 000','1,2,3','.',',','9007199254740992','9'.repeat(400)]) {
    const result=validatePrintProfileNumber(raw,false);
    assert.ok(result.error,raw);assert.equal(result.value,null,raw);
  }
});
test('profile name requires non-whitespace text and an explicit length limit',()=>{
  assert.ok(validatePrintProfileName(' \n '));
  assert.ok(validatePrintProfileName('a'.repeat(121)));
  assert.equal(validatePrintProfileName('a'.repeat(120)),null);
  assert.equal(validatePrintProfileName(' Configuración verificada '),null);
});
