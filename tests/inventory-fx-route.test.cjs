const { test } = require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const {transform,loadBindings}=require('next/dist/build/swc');
const user={id:'owner',email_confirmed_at:'2026-10-10',is_anonymous:false};
async function route(options={}){
 await loadBindings();const exports={},calls=[];
 const client={auth:{getUser:async()=>({data:{user:options.expired?null:user},error:null})},from:table=>({select:()=>({eq(){return this},maybeSingle:async()=>({data:options.existing??null,error:null}),limit:async()=>({data:[],error:null})})}),
 rpc:async(name,args)=>{calls.push({name,args});return name==='inventory_value_summary'?{data:{user_id:options.foreign?'other':'owner',pending_rates:options.pending??[]},error:null}:{data:{id:'snapshot',user_id:args.p_user_id,source:'BCCR',acquisition_date:args.p_acquisition_date,source_currency:args.p_source_currency},error:null};}};
 const code=await transform(fs.readFileSync('app/api/financial/historical-fx/route.ts','utf8'),{jsc:{parser:{syntax:'typescript'},target:'es2022'},module:{type:'commonjs'}});
 vm.runInNewContext(code.code,{exports,require:name=>name==='@supabase/supabase-js'?{createClient:()=>client}:{...require('../lib/historical-fx.ts'),resolveBccrObservations:async()=>{calls.push({name:'provider'});return {usdCrc:{effectiveDate:'2026-10-10',rawValue:'500'},eurUsd:null};}},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture',SUPABASE_SECRET_KEY:'fixture',BCCR_TOKEN:'fixture'}},Response,Request,crypto});
 return {post:exports.POST,calls};
}
const request=(bearer=true)=>new Request('https://fixture.invalid/api/financial/historical-fx',{method:'POST',headers:bearer?{authorization:'Bearer fixture'}:{},body:JSON.stringify({acquisition_date:'2026-10-10',source_currency:'CRC',user_id:'attacker'})});
test('supply-only pending rates use the verified owner and existing immutable snapshot RPC',async()=>{
 const {post,calls}=await route({pending:[{acquisition_date:'2026-10-10',source_currency:'CRC'}]});
 const response=await post(request());assert.equal(response.status,200);const saved=calls.find(c=>c.name==='record_bccr_fx_snapshot');assert.equal(saved.args.p_user_id,'owner');assert.equal(saved.args.p_source_currency,'CRC');
});
test('no arbitrary dates, foreign summary or expired/missing session reach the provider',async()=>{
 for(const options of [{},{foreign:true,pending:[{acquisition_date:'2026-10-10',source_currency:'CRC'}]},{expired:true}]){
  const {post,calls}=await route(options);assert.ok((await post(request())).status>=400);assert.ok(!calls.some(c=>c.name==='provider'));
 }
 const {post,calls}=await route();assert.equal((await post(request(false))).status,401);assert.equal(calls.length,0);
});
test('an existing snapshot is reused without querying pending stock or BCCR',async()=>{
 const {post,calls}=await route({existing:{id:'saved'}});const result=await post(request());assert.equal(result.status,200);assert.equal((await result.json()).reused,true);assert.equal(calls.length,0);
});
