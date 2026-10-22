// Run against a local build with no NEXT_PUBLIC_SUPABASE_* values.
// All Auth/Data responses are mocked; external traffic is blocked.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const base=process.env.SUPPLY_TEST_URL||'http://127.0.0.1:3115';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'local server only');
const user={id:'d1000000-0000-4000-8000-000000000001',email:'catalog@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
(async()=>{
 const browser=await chromium.launch({headless:true});
 try { for(const width of [320,390,1280]) {
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await context.newPage(), errors=[], creates=[], entries=[];
  page.on('pageerror',e=>errors.push(e.message));
  const token=['e30',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'test'].join('.');
  await context.addInitScript(({user,token})=>localStorage.setItem('sb-spool-test-auth-token',JSON.stringify({access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token});
  let catalog=null;
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url()),name=url.pathname.split('/').pop();
   if(url.origin===base) return url.pathname==='/api/supabase-config'?route.fulfill({json:{url:'https://spool-test.supabase.co',publishableKey:'sb_publishable_test'}}):route.continue();
   if(url.origin!=='https://spool-test.supabase.co') return route.abort();
   let result=[];
   if(name==='user') result=user;
   else if(name==='user_profiles') result={user_id:user.id,base_currency:'CRC',display_name:'Prueba'};
   else if(name==='get_tester_first_visit') result={status:'active'};
   else if(name==='supply_stock') result=catalog?[catalog]:[];
   else if(name==='create_supply') {
    creates.push(req.postDataJSON());
    catalog={...creates[0].p_values,id:'catalog-1',quantity:0,unit_cost:0,created_at:'2026-10-21T12:00:00Z'};
    if(creates.length===1) return route.fulfill({status:503,json:{message:'Respuesta simulada no confirmada'}});
    assert.deepEqual(creates[0],creates[1]);
    result={supply:catalog,movements:[]};
   } else if(name==='record_supply_movement') {
    entries.push(req.postDataJSON());
    result={supply:{...catalog,quantity:5,unit_cost:125},movements:[]};
   }
   return route.fulfill({json:result});
  });
  const open=async()=>{
   await page.getByRole('button',{name:/Perfil.*catalog@example/}).waitFor();
   if(width<780) await page.getByRole('button',{name:'Más',exact:true}).click();
   await page.getByRole('button',{name:'Insumos',exact:true}).click();
  };
  await page.goto(base); await open();
  const modal=page.getByRole('dialog',{name:'Insumos',exact:true});
  await modal.getByRole('button',{name:'Nuevo insumo',exact:true}).click();
  assert.equal(await modal.getByLabel('Cantidad que ingresa').count(),0);
  assert.equal(await modal.getByRole('spinbutton').count(),0,'no quantity or price when creating');
  await modal.getByRole('button',{name:'Cancelar',exact:true}).click(); assert.equal(creates.length,0);
  await modal.getByRole('button',{name:'Nuevo insumo',exact:true}).click();
  await modal.getByLabel('Nombre',{exact:true}).fill('Imán 6x2');
  const units=modal.getByRole('combobox',{name:'Unidad de medida',exact:true});
  await units.selectOption('__custom__'); await modal.getByLabel('Nombre de la unidad',{exact:true}).fill('par');
  await modal.getByRole('combobox',{name:'Moneda',exact:true}).selectOption('EUR');
  await modal.getByLabel('Etiquetas (opcional)',{exact:true}).fill('a'.repeat(41));
  await modal.getByRole('button',{name:'Crear ficha',exact:true}).click();
  await modal.getByText('Usá hasta 10 etiquetas de máximo 40 caracteres cada una.',{exact:true}).waitFor();
  assert.equal(creates.length,0);
  await modal.getByLabel('Etiquetas (opcional)',{exact:true}).fill('Neodimio, cajas, Neodimio');
  await modal.getByRole('textbox',{name:'Descripción (opcional)',exact:true}).fill('Para tapas\nDiámetro 6 mm');
  assert.equal(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
  await fs.mkdir('node_modules/.tools/supply-catalog',{recursive:true});
  await page.screenshot({path:`node_modules/.tools/supply-catalog/create-${width}.png`});
  await modal.getByRole('button',{name:'Crear ficha',exact:true}).click();
  await modal.getByRole('button',{name:'Reintentar',exact:true}).waitFor();
  assert.equal(await modal.getByRole('button',{name:'Cerrar ventana'}).isDisabled(),true);
  await page.reload(); await open();
  assert.equal(await units.inputValue(),'__custom__');
  assert.equal(await modal.getByLabel('Nombre',{exact:true}).inputValue(),'Imán 6x2');
  assert.equal(await modal.getByRole('textbox',{name:'Descripción (opcional)',exact:true}).inputValue(),'Para tapas\nDiámetro 6 mm');
  assert.equal(await modal.getByRole('combobox',{name:'Moneda',exact:true}).inputValue(),'EUR');
  assert.equal(await units.isDisabled(),true);
  await modal.getByRole('button',{name:'Reintentar',exact:true}).click();
  await modal.getByText('Ficha creada sin existencias. Usá Entrada / ajuste para ingresar cantidades y costos.',{exact:true}).waitFor();
  assert.equal(entries.length,0);
  assert.deepEqual(creates[0].p_values.tags,['Neodimio','cajas']);
  assert.equal('quantity' in creates[0].p_values,false);
  assert.equal('unit_cost' in creates[0].p_values,false);
  await modal.getByLabel('Buscar insumo').fill('Neodimio');
  await modal.getByRole('heading',{name:'Imán 6x2',exact:true}).waitFor();
  await modal.getByText('Descripción',{exact:true}).click();
  await modal.getByText('Para tapas\nDiámetro 6 mm',{exact:true}).waitFor();
  await page.screenshot({path:`node_modules/.tools/supply-catalog/list-${width}.png`});
  await modal.getByRole('button',{name:'Entrada / ajuste',exact:true}).click();
  await modal.getByLabel('Cantidad que ingresa').fill('5');
  await modal.getByLabel('Costo por unidad (EUR)').fill('125');
  await modal.getByLabel('Motivo / proveedor / referencia').fill('Entrada directa');
  await modal.getByRole('button',{name:'Guardar movimiento'}).click();
  await modal.getByText('Insumo y existencias guardados correctamente.',{exact:true}).waitFor();
  assert.equal(entries[0].p_values.supply_id,'catalog-1'); assert.equal(entries[0].p_values.unit,'par');
  await modal.getByRole('button',{name:'Nuevo insumo',exact:true}).click();
  assert.equal(await modal.getByLabel('Nombre',{exact:true}).inputValue(),'');
  assert.equal(await modal.getByLabel('Etiquetas (opcional)',{exact:true}).inputValue(),'');
  await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
  // An older release may have left an opening-balance operation awaiting confirmation.
  const old={id:'legacy-request',values:{supply_id:null,kind:'receipt',name:'Legacy',category:'Otros',unit:'metro',currency:'CRC',quantity:3,unit_cost:7,reason:'Before update'}};
  await page.evaluate(({key,value})=>sessionStorage.setItem(key,JSON.stringify(value)),{key:`proper-supply-pending:${user.id}`,value:old});
  await page.reload(); await open();
  await modal.getByRole('button',{name:'Reintentar',exact:true}).click();
  await modal.getByText('Insumo y existencias guardados correctamente.',{exact:true}).waitFor();
  assert.deepEqual(entries[1],{p_request_id:old.id,p_values:old.values});
  await page.keyboard.press('Tab'); assert.equal(await modal.evaluate(e=>e.contains(document.activeElement)),true);
  await page.keyboard.press('Escape'); assert.equal(await modal.count(),0);
  assert.deepEqual(errors,[]); console.log(`PASS ${width}: catalog, validation, zero stock, exact retry/reload, metadata search, later receipt, legacy retry, keyboard`);
  await context.close();
 }} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
