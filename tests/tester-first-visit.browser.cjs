// All APIs are simulated; no messages, accounts or cloud data are changed.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3101";
async function run(browser, width) {
 const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
 const user = { id: "a0000000-0000-4000-8000-000000000002", email: "tester@example.invalid", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
 const token = ["e30", Buffer.from(JSON.stringify({ sub:user.id, exp:Math.floor(Date.now()/1000)+3600, role:"authenticated" })).toString("base64url"), "test"].join(".");
 await context.addInitScript(({user,token}) => localStorage.setItem("sb-spool-test-auth-token",JSON.stringify({access_token:token,refresh_token:"test",expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:"bearer",user})),{user,token});
 let active=false, calls=0, originalAnswers, printers=[];
 await context.route("**/*",async route => {
  const req=route.request(), url=new URL(req.url()), name=url.pathname.split("/").pop();
  if(url.origin===new URL(baseUrl).origin) {
   if(url.pathname==="/api/supabase-config") return route.fulfill({json:{url:"https://spool-test.supabase.co",publishableKey:"sb_publishable_test"}});
   return route.continue();
  }
  if(url.origin!=="https://spool-test.supabase.co") return route.abort();
  let data=[];
  if(url.pathname==="/auth/v1/user") data=user;
  else if(name==="user_profiles") data={user_id:user.id,display_name:"Tester",base_currency:"CRC",production_cost_currency:"CRC",machine_cost_per_hour:0,labor_cost_per_hour:0};
  else if(name==="get_tester_first_visit") data={status:active?"active":"pending",display_name:"Tester"};
  else if(name==="printers") data=printers;
  else if(name==="app_admins") data=null;
  else if(name==="claim_tester_membership") data=active?{id:"member",activated_at:"2026-09-08"}:null;
  else if(name==="complete_tester_first_visit") {
   calls++;
   const answers=req.postDataJSON().p_answers;
   if(!active) {
    originalAnswers=answers; active=true;
    printers=answers.printers.map((p,i)=>({...p,id:"printer-"+i,is_active:true,creation_request_id:"request-"+i,average_power_w:null,machine_cost_per_hour:null,machine_cost_currency:"CRC",nozzle_diameter_mm:null,created_at:"2026-09-08",updated_at:"2026-09-08"}));
    // Accepted by the simulated server, but the first response is lost.
    return route.fulfill({status:503,json:{message:"Lost response"}});
   }
   assert.deepEqual(answers,originalAnswers,"retry changed answers");
   data={status:"active",printers};
  } else if(name==="save_printer_v2") {
   const v=req.postDataJSON();
   let printer=printers.find(p=>p.id===v.p_printer_id);
   if(!printer) {printer={id:"printer-"+printers.length,creation_request_id:v.p_request_id,created_at:"2026-09-08"};printers.push(printer);}
   Object.assign(printer,{name:v.p_name,manufacturer:v.p_manufacturer,model:v.p_model,location:v.p_location,average_power_w:v.p_average_power_w,machine_cost_per_hour:v.p_machine_cost_per_hour,machine_cost_currency:v.p_machine_cost_currency,nozzle_diameter_mm:v.p_nozzle_diameter_mm,is_active:v.p_is_active,updated_at:"2026-09-08"});
   data={printer,replayed:false};
  }
  return route.fulfill({json:data});
 });
 const page=await context.newPage(); const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(baseUrl);
 try { await page.getByRole("dialog",{name:"Conozcamos tu taller"}).waitFor(); }
 catch (error) {
  console.error("Fixture page:", await page.locator("body").innerText(), "Page errors:", errors);
  await page.screenshot({path:path.resolve("node_modules/.tools/evidence/first-visit-failure.png")});
  throw error;
 }
 await page.getByLabel("Experiencia en impresión 3D").selectOption("intermediate");
 await page.getByLabel("¿Cómo usás la impresión 3D?").selectOption("both");
 await page.getByLabel("¿Qué imprimís o para qué la usás?").fill("Figuras y piezas para vender");
 await page.getByLabel("¿Desde dónde usarás la app?").selectOption("mixed");
 for(const name of ["P1S principal","Ender secundaria"]) {
  await page.getByRole("button",{name:"Agregar otra impresora"}).click();
  await page.getByLabel("Nombre o apodo").last().fill(name);
 }
 await page.getByLabel("Entiendo el alcance personal").check();
 const panel=page.getByRole("dialog");
 const size=await panel.evaluate(e=>({w:e.clientWidth,s:e.scrollWidth,right:e.getBoundingClientRect().right,viewport:innerWidth}));
 assert.ok(size.s<=size.w+1&&size.right<=size.viewport+1,JSON.stringify(size));
 await panel.evaluate(element => { element.scrollTop=0; });
 await page.screenshot({path:path.resolve("node_modules/.tools/evidence/first-visit-"+width+".png")});
 await page.getByRole("heading",{name:"Tus impresoras",exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:path.resolve("node_modules/.tools/evidence/first-visit-printers-"+width+".png")});
 await page.getByRole("button",{name:"Guardar y activar mi acceso"}).click();
 await page.getByRole("alert").filter({hasText:"No pudimos confirmar"}).waitFor();
 assert.equal(await page.getByLabel("Nombre o apodo").count(),2);
 await page.getByRole("button",{name:"Guardar y activar mi acceso"}).click();
 await page.getByRole("dialog").waitFor({state:"hidden"});
 assert.equal(calls,2); assert.equal(printers.length,2);
 await page.getByRole("button",{name:/Perfil.*tester@example/}).click();
 await page.getByRole("button",{name:/Mis impresoras Equipo/}).click();
 await page.getByRole("heading",{name:"Mis impresoras",exact:true}).first().waitFor();
 const cards=page.locator(".profile-panel .printer-card");
 assert.equal(await cards.count(),2);
 await cards.first().getByRole("button",{name:"Editar"}).click();
 await page.getByLabel("Nombre",{exact:true}).fill("Ender editada");
 await page.getByLabel("Disponible para nuevas impresiones").uncheck();
 await page.getByRole("button",{name:"Volver a Tu espacio"}).click();
 await page.getByRole("button",{name:/Mis impresoras Equipo/}).click();
 assert.equal(await page.getByLabel("Nombre",{exact:true}).inputValue(),"Ender editada","profile navigation lost draft");
 await page.getByRole("button",{name:"Guardar impresora",exact:true}).click();
 await page.locator(".profile-panel .printer-card.inactive").waitFor();
 assert.equal(printers.filter(p=>!p.is_active).length,1);
 assert.equal(originalAnswers.printers[0].name,"P1S principal","historical onboarding changed");
 const profileSize=await page.getByRole("dialog").evaluate(e=>({w:e.clientWidth,s:e.scrollWidth}));
 assert.ok(profileSize.s<=profileSize.w+1,JSON.stringify(profileSize));
 await page.screenshot({path:path.resolve("node_modules/.tools/evidence/profile-printers-"+width+".png")});
 await page.reload();
 await page.getByRole("button",{name:/Perfil.*tester@example/}).waitFor();
 await page.waitForTimeout(200);
 assert.equal(await page.getByRole("dialog").count(),0,"questionnaire repeated after activation");
 assert.equal(calls,2);
 assert.deepEqual(errors,[]);
 await context.close();
 console.log("PASS first visit, retry, multiple printers, profile edits, one-time form "+width+"px");
}
(async()=>{
 await fs.mkdir(path.resolve("node_modules/.tools/evidence"),{recursive:true});
 const browser=await chromium.launch({headless:true});
 try {for(const width of [320,390,1280]) await run(browser,width);}
 finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
