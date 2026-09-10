const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const userId = 'a0000000-0000-4000-8000-000000000002';
const outputDir = path.resolve('node_modules/.tools/evidence');

async function run(browser, { admin, width, configured = false, uncertainWelcome = false }) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const user = { id: userId, email: 'tester@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const token = ['e30', Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url'), 'test'].join('.');
  await context.addInitScript(({ user, token }) => localStorage.setItem('sb-spool-test-auth-token', JSON.stringify({ access_token: token, refresh_token: 'test', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user })), { user, token });
  await page.route('**/api/supabase-config', (route) => route.fulfill({ json: { url: 'https://spool-test.supabase.co', publishableKey: 'sb_publishable_test' } }));
  let welcomeCalls = 0;
  let failFirstReservation = true;
  const deliveries = [];
  await page.route('**/api/admin/tester-welcome', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { configured } });
    welcomeCalls++;
    const alreadySent = deliveries.length > 0;
    if (!alreadySent) deliveries.push({ membership_id: 'new-member', status: 'accepted', first_attempt_at: new Date().toISOString() });
    if (uncertainWelcome && welcomeCalls === 1) return route.fulfill({ status: 503, json: { error: 'La licencia está guardada. No pudimos confirmar el correo; revisá su estado antes de reintentar.' } });
    return route.fulfill({ json: { status: 'accepted', already_sent: alreadySent } });
  });
  const members = [];
  const feedback = [];
  let failFirstFeedback = true;
  let submitCalls = 0;
  await page.route('https://spool-test.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const name = url.pathname.split('/').pop();
    const payload = request.postDataJSON();
    let result = [];
    if (url.pathname === '/auth/v1/user') result = user;
    else if (name === 'user_profiles') result = { user_id: userId, display_name: 'Tester', base_currency: 'CRC', membership_status: 'early_access' };
    else if (name === 'app_admins') result = admin ? { user_id: userId } : null;
    else if (name === 'get_tester_first_visit') result = { status: 'active' };
    else if (name === 'claim_tester_membership') result = { id: 'active-member', email: user.email, user_id: userId, activated_at: new Date().toISOString(), plan_code: 'founder_personal_v1' };
    else if (name === 'tester_memberships') result = members;
    else if (name === 'tester_welcome_deliveries') result = deliveries;
    else if (name === 'reserve_tester_invitation') {
      result = members.find((m) => m.email === payload.p_email) || { id: 'new-member', email: payload.p_email, display_name: payload.p_name, printers: payload.p_printers, user_id: null, activated_at: null, cancelled_at: null };
      if (!members.length) members.push(result);
      if (failFirstReservation) {
        failFirstReservation = false;
        return route.fulfill({ status: 503, json: { message: 'Simulated lost reservation response' } });
      }
    } else if (name === 'submit_feedback') {
      submitCalls++;
      result = feedback.find((f) => f.id === payload.p_id) || { id: payload.p_id, user_id: userId, title: payload.p_title, details: payload.p_details, kind: payload.p_kind, status: 'received', admin_reply: '', created_at: new Date().toISOString() };
      if (!feedback.length) feedback.push(result);
      if (failFirstFeedback) { failFirstFeedback = false; await route.fulfill({ status: 503, json: { message: 'Simulated lost response' } }); return; }
    } else if (name === 'user_feedback') {
      if (request.method() === 'PATCH') { Object.assign(feedback[0], payload); result = feedback[0]; }
      else result = feedback;
    } else if (name === 'export_my_data') {
      await new Promise((resolve) => setTimeout(resolve, 600));
      result = { format: 'spool-vault-account', version: 1, source: 'supabase', user_id: userId, tables: { user_feedback: feedback } };
    }
    await route.fulfill({ json: result });
  });

  await page.goto(baseUrl);
  await page.getByRole('button', { name: /Perfil.*tester@example/ }).click();
  await page.getByRole('heading', { name: 'Probador fundador' }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Nombre para mostrar' }).count(), 0);
  const panel = page.getByRole('dialog');
  assert.equal(await panel.count(), 1);
  await panel.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
  const frame = await panel.boundingBox();
  assert.equal(Math.round(frame.x + frame.width), width, 'drawer must align with the right edge');
  assert.equal(Math.round(frame.height), 844, 'drawer must use the viewport height');
  await page.screenshot({ path: path.join(outputDir, `account-menu-${admin ? 'admin' : 'tester'}-${width}.png`) });
  await page.getByRole('button', { name: /Compartir una idea/ }).click();
  const section = page.getByRole('region', { name: 'Compartir una idea' });
  await section.getByLabel('Tipo de aporte').selectOption('bug');
  await section.getByLabel('Título', { exact: true }).fill('El QR no abre mi rollo');
  await section.getByLabel('Qué pasó y qué esperabas').fill('Escaneé la etiqueta y esperaba ver la ficha de mi filamento.');
  await page.getByRole('button', { name: 'Volver a Tu espacio' }).click();
  assert.match(await page.locator(':focus').innerText(), /Compartir una idea/);
  await page.getByRole('button', { name: /Compartir una idea/ }).click();
  assert.equal(await section.getByLabel('Título', { exact: true }).inputValue(), 'El QR no abre mi rollo', 'back navigation must preserve drafts');
  assert.equal(await page.getByRole('dialog', { name: 'Compartir una idea', exact: true }).count(), 1);
  await page.screenshot({ path: path.join(outputDir, `account-feedback-${width}.png`) });
  const closeBounds = await page.getByRole('button', { name: 'Cerrar perfil' }).boundingBox();
  assert.ok(closeBounds.x >= 0 && closeBounds.x + closeBounds.width <= width, 'close button must remain in the viewport');
  await section.getByRole('button', { name: 'Enviar aporte' }).click();
  await page.getByRole('alert').filter({ hasText: 'No pudimos confirmar' }).waitFor();
  assert.equal(await section.getByLabel('Título', { exact: true }).inputValue(), 'El QR no abre mi rollo');
  await section.getByRole('button', { name: 'Enviar aporte' }).click();
  await page.getByRole('status').filter({ hasText: 'Aporte recibido' }).waitFor();
  assert.equal(submitCalls, 2);
  assert.equal(feedback.length, 1, 'uncertain retry must reuse the same ID');
  await page.getByRole('button', { name: 'Volver a Tu espacio' }).click();
  await page.getByRole('button', { name: /Mis datos/ }).click();
  const downloadPromise = page.waitForEvent('download');
  void downloadPromise.catch(() => {});
  await page.getByRole('button', { name: 'Descargar mis datos' }).click();
  await page.getByRole('button', { name: 'Preparando…' }).waitFor();
  await page.locator('button[aria-label="Volver a Tu espacio"]:disabled').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Volver a Tu espacio' }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Cerrar perfil' }).isDisabled(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog', { name: 'Mis datos', exact: true }).count(), 1);
  const download = await downloadPromise;
  const exported = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  assert.equal(exported.user_id, userId);
  await page.getByRole('button', { name: 'Editar perfil y facturación' }).click();
  await page.getByLabel('Nombre para mostrar', { exact: true }).fill('Borrador conservado');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Moneda y facturación/ }).click();
  assert.equal(await page.getByLabel('Nombre para mostrar', { exact: true }).inputValue(), 'Borrador conservado');
  await page.getByRole('button', { name: 'Volver a Tu espacio' }).click();
  await page.getByRole('button', { name: /Tarifas de impresión/ }).click();
  await page.getByLabel('Electricidad por kWh', { exact: true }).fill('95');
  await page.getByRole('button', { name: 'Volver a Tu espacio' }).click();
  await page.getByRole('button', { name: /Tarifas de impresión/ }).click();
  assert.equal(await page.getByLabel('Electricidad por kWh', { exact: true }).inputValue(), '95');
  await page.getByRole('button', { name: 'Volver a Tu espacio' }).click();

  if (admin) {
    await page.getByRole('button', { name: /Grupo de pruebas/ }).click();
    const group = page.getByRole('region', { name: 'Grupo de pruebas' });
    await group.getByLabel('Nombre', { exact: true }).fill('Probador de iPhone');
    await group.getByLabel('Correo de acceso').fill('iphone@example.invalid');
    await group.getByLabel('Por qué invitamos a esta persona').fill('Experiencia probando inventarios');
    await group.getByLabel('Qué nos gustaría que pruebe (opcional)').fill('Uso desde iPhone');
    await group.getByRole('button', { name: configured ? 'Guardar y enviar bienvenida' : 'Dar acceso gratuito de por vida' }).click();
    await page.getByRole('alert').filter({ hasText: 'No pudimos confirmar' }).waitFor();
    assert.equal(await group.getByLabel('Correo de acceso').inputValue(), 'iphone@example.invalid');
    assert.equal(await page.locator(':focus').getAttribute('role'), 'alert', 'uncertain reservation must reveal the error');
    assert.equal(welcomeCalls, 0, 'an unconfirmed reservation must not send email');
    await group.getByRole('button', { name: configured ? 'Guardar y enviar bienvenida' : 'Dar acceso gratuito de por vida' }).click();
    if (uncertainWelcome) {
      await page.getByRole('alert').filter({ hasText: 'No pudimos confirmar el correo' }).waitFor();
      assert.equal(await group.getByLabel('Nombre', { exact: true }).inputValue(), 'Probador de iPhone');
      assert.equal(await group.getByLabel('Por qué invitamos a esta persona').inputValue(), 'Experiencia probando inventarios');
      assert.equal(welcomeCalls, 1, 'must not retry the email automatically');
      await group.getByRole('button', { name: 'Guardar y enviar bienvenida' }).click();
    }
    const invitation = group.getByRole('article', { name: 'Invitación de Probador de iPhone', exact: true });
    await invitation.getByRole('status').waitFor();
    assert.equal(await group.getByLabel('Nombre', { exact: true }).inputValue(), '');
    assert.equal(await group.getByLabel('Correo de acceso').inputValue(), '');
    assert.equal(await group.getByLabel('Por qué invitamos a esta persona').inputValue(), '');
    assert.equal(await group.getByLabel('Qué nos gustaría que pruebe (opcional)').inputValue(), '');
    assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Invitación de Probador de iPhone');
    const confirmationBounds = await invitation.getByRole('status').boundingBox();
    assert.ok(confirmationBounds.y >= 0 && confirmationBounds.y + confirmationBounds.height <= 844, 'confirmation must be inside the viewport');
    assert.equal(members.length, 1, 'retry must recover the existing membership');
    assert.equal(deliveries.length, configured ? 1 : 0, 'retry must not duplicate the email');
    assert.equal(await page.getByRole('dialog').count(), 1, 'keep the saved invitation available in the panel');
    await page.screenshot({ path: path.join(outputDir, `invitation-confirmed-${width}.png`) });
    await group.getByText('Pendiente de primer ingreso', { exact: true }).waitFor();
    await group.getByRole('link', { name: 'Abrir bienvenida en mi correo' }).waitFor();
    if (configured) await group.getByText('Bienvenida aceptada para envío', { exact: true }).waitFor();
    assert.equal(welcomeCalls, configured ? uncertainWelcome ? 2 : 1 : 0);
    await group.getByLabel(/^Estado/).selectOption('reviewing');
    await group.getByLabel('Respuesta', { exact: true }).fill('Estamos revisando la lectura de esta etiqueta.');
    await group.getByRole('button', { name: 'Guardar seguimiento' }).click();
    await page.getByRole('status').filter({ hasText: 'Seguimiento actualizado' }).waitFor();
    assert.equal(feedback[0].status, 'reviewing');
  } else {
    assert.equal(await page.getByRole('button', { name: /Grupo de pruebas/ }).count(), 0);
  }
  await page.locator('.profile-content').evaluate((element) => { element.scrollTop = 0; });
  const overflow = await panel.evaluate((element) => ({ scroll: element.scrollWidth, width: element.clientWidth }));
  assert.ok(overflow.scroll <= overflow.width + 1, JSON.stringify(overflow));
  await page.screenshot({ path: path.join(outputDir, `account-${admin ? 'admin' : 'tester'}-${width}.png`) });
  if (admin) await page.getByRole('button', { name: 'Volver a Tu espacio' }).click();
  await page.getByRole('button', { name: 'Cerrar perfil', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  assert.match(await page.locator(':focus').innerText(), /Cerrar sesión/);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Cerrar perfil');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.match(await page.locator(':focus').innerText(), /Perfil/);
  assert.deepEqual(errors, []);
  console.log(`PASS ${admin ? 'admin' : 'tester'} ${width}px: feedback retry, account export, role visibility, no overflow or page errors`);
  await context.close();
}

(async () => {
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER_CHANNEL || undefined });
  try {
    await run(browser, { admin: true, width: 390 });
    await run(browser, { admin: false, width: 390 });
    await run(browser, { admin: false, width: 320 });
    await run(browser, { admin: true, width: 1280, configured: true });
    await run(browser, { admin: true, width: 320, configured: true, uncertainWelcome: true });
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
