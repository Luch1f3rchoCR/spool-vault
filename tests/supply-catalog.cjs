// Standalone isolated SQL test: does not modify the shared FIN-01A runner.
// Docker must be running; uses a local postgres:17 image, no ports or cloud credentials.
const {spawnSync, spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function docker(args,input){
 const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:16*1024*1024});
 if(r.status!==0) throw new Error(r.stderr||r.stdout||r.error?.message);
 return r.stdout.trim();
}
(async()=>{
 let id;
 try {
  id=docker(['run','--rm','-d','--network','none','--label','app=proper-supply-catalog-test','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17']);
  assert.match(id,/^[a-f0-9]{64}$/);
  let ready=false;
  for(let i=0;i<60;i++){
   if(spawnSync('docker',['exec',id,'pg_isready','-U','postgres'],{stdio:'ignore'}).status===0){ready=true;break;}
   await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(ready,'isolated postgres did not start');
  const args=['exec','-i',id,'psql','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'];
  const sql=s=>docker(args,'set client_min_messages=warning;\n'+s);
  sql(read('supabase/tests/local-bootstrap.sql'));
  sql(read('supabase/schema.sql'));
  const migrations=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
  const current=migrations.find(f=>f.endsWith('_supply_catalog.sql'));
  assert.ok(current);
  for(const name of migrations) if(name!==current) sql(read('supabase/migrations/'+name));
  const migration=read('supabase/migrations/'+current);
  sql('begin;\n'+migration+'\nrollback;');
  sql(migration);
  sql(read('supabase/tests/supply_catalog.sql'));
  console.log('PASS catalog creation, zero stock, metadata, rejected inputs, retry, rollback, RLS, grants and export');
  sql(read('supabase/tests/supply_stock_projects.sql'));
  console.log('PASS existing supply/production regression after additive migration');
  const user='d3000000-0000-4000-8000-000000000003';
  sql(`insert into auth.users(id,email,email_confirmed_at) values('${user}','concurrency@example.invalid',now());`);
  const source=`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${user}',true); select public.create_supply('d3000000-0000-4000-8000-000000000004','{"kind":"catalog","supply_id":null,"name":"Concurrent","category":"Otros","unit":"unidad","currency":"CRC"}')->'supply'->>'id'; select pg_sleep(0.3); commit;`;
  const concurrent=()=>new Promise((resolve,reject)=>{
   const p=spawn('docker',args); let out='',err='';
   p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);
   p.on('error',reject);p.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err)));
   p.stdin.end(source);
  });
  const results=await Promise.all([concurrent(),concurrent()]);
  assert.equal(results[0],results[1]);
  assert.equal(sql('select count(*) from public.supplies;'),'1');
  assert.equal(sql('select count(*) from public.supply_movements;'),'0');
  console.log('PASS concurrent same-key catalog creation: one supply, zero movements');
 } finally { if(id && /^[a-f0-9]{64}$/.test(id)) docker(['stop',id]); }
})().catch(e=>{console.error(e);process.exitCode=1;});
