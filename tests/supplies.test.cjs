const {test}=require('node:test');
const assert=require('node:assert/strict');
const {supplyShortages,normalizeSupply}=require('../lib/supplies.ts');
const {createVariantDraft}=require('../lib/project-variant.ts');
test('aggregate repeated supplies; manual extras do not consume stock',()=>{
 const components=[{id:'a',supply_id:'s',name:'Iman'},{id:'b',supply_id:'s',name:'Iman'},{id:'c',name:'Manual'}];
 const supplies=[{id:'s',name:'Iman',unit:'unidad',quantity:5}];
 assert.equal(supplyShortages(components,{a:'3',b:'3',c:'99'},supplies).length,1);
 assert.deepEqual(supplyShortages(components,{a:'2',b:'3',c:'99'},supplies),[]);
 assert.equal(supplyShortages(components,{a:'1',b:'1'},[]).length,1);
});
test('numeric database values are normalized',()=>{
 assert.equal(normalizeSupply({quantity:'12.5',unit_cost:'0.9'}).quantity,12.5);
});
test('variants retain tracked supply references without editing original',()=>{
 const source={id:'p',name:'Box',commercial_use_allowed:false,estimated_minutes:null};
 const components=[{id:'c',project_id:'p',supply_id:'s',position:1,name:'Magnet',unit:'unit',quantity:2,unit_cost:100,currency:'CRC'}];
 const draft=createVariantDraft(source,[],components,[]);
 assert.equal(draft.components[0].supply_id,'s');
 draft.components[0].quantity=9;
 assert.equal(components[0].quantity,2);
});
