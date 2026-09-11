// Isolated fixtures: no real account, email, inventory or cloud writes.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3112';
const evidence = path.resolve('node_modules/.tools/evidence');
async function run(browser, width) {
 const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
 const page = await context.newPage(); const errors = []; page.on('pageerror',e=>errors.push(e.message));
 const user = { id:'d1000000-0000-4000-8000-000000000001', email:'orders@example.invalid', aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{} };
 const token=['e30',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'test'].join('.');
 await context.addInitScript(({user,token})=>localStorage.setItem('sb-spool-test-auth-token',JSON.stringify({access_token:token,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})),{user,token});
 let saved=null; const requests=[];
 await context.route('**/*', async route=>{
  const request=route.request(), url=new URL(request.url()), name=url.pathname.split('/').pop();
  if(url.origin===new URL(base).origin) {
   if(url.pathname==='/api/supabase-config') return route.fulfill({json:{url:'https://spool-test.supabase.co',publishableKey:'sb_publishable_test'}});
   return route.continue();
  }
  if(url.origin!=='https://spool-test.supabase.co') return route.abort();
  let result=[];
  if(url.pathname==='/auth/v1/user') result=user;
  else if(name==='user_profiles') result={user_id:user.id,base_currency:'CRC',display_name:'Orders test'};
  else if(name==='get_tester_first_visit') result={status:'active'};
  else if(name==='filament_rolls') result=saved?.rolls||[];
  else if(name==='purchase_history') result=saved?.purchases||[];
  else if(name==='purchase_orders') result=saved?[saved.order]:[];
  else if(name==='purchase_order_items') result=saved?.items||[];
  else if(name==='suppliers') result=saved?.suppliers||[];
  else if(name==='create_purchase_order_v3') {
   const payload=request.postDataJSON(); requests.push(payload);
   await new Promise(resolve=>setTimeout(resolve,250));
   if(!saved) {
    const p=payload.p_order, lines=p.new_rolls;
    assert.equal(lines.length,2); assert.deepEqual(p.purchase_ids,[]);
    const purchases=lines.map((l,i)=>({id:`purchase-${i}`,roll_id:`roll-${i}`,supplier_id:'supplier-test',supplier_name:p.supplier_name,
      brand:l.brand,material:l.material,product_line:l.product_line,color_name:l.color_name,color_hex:l.color_hex,
      quantity_g:l.quantity_g,package_type:l.package_type,total_price:l.total_price,spool_cost:l.spool_cost,
      filament_cost:l.total_price-l.spool_cost,currency:p.currency,purchased_at:p.purchased_at}));
    const rolls=purchases.map((v,i)=>({id:v.roll_id,brand:v.brand,material:v.material,product_line:v.product_line,color_name:v.color_name,color_hex:v.color_hex,
      initial_weight_g:v.quantity_g,available_weight_g:v.quantity_g,low_threshold_g:200,status:'new',currency:v.currency,price_amount:v.total_price,
      supplier_id:v.supplier_id,package_type:v.package_type,spool_id:null,spool_cost_amount:v.spool_cost,filament_cost_amount:v.filament_cost,
      purchase_date:p.purchased_at,location:lines[i].location,qr_payload:null,nfc_tag_id:null}));
    const order={id:'order-test',request_id:payload.p_request_id,supplier_id:'supplier-test',supplier_name:p.supplier_name,purchased_at:p.purchased_at,
      currency:p.currency,subtotal_amount:24000,shipping_amount:p.shipping_amount,other_charges_amount:0,total_amount:27000,allocation_method:p.allocation_method,cost_confidence:p.cost_confidence};
    const items=purchases.map((v,i)=>({...v,id:`item-${i}`,purchase_history_id:v.id,order_id:order.id,base_amount:v.total_price,filament_base_cost:v.filament_cost,
      allocated_shipping:1500,allocated_other_charges:0,landed_total:v.total_price+1500,filament_landed_cost:v.filament_cost+1500,cost_confidence:'actual'}));
    saved={order,items,rolls,purchases,suppliers:[{id:'supplier-test',name:p.supplier_name,website_url:null,notes:null}],payment:null,replayed:false};
    return route.fulfill({status:503,json:{message:'Simulated lost response after commit'}});
   }
   assert.equal(payload.p_request_id,requests[0].p_request_id,'editing an uncertain order must not create another operation');
   if (JSON.stringify(payload.p_order)!==JSON.stringify(requests[0].p_order)) return route.fulfill({status:400,json:{message:'La operacion ya existe con datos diferentes'}});
   result={...saved,replayed:true};
  }
  return route.fulfill({json:result});
 });
 await page.goto(base);
 await page.getByRole('button',{name:/Perfil.*orders@example/}).waitFor();
 await page.getByRole('button',{name:'Compras',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'Mis compras',exact:true});
 const newOrder=modal.getByRole('button',{name:'Nueva orden'});
 assert.equal(await newOrder.isEnabled(),true,'must allow a first order without existing purchases');
 await newOrder.click();
 for(const [index,color,price,spooled] of [[1,'Test Matte','11500',false],[2,'Test Silk','12500',true]]) {
  await modal.getByRole('button',{name:'Filamento nuevo',exact:true}).click();
  const line=modal.getByRole('group',{name:`Filamento nuevo ${index}`,exact:true});
  await line.getByLabel('Nombre del color').fill(color);
  await line.getByLabel('Precio del producto (CRC)').fill(price);
  if(spooled) { await line.getByLabel('Presentación').selectOption('spooled'); await line.getByLabel('Costo del spool incluido (CRC)').fill('1000'); }
 }
 await modal.getByLabel('Proveedor de la orden').fill('Test Shop');
 await modal.getByLabel('Envío / express').fill('3000');
 // Removing a draft is local only; no premature insert.
 await modal.getByRole('button',{name:'Filamento nuevo',exact:true}).click();
 await modal.getByRole('button',{name:'Quitar filamento 3'}).click();
 assert.equal(requests.length,0);
 await modal.getByRole('group',{name:'Filamento nuevo 1',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(evidence,`order-new-draft-${width}.png`)});
 const dimensions=await modal.evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));
 assert.ok(dimensions.scroll<=dimensions.width+1,'no horizontal overflow');
 await modal.getByRole('button',{name:'Guardar orden',exact:true}).click();
 await modal.getByRole('button',{name:'Guardando orden completa…'}).waitFor();
 assert.equal(await modal.getByRole('button',{name:'Cerrar ventana'}).isDisabled(),true);
 await modal.getByRole('alert').filter({hasText:'No pudimos confirmar'}).waitFor();
 assert.equal(await modal.getByRole('group',{name:'Filamento nuevo 1',exact:true}).getByLabel('Nombre del color').inputValue(),'Test Matte');
 assert.equal(requests.length,1);
 if(width===390) {
  const price=modal.getByRole('group',{name:'Filamento nuevo 1',exact:true}).getByLabel('Precio del producto (CRC)');
  await price.fill('11700');
  await modal.getByRole('button',{name:'Guardar orden',exact:true}).click();
  await modal.getByRole('alert').filter({hasText:'datos diferentes'}).waitFor();
  await price.fill('11500');
 }
 await modal.getByRole('button',{name:'Guardar orden',exact:true}).click();
 await modal.getByRole('status').filter({hasText:'Orden guardada'}).waitFor();
 assert.equal(requests.length,width===390?3:2);
 assert.equal(await modal.getByRole('group',{name:'Filamento nuevo 1',exact:true}).count(),0);
 assert.equal(await modal.locator('.purchase-invoice-card').count(),1);
 await modal.getByRole('button',{name:/Ver líneas de compra/}).click();
 const detail=page.getByRole('dialog',{name:'Detalle de compra',exact:true});
 await detail.getByRole('heading',{name:/Test Matte/}).waitFor();
 await page.screenshot({path:path.join(evidence,`order-new-saved-${width}.png`)});
 await detail.getByRole('button',{name:'Cerrar ventana'}).click();
 await page.getByRole('button',{name:/Test Matte.*1000 g/}).waitFor();
 await page.reload();
 await page.getByRole('button',{name:/Test Silk.*1000 g/}).waitFor();
 assert.deepEqual(errors,[]);
 console.log(`PASS ${width}px: first order, two new rolls, draft removal, response lost/retry, invoice, inventory and reload`);
 await context.close();
}
(async()=>{await fs.mkdir(evidence,{recursive:true}); const browser=await chromium.launch({headless:true});try{for(const width of [320,390,1280]) await run(browser,width);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
