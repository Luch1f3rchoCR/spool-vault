const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inventoryValueTotal, isInventoryValueSummary, awaitInventoryRequest, loadInventoryValueSummary } = require('../lib/inventory-values.ts');
const row = { asset_type:'filament',id:'f',name:'PLA',quantity:400,original_currency:'CRC',remaining_original_value:4000,remaining_crc_value:4000,remaining_usd_value:8,issue:null };
const supply = { ...row,asset_type:'supply',id:'s',name:'Imanes',quantity:10,remaining_original_value:1000,remaining_crc_value:1000,remaining_usd_value:2 };
const summary = { user_id:'owner',as_of:'2026-10-25T12:00:00Z',rows:[row,supply],pending_rates:[],missing_supply_dates:[] };
test('two currencies sum valued balances across filaments and supplies, not original nominal amounts',()=>{
 assert.deepEqual(inventoryValueTotal(summary.rows,'CRC'),{total:5000,included:2,missing:0});
 assert.equal(inventoryValueTotal(summary.rows,'USD').total,10);
 assert.equal(inventoryValueTotal(summary.rows,'USD','supply').total,2);
 const missing={...supply,remaining_usd_value:null};
 assert.deepEqual(inventoryValueTotal([row,missing],'USD'),{total:8,included:1,missing:1});
 assert.equal(inventoryValueTotal([missing],'USD').total,null);
 assert.equal(inventoryValueTotal([],'USD').total,0);
 assert.equal(inventoryValueTotal([{...row,remaining_usd_value:0}],'USD').total,0);
});
test('summary rejects other owner, malformed rows, unsafe amounts and invalid pending data',()=>{
 assert.ok(isInventoryValueSummary(summary,'owner'));
 assert.ok(!isInventoryValueSummary(summary,'other'));
 for(const value of [NaN,Infinity,-1,'0']) assert.ok(!isInventoryValueSummary({...summary,rows:[{...row,remaining_crc_value:value}]},'owner'));
 for(const data of [{},{...summary,rows:null},{...summary,pending_rates:[{acquisition_date:'today',source_currency:'JPY'}]}]) assert.ok(!isInventoryValueSummary(data,'owner'));
});
test('cancelled auth/network waits release the UI and malformed read never becomes a success',async()=>{
 const controller=new AbortController();const pending=awaitInventoryRequest(new Promise(()=>{}),controller.signal);controller.abort();await assert.rejects(pending);
 const client={rpc:()=>({abortSignal:async()=>({data:{...summary,user_id:'other'},error:null})})};
 await assert.rejects(loadInventoryValueSummary(client,'owner',new AbortController().signal));
});
