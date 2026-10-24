// Run against a local production build with Playwright available via NODE_PATH.
// No real account, provider requests, shared runner, or test configuration changes.
const { chromium, expect } = require('playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3104';
const origin = new URL(baseUrl).origin;
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname), 'Local server required');
const profileKey = 'spool-vault-user-profile';
const evidence = path.resolve('node_modules/.tools/profile-currency-access');

async function run(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      externalRequests.push(url.origin);
      return route.abort();
    }
    if (url.pathname === '/api/supabase-config') return route.fulfill({ json: {} });
    return route.continue();
  });
  await context.addInitScript(key => {
    if (!localStorage.getItem('filament-vault-rolls')) localStorage.setItem('filament-vault-rolls', '[]');
    if (!localStorage.getItem('filament-vault-logs')) localStorage.setItem('filament-vault-logs', '[]');
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
      user_id: 'local', display_name: 'Prueba de moneda', base_currency: 'CRC',
      production_cost_currency: 'CRC', billing_name: 'Nombre conservado'
    }));
  }, profileKey);

  async function openHome() {
    await page.goto(baseUrl);
    // Local mode reaches the same profile panel through Costos, without signing in.
    if (width < 768) await page.getByRole('button', { name: 'Más', exact: true }).click();
    await page.getByRole('button', { name: 'Costos', exact: true }).filter({ visible: true }).click();
    await page.getByRole('button', { name: 'Volver a Tu espacio' }).click();
    await expect(page.getByRole('dialog', { name: 'Perfil', exact: true })).toBeVisible();
  }
  const access = page.getByRole('navigation', { name: 'Moneda de tu espacio', exact: true });
  const shortcut = access.getByRole('button', { name: /Moneda y facturación/ });
  const currency = page.getByRole('combobox', { name: 'Moneda base', exact: true });
  const back = page.getByRole('button', { name: 'Volver a Tu espacio' });

  await openHome();
  await expect(shortcut).toContainText('Moneda base guardada: CRC');
  assert.equal(await page.getByRole('button', { name: /Moneda y facturación/ }).count(), 1);
  // Currency is the first menu action, before membership/community controls.
  assert.equal(await page.locator('.profile-content button:visible').first().textContent(), await shortcut.textContent());
  const visibleWithoutScrolling = await shortcut.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= innerHeight;
  });
  assert.ok(visibleWithoutScrolling, 'Currency shortcut should be visible on opening');
  await page.screenshot({ path: path.join(evidence, `home-${width}.png`) });
  await shortcut.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Moneda y facturación', level: 2, exact: true })).toBeFocused();
  await expect(currency).toHaveAttribute('aria-describedby', 'profile-currency-help');
  assert.deepEqual(await currency.locator('option').evaluateAll(options => options.map(option => option.value)), ['CRC', 'USD', 'EUR']);
  assert.equal(await page.locator('form.profile-preferences:visible select').first().getAttribute('aria-describedby'), 'profile-currency-help');

  await currency.selectOption('USD');
  await page.getByLabel('Nombre para mostrar', { exact: true }).fill('Borrador de prueba');
  await page.keyboard.press('Escape');
  await expect(shortcut).toBeFocused();
  await expect(shortcut).toContainText('Moneda base guardada: CRC');
  await expect(shortcut).toContainText('Cambio de moneda sin guardar');
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).base_currency, profileKey), 'CRC');
  await shortcut.click();
  await expect(currency).toHaveValue('USD');
  await expect(page.getByLabel('Nombre para mostrar', { exact: true })).toHaveValue('Borrador de prueba');
  await page.screenshot({ path: path.join(evidence, `preferences-${width}.png`) });
  assert.ok(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth), 'No horizontal overflow');

  for (const code of ['USD', 'EUR', 'CRC']) {
    await currency.selectOption(code);
    await page.getByRole('button', { name: 'Guardar preferencias', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Cambios guardados.' })).toBeVisible();
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)).base_currency, profileKey)).toBe(code);
    await back.click();
    await expect(shortcut).toContainText(`Moneda base guardada: ${code}`);
    await expect(shortcut).not.toContainText('sin guardar');
    await openHome();
    await expect(shortcut).toContainText(`Moneda base guardada: ${code}`);
    await page.getByRole('button', { name: /Tarifas de impresión/ }).click();
    await expect(page.getByRole('combobox', { name: 'Moneda de costos', exact: true })).toHaveValue('CRC');
    await back.click();
    await shortcut.click();
    await expect(currency).toHaveValue(code);
    await expect(page.getByLabel('Nombre de facturación', { exact: true })).toHaveValue('Nombre conservado');
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, [], 'No external services should be contacted');
  await context.close();
  console.log(`PASS ${width}px: currency access, focus, drafts, three currencies, reload, separate production costs`);
}

(async () => {
  await fs.mkdir(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 390, 1280]) await run(browser, width);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
