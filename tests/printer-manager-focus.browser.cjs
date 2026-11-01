// Local production build only. Providers and printer writes are simulated.
const { chromium, expect } = require('playwright/test');
const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3112';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));

async function run(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  try {
    const page = await context.newPage(), errors = [], requests = [], printers = [];
    let rejectSave;
    page.on('pageerror', error => errors.push(error.message));
    const user = { id: 'd1000000-0000-4000-8000-000000000001', email: 'focus@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
    const token = ['e30', Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'fixture'].join('.');
    await context.addInitScript(({ user, token }) => localStorage.setItem('sb-spool-test-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture', expires_at: Math.floor(Date.now() / 1000) + 3600, user })), { user, token });
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url()), name = url.pathname.split('/').pop();
      if (url.origin === new URL(base).origin) {
        if (url.pathname === '/api/supabase-config') return route.fulfill({ json: { url: 'https://spool-test.supabase.co', publishableKey: 'sb_publishable_fixture' } });
        return route.continue();
      }
      if (url.origin !== 'https://spool-test.supabase.co') return route.abort();
      let data = [];
      if (url.pathname === '/auth/v1/user') data = user;
      else if (name === 'get_tester_first_visit') data = { status: 'active' };
      else if (name === 'user_profiles') data = { user_id: user.id, display_name: 'Fixture', base_currency: 'CRC', production_cost_currency: 'CRC', machine_cost_per_hour: 135 };
      else if (name === 'app_admins') data = null;
      else if (name === 'printers') data = printers;
      else if (name === 'save_printer_v2') {
        const p = req.postDataJSON(); requests.push(p);
        if (requests.length === 1) {
          await new Promise(resolve => { rejectSave = resolve; });
          return route.fulfill({ status: 503, json: { message: 'Fixture: could not confirm save' } });
        }
        const id = p.p_printer_id || `printer-${printers.length + 1}`;
        const printer = { id, name: p.p_name, manufacturer: p.p_manufacturer, model: p.p_model,
          nozzle_diameter_mm: p.p_nozzle_diameter_mm, location: p.p_location, average_power_w: p.p_average_power_w,
          machine_cost_per_hour: p.p_machine_cost_per_hour, machine_cost_currency: p.p_machine_cost_currency,
          notes: p.p_notes, is_active: p.p_is_active, created_at: '2026-11-01T12:00:00Z', updated_at: '2026-11-01T12:00:00Z' };
        const index = printers.findIndex(row => row.id === id);
        if (index < 0) printers.push(printer); else printers[index] = printer;
        data = { printer, replayed: false };
      } else if (req.method() !== 'GET' && !['claim_tester_membership', 'inventory_value_summary'].includes(name)) return route.abort();
      return route.fulfill({ json: data });
    });
    await page.goto(base);
    await page.getByRole('button', { name: /Perfil.*focus@example/ }).click();
    await page.getByRole('button', { name: /Mis impresoras Equipo/ }).click();
    await expect(page.getByRole('heading', { name: 'Mis impresoras', level: 2 })).toBeFocused();
    const headerAdd = page.locator('.printer-manager-actions').getByRole('button', { name: 'Agregar impresora', exact: true });
    const emptyAdd = page.locator('.project-empty').getByRole('button', { name: 'Agregar impresora', exact: true });
    const form = page.locator('.printer-form'), title = form.getByRole('heading', { level: 3 });
    await emptyAdd.click(); await expect(title).toBeFocused();
    await form.getByLabel('Nombre', { exact: true }).fill('Borrador');
    await expect(form.getByLabel('Nombre', { exact: true })).toBeFocused();
    await form.getByRole('button', { name: 'Volver', exact: true }).click(); await expect(emptyAdd).toBeFocused();
    await headerAdd.click(); await expect(title).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Perfil', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Mis impresoras Equipo/ }).click();
    await form.getByRole('button', { name: 'Volver', exact: true }).click(); await expect(headerAdd).toBeFocused();
    assert.equal(requests.length, 0, 'Opening, typing, back and Escape must not save');

    await emptyAdd.click(); await form.getByLabel('Nombre', { exact: true }).fill('P1S de prueba');
    await form.getByRole('button', { name: 'Guardar impresora', exact: true }).click();
    await expect(form.getByRole('button', { name: 'Volver', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cerrar perfil', exact: true })).toBeDisabled();
    await expect.poll(() => typeof rejectSave).toBe('function');
    rejectSave();
    await page.getByRole('dialog').getByRole('status').filter({ hasText: /No se pudo guardar la impresora/ }).waitFor();
    await expect(form.getByLabel('Nombre', { exact: true })).toHaveValue('P1S de prueba');
    await expect.poll(() => form.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await form.getByRole('button', { name: 'Guardar impresora', exact: true }).click();
    await expect(form).toHaveCount(0); await expect(headerAdd).toBeFocused();
    assert.equal(requests[0].p_request_id, requests[1].p_request_id);

    await headerAdd.click(); await form.getByLabel('Nombre', { exact: true }).fill('A1 de prueba');
    await form.getByRole('button', { name: 'Guardar impresora', exact: true }).click(); await expect(headerAdd).toBeFocused();
    const original = page.locator('.printer-card').filter({ hasText: 'P1S de prueba' });
    await original.getByRole('button', { name: 'Editar', exact: true }).click(); await expect(title).toBeFocused();
    await form.getByRole('button', { name: 'Volver', exact: true }).click();
    await expect(original.getByRole('button', { name: 'Editar', exact: true })).toBeFocused();
    await original.getByRole('button', { name: 'Editar', exact: true }).click();
    await form.getByLabel('Nombre', { exact: true }).fill('Z de prueba');
    await form.getByRole('checkbox').uncheck();
    await form.getByRole('button', { name: 'Guardar impresora', exact: true }).click();
    const edited = page.locator('.printer-card').filter({ hasText: 'Z de prueba' });
    await expect(edited.getByRole('button', { name: 'Editar', exact: true })).toBeFocused();
    assert.equal(await page.locator('.printer-card').last().getAttribute('class'), 'printer-card inactive');
    const sizes = await page.getByRole('dialog').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }));
    assert.ok(sizes.scroll <= sizes.width + 1); assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: entry/typing, both add triggers, Escape, failed save, empty-state fallback, edit/back/save and reordered cards`);
  } finally { await context.close(); }
}
(async () => {
  const browser = await chromium.launch();
  try { for (const width of [320, 390, 1280]) await run(browser, width); }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
