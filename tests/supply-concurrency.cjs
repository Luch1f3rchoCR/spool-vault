// Local isolated Postgres only: two simultaneous withdrawals must not oversell.
const {spawn,spawnSync}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const assert=require('node:assert/strict');
const container='spool-vault-sql-test-20260909';
const docker=process.env.DOCKER_BIN || 'docker';
const args=['exec','-i',container,'psql','-U','postgres','-X','-q','-t','-A','-v','ON_ERROR_STOP=1'];
const info=JSON.parse(spawnSync(docker,['inspect',container],{encoding:'utf8'}).stdout)[0];
assert.equal(info.Config.Labels.app,'spool-vault-sql-test');assert.equal(info.HostConfig.NetworkMode,'none');
function sql(s){const r=spawnSync(docker,args,{input:s,encoding:'utf8'});if(r.status)throw Error(r.stderr);return r.stdout.trim();}
const user=randomUUID(),supply=randomUUID();
const identity=`set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`;
const payload={supply_id:supply,kind:'adjustment',quantity:-8,unit_cost:0,reason:'Concurrency fixture'};
const withdraw=()=>`select public.record_supply_movement('${randomUUID()}','${JSON.stringify(payload)}'::jsonb);`;
function asyncSql(s){const p=spawn(docker,args);let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);const done=new Promise(resolve=>p.on('close',code=>resolve({code,out,err})));p.stdin.end(s);return {p,done};}
(async()=>{
 try {
  sql(`insert into auth.users(id,email,email_confirmed_at) values('${user}','concurrency@example.invalid',now());${identity}
   insert into public.supplies(id,name,category,unit,currency) values('${supply}','Concurrent magnet','Imanes','unidad','CRC');
   select public.record_supply_movement('${randomUUID()}','${JSON.stringify({...payload,kind:'receipt',quantity:10,unit_cost:100})}'::jsonb);`);
  const first=asyncSql(`begin;${identity}${withdraw()}select 'LOCKED';select pg_sleep(1);commit;`);
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Lock marker not received')),10000);
   first.p.stdout.on('data',d=>{if(String(d).includes('LOCKED')){clearTimeout(timer);resolve();}});
  });
  const second=asyncSql(`begin;${identity}${withdraw()}commit;`);
  const [a,b]=await Promise.all([first.done,second.done]);
  assert.equal(a.code,0,a.err);assert.notEqual(b.code,0);assert.match(b.err,/Saldo insuficiente/);
  assert.equal(sql(`select quantity from public.supply_stock where id='${supply}';`),'2.000');
  console.log('PASS concurrent withdrawals serialize: one succeeds, one rejects; balance 2');
 } finally {
  sql(`delete from auth.users where id='${user}';`);
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
