// Local production build only. Auth/provider/database requests are all simulated.
const {chromium,expect}=require('playwright/test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3117';assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const user={id:'da260000-0000-4000-8000-000000000001',email:'inventory-values@example.invalid',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-10-10',app_metadata:{},user_metadata:{}};
const roll={id:'da260000-0000-4000-8000-000000000051',brand:'Elegoo',material:'PLA',color_name:'Black',color_hex:'#111111',initial_weight_g:1000,available_weight_g:400,low_threshold_g:100,status:'open',currency:'CRC',filament_cost_amount:10000,package_type:'refill',spool_cost_amount:0};
const supply={id:'da260000-0000-4000-8000-000000000012',name:'Imanes',category:'Imanes',unit:'unidad',currency:'CRC',quantity:10,unit_cost:100};
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage();const errors=[],dateRequests=[],rateRequests=[];let phase=0,release,failSummary=false;
  page.on('pageerror',e=>errors.push(e.message));
  const token=['e30',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture'].join('.');
  await context.addInitScript(({user,token})=>localStorage.setItem('sb-spool-test-auth-token',JSON.stringify({access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token});
  const summary=()=>({user_id:user.id,as_of:'2026-10-25T12:00:00Z',rows:[
   {asset_type:'filament',id:roll.id,name:'Black',quantity:400,original_currency:'CRC',remaining_original_value:4000,remaining_crc_value:4000,remaining_usd_value:8,issue:null},
   {asset_type:'supply',id:supply.id,name:'Imanes',quantity:10,original_currency:'CRC',remaining_original_value:1000,remaining_crc_value:1000,remaining_usd_value:phase===2?2:null,issue:phase===2?null:phase===1?'missing_fx_snapshot':'missing_acquisition_date'}],
   pending_rates:phase===1?[{acquisition_date:'2026-10-10',source_currency:'CRC'}]:[],
   missing_supply_dates:phase===0?[{movement_id:'da260000-0000-4000-8000-000000000105',supply_name:'Imanes',quantity:10,unit:'unidad',recorded_at:'2026-10-11T12:00:00Z'}]:[]});
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/').pop();
   if(url.origin===base&&url.pathname==='/api/financial/historical-fx'){
    assert.equal(request.headers().authorization,`Bearer ${token}`);rateRequests.push(request.postDataJSON());
    if(rateRequests.length===1)return route.fulfill({status:503,json:{error:'BCCR no confirmó la consulta'}});
    phase=2;failSummary=true;return route.fulfill({json:{snapshot:{id:'snapshot',user_id:user.id,source:'BCCR',...rateRequests[0]},reused:true}});
   }
   if(url.origin===base)return url.pathname==='/api/supabase-config'?route.fulfill({json:{url:'https://spool-test.supabase.co',publishableKey:'sb_publishable_test'}}):route.continue();
   if(url.origin!=='https://spool-test.supabase.co')return route.abort();
   if(name==='inventory_value_summary')return failSummary?route.fulfill({status:503,json:{message:'Fixture unavailable'}}):route.fulfill({json:summary()});
   if(name==='complete_supply_purchase_date'){
    const body=request.postDataJSON();dateRequests.push(body);phase=1;
    if(dateRequests.length===1){await new Promise(resolve=>{release=resolve;});return route.fulfill({status:503,json:{message:'Respuesta perdida'}});}
    return route.fulfill({json:{movement_id:body.p_movement_id,purchased_at:body.p_purchased_at,request_id:body.p_request_id,user_id:user.id}});
   }
   const result=name==='user'?user:name==='user_profiles'?{user_id:user.id,base_currency:'EUR'}:name==='get_tester_first_visit'?{status:'active'}:name==='filament_rolls'?[roll]:name==='supply_stock'?[supply]:[];
   return route.fulfill({json:result});
  });
  await page.goto(base);await page.getByRole('button',{name:/Perfil.*inventory-values@example/}).waitFor();
  const cards=page.getByRole('region',{name:'Saldo actual del inventario'}),crc=cards.getByRole('article',{name:'Saldo en CRC'}),usd=cards.getByRole('article',{name:'Saldo en USD'});
  await expect(crc).toContainText('Filamentos');await expect(crc).toContainText('Insumos');
  await expect(usd).toContainText('Subtotal · 1 sin valorar');
  assert.equal((await crc.locator('strong').innerText()).replace(/\D/g,''),'5000');assert.equal((await usd.locator('strong').innerText()).replace(/\D/g,''),'800');
  assert.equal(dateRequests.length+rateRequests.length,0,'opening dashboard wrote financial data');
  assert.ok(await cards.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await fs.mkdir('node_modules/.tools/inventory-values',{recursive:true});await cards.screenshot({path:`node_modules/.tools/inventory-values/partial-${width}.png`});
  await cards.getByRole('button',{name:'Ver desglose y completar'}).click();const modal=page.getByRole('dialog',{name:'Valor del inventario'});
  await modal.getByLabel('Fecha real de compra').fill('2026-10-10');await modal.getByRole('button',{name:'Confirmar fecha de compra'}).click();
  await expect(modal.getByRole('button',{name:'Cerrar valoración'})).toBeDisabled();await page.keyboard.press('Escape');assert.equal(dateRequests.length,1);release();
  await modal.getByText(/No pudimos confirmar la operación/).waitFor();
  await page.reload();await cards.getByRole('button',{name:'Ver desglose y completar'}).click();
  await expect(modal.getByLabel('Fecha real de compra')).toHaveValue('2026-10-10');await expect(modal.getByLabel('Fecha real de compra')).toBeDisabled();
  await modal.getByRole('button',{name:'Reintentar fecha'}).click();await modal.getByRole('button',{name:'Consultar tasa BCCR'}).waitFor();assert.deepEqual(dateRequests[0],dateRequests[1]);
  await modal.getByRole('button',{name:'Consultar tasa BCCR'}).click();await modal.getByText(/BCCR no confirmó/).waitFor();
  await modal.getByRole('button',{name:'Consultar tasa BCCR'}).click();await modal.getByText(/Tasa histórica confirmada/).waitFor();
  await modal.getByRole('alert').filter({hasText:'No pudimos cargar el saldo histórico'}).waitFor();
  failSummary=false;await modal.getByRole('button',{name:'Reintentar resumen'}).click();
  await expect(modal.getByRole('alert')).toHaveCount(0);assert.equal(rateRequests.length,2,'read retry repeated the provider write');
  await expect(modal.getByText('Tasas históricas pendientes',{exact:true})).toHaveCount(0);assert.deepEqual(rateRequests[0],rateRequests[1]);
  await modal.getByRole('button',{name:'Cerrar valoración'}).click();
  await expect(usd).not.toContainText('Subtotal');assert.equal((await usd.locator('strong').innerText()).replace(/\D/g,''),'1000');
  await cards.screenshot({path:`node_modules/.tools/inventory-values/complete-${width}.png`});
  await page.getByRole('button',{name:'Inventario',exact:true}).filter({visible:true}).click();
  await expect(page.getByRole('region',{name:'Saldo actual del inventario'})).toHaveCount(1);assert.equal((await usd.locator('strong').innerText()).replace(/\D/g,''),'1000');
  failSummary=true;await cards.getByRole('button',{name:'Actualizar saldo'}).click();await cards.getByRole('alert').waitFor();assert.equal(await crc.locator('strong').innerText(),'—');
  failSummary=false;await cards.getByRole('button',{name:'Actualizar saldo'}).click();await expect(usd).toContainText('Saldo a costo histórico');
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}px: joint balances, partial states, date retry/reload, BCCR retry, refresh and responsive`);
 }
 const context=await browser.newContext(),page=await context.newPage();await page.route('**/*',route=>{const url=new URL(route.request().url());return url.origin!==base?route.abort():url.pathname==='/api/supabase-config'?route.fulfill({json:{}}):route.continue();});
 await page.goto(base);const cards=page.getByRole('region',{name:'Saldo actual del inventario'});await expect(cards).toContainText('El modo local/demo no calcula conversiones');assert.equal(await cards.getByRole('button').count(),0);await context.close();console.log('PASS local/demo: no invented converted balance');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
