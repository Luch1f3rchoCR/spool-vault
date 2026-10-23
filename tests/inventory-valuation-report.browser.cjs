// Local fixture test. Blocks external traffic; never queries BCCR or real inventory.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3117';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const user = { id: 'd1000000-0000-4000-8000-000000000001', email: 'valuation@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
const first = { roll_id: 'roll-1', user_id: user.id, brand: 'Elegoo', material: 'PLA', product_line: 'PLA Pro', color_name: 'Rojo', color_hex: '#aa2222', status: 'open', initial_weight_g: 1000, available_weight_g: 500, remaining_percent: 50, currency: 'USD', purchase_total: 20, remaining_filament_value: 10, cost_status: 'recorded' };
const rows = [first, { ...first, roll_id: 'roll-2', color_name: 'Azul' }];
const values = rows.map((row, index) => ({ ...row, original_currency: 'USD', acquisition_date: '2026-09-30', remaining_original_value: 12, remaining_crc_value: index ? null : 6000, remaining_usd_value: 12, fx_status: index ? 'incomplete' : 'complete', incompleteness_reason: index ? 'missing_fx_snapshot' : null, cost_basis_source: 'purchase_order_landed', cost_confidence: 'actual', fx_source: index ? null : 'BCCR' }));
(async () => {
  const browser = await chromium.launch({ headless: true });
  try { for (const width of [320, 390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [], writes = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const token = ['e30', Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'test'].join('.');
    await context.addInitScript(({ user, token }) => localStorage.setItem('sb-spool-test-auth-token', JSON.stringify({ access_token: token, refresh_token: 'test', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user })), { user, token });
    let fail = false;
    await context.route('**/*', async (route) => {
      const req = route.request(), url = new URL(req.url()), name = url.pathname.split('/').pop();
      if (req.method() !== 'GET') writes.push(url.pathname);
      if (url.origin === base) return url.pathname === '/api/supabase-config' ? route.fulfill({ json: { url: 'https://spool-test.supabase.co', publishableKey: 'sb_publishable_test' } }) : route.continue();
      if (url.origin !== 'https://spool-test.supabase.co') return route.abort();
      if (name === 'filament_inventory_valuation' && fail) return route.fulfill({ status: 400, json: { message: 'Fixture read error' } });
      const result = name === 'user' ? user : name === 'user_profiles' ? { user_id: user.id, base_currency: 'CRC' } : name === 'get_tester_first_visit' ? { status: 'active' } : name === 'filament_balance_report' ? rows : name === 'filament_inventory_valuation' ? values : [];
      return route.fulfill({ json: result });
    });
    await page.goto(base);
    await page.getByRole('button', { name: /Perfil.*valuation@example/ }).waitFor();
    const open = async () => {
      if (width < 780) await page.getByRole('button', { name: 'Más', exact: true }).click();
      await page.getByRole('button', { name: 'Reportes', exact: true }).click();
    };
    await open();
    const modal = page.getByRole('dialog', { name: 'Saldo de filamentos' });
    await modal.getByText('Tasa histórica BCCR pendiente').waitFor();
    const summary = modal.getByLabel('Valor histórico en CRC y USD');
    assert.match(await summary.innerText(), /Subtotal disponible/);
    assert.match(await summary.innerText(), /1 pendientes, no incluidos/);
    assert.match(await summary.innerText(), /24/);
    await fs.mkdir('node_modules/.tools/valuation-report', { recursive: true });
    await page.screenshot({ path: `node_modules/.tools/valuation-report/${width}.png` });
    const dimensions = await modal.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, children: [...el.children].filter(child => child.scrollWidth > el.clientWidth).map(child => [child.className, child.scrollWidth]) }));
    assert.ok(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions));
    await modal.getByLabel('Buscar en el reporte').fill('Rojo');
    assert.doesNotMatch(await summary.innerText(), /pendientes/);
    const [download] = await Promise.all([page.waitForEvent('download'), modal.getByRole('button', { name: 'Descargar CSV' }).click()]);
    const csv = await fs.readFile(await download.path(), 'utf8');
    assert.match(csv, /Restante histórico CRC/); assert.match(csv, /6000/); assert.doesNotMatch(csv, /Azul/);
    await modal.getByRole('button', { name: 'Cerrar reporte' }).click();
    fail = true; await open();
    await modal.getByRole('button', { name: 'Reintentar valoración' }).waitFor();
    fail = false; await modal.getByRole('button', { name: 'Reintentar valoración' }).click();
    await modal.getByText('Tasa histórica BCCR pendiente').waitFor();
    assert.deepEqual(errors, []);
    assert.deepEqual(writes.filter(path => !path.endsWith('/get_tester_first_visit')), []);
    console.log(`PASS ${width}px: partial/native values, filter, CSV, error/retry, no writes, no overflow/errors`);
    await context.close();
  }
    const local = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: 'block' });
    const localPage = await local.newPage(), external = [];
    await local.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) { external.push(url.href); return route.abort(); }
      return url.pathname === '/api/supabase-config' ? route.fulfill({ json: { url: '', publishableKey: '' } }) : route.continue();
    });
    await localPage.goto(base);
    await localPage.getByRole('button', { name: 'Más', exact: true }).click();
    await localPage.getByRole('button', { name: 'Reportes', exact: true }).click();
    const localModal = localPage.getByRole('dialog', { name: 'Saldo de filamentos' });
    await localModal.getByText(/No se calculan conversiones en modo local\/demo/).waitFor();
    assert.equal(await localModal.getByRole('columnheader', { name: 'Histórico CRC' }).count(), 0);
    assert.deepEqual(external, []);
    console.log('PASS local/demo: no FX queries or fabricated converted values');
    await local.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
