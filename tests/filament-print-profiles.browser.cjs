// Local production build. All provider traffic is mocked; no real account or writes.
const { chromium, expect } = require('playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3117';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const user = { id: 'da250000-0000-4000-8000-000000000001', email: 'profiles@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
const printer = { id: 'da250000-0000-4000-8000-000000000011', name: 'P1S de prueba', model: 'P1S', is_active: true };
const roll = { id: 'da250000-0000-4000-8000-000000000021', brand: 'Elegoo', material: 'PLA', product_line: 'PLA Pro', color_name: 'Rojo', color_hex: '#aa2222', status: 'open', initial_weight_g: 1000, available_weight_g: 500, low_threshold_g: 100, currency: 'CRC', package_type: 'refill', spool_cost_amount: 0 };
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
      const page = await context.newPage(), errors = [], attempts = [], revisions = [];
      page.on('pageerror', error => errors.push(error.message));
      const token = ['e30', Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'test'].join('.');
      await context.addInitScript(({ user, token }) => localStorage.setItem('sb-spool-test-auth-token', JSON.stringify({ access_token: token, refresh_token: 'test', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user })), { user, token });
      let release;
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url()), table = url.pathname.split('/').pop();
        if (url.origin === base) return url.pathname === '/api/supabase-config'
          ? route.fulfill({ json: { url: 'https://spool-test.supabase.co', publishableKey: 'sb_publishable_test' } }) : route.continue();
        if (url.origin !== 'https://spool-test.supabase.co') return route.abort();
        if (table === 'save_filament_print_profile') {
          assert.equal(request.headers().authorization, `Bearer ${token}`);
          const body = request.postDataJSON(); attempts.push(body);
          let saved = revisions.find(item => item.request_id === body.p_request_id);
          const replayed = !!saved;
          if (!saved) {
            saved = { ...body.p_values, id: crypto.randomUUID(), user_id: user.id, profile_id: body.p_profile_id,
              request_id: body.p_request_id, version: body.p_expected_version + 1, printer_name: printer.name, created_at: new Date().toISOString() };
            revisions.push(saved);
          }
          if (attempts.length === 1) {
            await new Promise(resolve => { release = resolve; });
            return route.fulfill({ status: 503, json: { message: 'Respuesta perdida', code: '503' } });
          }
          return route.fulfill({ json: { profile: saved, replayed } });
        }
        const latest = [...new Map(revisions.map(item => [item.profile_id, item])).values()];
        const data = table === 'user' ? user : table === 'get_tester_first_visit' ? { status: 'active' }
          : table === 'user_profiles' ? { user_id: user.id, base_currency: 'CRC' }
          : table === 'filament_rolls' ? [roll] : table === 'printers' ? [printer]
          : table === 'filament_print_profiles_current' ? latest : table === 'filament_print_profiles' ? [...revisions].reverse() : [];
        return route.fulfill({ json: data });
      });
      async function open() {
        await page.goto(base);
        await page.getByRole('button', { name: /Perfil.*profiles@example/ }).waitFor();
        await page.getByRole('button', { name: 'Inventario', exact: true }).filter({ visible: true }).click();
        await page.getByRole('button', { name: 'Perfiles de impresión', exact: true }).click();
        await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      }
      await open();
      const modal = page.getByRole('dialog');
      await modal.getByRole('button', { name: 'Nueva configuración' }).click();
      await expect(modal.getByRole('heading', { name: 'Configuración de impresión', exact: true })).toBeFocused();
      await modal.getByLabel('Nombre del perfil').fill('PLA Pro probado');
      await modal.getByRole('combobox').selectOption(printer.id);
      await modal.getByLabel('Laminador y versión').fill('Bambu Studio');
      await modal.getByLabel('Diámetro de boquilla (mm)').fill('0,4');
      await modal.getByLabel('Temperatura de cama (°C)').fill('0');
      await modal.getByLabel('Temperatura de boquilla (°C)').fill('220');
      await modal.getByLabel('Notas y resultado de las pruebas').fill('Primera calibración');
      await fs.mkdir('node_modules/.tools/print-profiles', { recursive: true });
      await page.screenshot({ path: `node_modules/.tools/print-profiles/form-${width}.png` });
      assert.ok(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Horizontal overflow');
      await modal.getByRole('button', { name: 'Guardar configuración', exact: true }).click();
      await expect(modal).toHaveAttribute('aria-busy', 'true');
      await expect(modal.getByRole('button', { name: 'Cerrar perfiles de impresión' })).toBeDisabled();
      await page.keyboard.press('Escape');
      assert.equal(attempts.length, 1);
      release();
      await modal.getByRole('alert').waitFor();
      await page.reload();
      await page.getByRole('button', { name: 'Inventario', exact: true }).filter({ visible: true }).click();
      await page.getByRole('button', { name: 'Perfiles de impresión', exact: true }).click();
      await expect(modal.getByLabel('Nombre del perfil')).toHaveValue('PLA Pro probado');
      await expect(modal.getByLabel('Nombre del perfil')).toBeDisabled();
      await modal.getByRole('button', { name: 'Reintentar guardado' }).click();
      await expect(modal.getByRole('status')).toContainText('ya estaba guardada');
      assert.deepEqual(attempts[0], attempts[1]); assert.equal(revisions.length, 1);
      assert.equal(revisions[0].flow_ratio, null); assert.equal(revisions[0].bed_temperature_c, 0);
      await modal.getByRole('button', { name: 'Editar PLA Pro probado' }).click();
      await expect(modal.getByLabel('Temperatura de boquilla (°C)')).toHaveValue('220');
      await modal.getByLabel('Temperatura de boquilla (°C)').fill('225');
      await modal.getByRole('button', { name: 'Guardar configuración', exact: true }).click();
      await modal.getByRole('button', { name: 'Historial de PLA Pro probado' }).click();
      await expect(modal.getByRole('heading', { name: 'PLA Pro probado · Revisión 1' })).toBeVisible();
      assert.equal(revisions.length, 2); assert.equal(revisions[0].nozzle_temperature_c, 220); assert.equal(revisions[1].nozzle_temperature_c, 225);
      await page.screenshot({ path: `node_modules/.tools/print-profiles/history-${width}.png` });
      await modal.getByRole('button', { name: 'Cerrar perfiles de impresión' }).click();
      await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${width}px: create, busy guard, lost response/reload/retry, edit and immutable history`);
    }
    const context = await browser.newContext(); const page = await context.newPage();
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin !== base ? route.abort() : url.pathname === '/api/supabase-config' ? route.fulfill({ json: {} }) : route.continue();
    });
    await page.goto(base);
    await page.getByRole('button', { name: 'Inventario', exact: true }).filter({ visible: true }).click();
    await page.getByRole('button', { name: 'Perfiles de impresión', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('El modo local/demo no guarda estas configuraciones');
    assert.equal(await page.getByRole('button', { name: 'Nueva configuración' }).count(), 0);
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
    await context.close();
    console.log('PASS demo/local: explicit sign-in requirement, no false persistence');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
