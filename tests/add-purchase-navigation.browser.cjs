// Isolated browser fixtures: no real account, purchase, or spool is modified.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3100";
const evidence = path.resolve("node_modules/.tools/evidence");
const order = {
  id: "test-crc", request_id: "fixture-crc", supplier_id: null, supplier_name: "Proveedor de prueba",
  purchased_at: "2026-09-07", currency: "CRC", subtotal_amount: 12500,
  shipping_amount: 1500, other_charges_amount: 0.94, total_amount: 14000.94,
  allocation_method: "per_unit", cost_confidence: "actual", notes: "Referencia de prueba — sin factura fiscal"
};
const item = {
  id: "line-crc", order_id: order.id, purchase_history_id: "purchase-crc", roll_id: null,
  brand: "Bambu Lab", material: "PLA", product_line: "PLA Silk+", color_name: "Candy Red", color_hex: "#D02727",
  package_type: "spooled", quantity_g: 1000, base_amount: 12500, spool_cost: 1000, filament_base_cost: 11500,
  allocated_shipping: 1500, allocated_other_charges: .94, landed_total: 14000.94,
  filament_landed_cost: 13000.94, currency: "CRC", cost_confidence: "actual"
};
const usdOrder = { ...order, id: "test-usd", request_id: "fixture-usd", supplier_name: "Proveedor USD",
  currency: "USD", subtotal_amount: 20.12, shipping_amount: 2.5, other_charges_amount: 0, total_amount: 22.62, cost_confidence: "estimated" };
const usdItem = { ...item, id: "line-usd", order_id: usdOrder.id, purchase_history_id: "purchase-usd",
  color_name: "Latte Brown", color_hex: "#D3B7A7", currency: "USD", base_amount: 20.12, spool_cost: 0,
  filament_base_cost: 20.12, allocated_shipping: 2.5, allocated_other_charges: 0,
  landed_total: 22.62, filament_landed_cost: 22.62, package_type: "refill" };

async function checkViewport(page) {
  const sizes = await page.getByRole("dialog").evaluate((element) => ({
    width: element.clientWidth, scroll: element.scrollWidth,
    left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right,
    viewport: window.innerWidth
  }));
  assert.ok(sizes.scroll <= sizes.width + 1 && sizes.left >= 0 && sizes.right <= sizes.viewport + 1, JSON.stringify(sizes));
}

async function run(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(baseUrl).origin) return route.abort();
      if (url.pathname === "/api/supabase-config") return route.fulfill({ json: { url: "", publishableKey: "" } });
      return route.continue();
    });
    await context.addInitScript(({ order, item, usdOrder, usdItem }) => {
      localStorage.setItem("filament-vault-rolls", "[]");
      localStorage.setItem("filament-vault-logs", "[]");
      localStorage.setItem("spool-vault-purchase-orders", JSON.stringify([order, usdOrder]));
      localStorage.setItem("spool-vault-purchase-order-items", JSON.stringify([item, usdItem]));
      localStorage.setItem("spool-vault-purchase-order-payments", JSON.stringify([{
        order_id: usdOrder.id, paid_amount: 11310, paid_currency: "CRC", exchange_rate: 500,
        exchange_rate_date: "2026-09-07", exchange_rate_kind: "paid", exchange_rate_source: "Comprobante de prueba"
      }]));
    }, { order, item, usdOrder, usdItem });
    await page.goto(baseUrl);
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await page.getByRole("dialog", { name: "¿Qué querés agregar?" }).waitFor();
    await checkViewport(page);
    await page.screenshot({ path: path.join(evidence, `add-menu-${width}.png`) });
    await page.getByRole("button", { name: /Nuevo filamento/ }).click();
    await page.getByRole("dialog", { name: "Nuevo rollo" }).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await page.getByRole("button", { name: /Asignar spool Vinculá/ }).click();
    await page.getByRole("dialog", { name: "Asignar spool" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Asignar spool", exact: true }).last().isDisabled(), true);
    await page.getByRole("button", { name: "Crear spool", exact: true }).click();
    await page.getByLabel("Código", { exact: true }).fill("SP-PRUEBA");
    await page.getByRole("button", { name: "Mis spools", exact: true }).click();
    assert.equal(await page.getByLabel("Código", { exact: true }).isVisible(), false);
    await page.getByRole("button", { name: "Crear spool", exact: true }).click();
    assert.equal(await page.getByLabel("Código", { exact: true }).inputValue(), "SP-PRUEBA", "spool draft survives navigation");
    await checkViewport(page);
    await page.getByRole("button", { name: "Agregar spool vacío", exact: true }).click();
    await page.getByRole("dialog").getByRole("status").filter({ hasText: /SP-PRUEBA agregado/ }).waitFor();
    await page.getByRole("button", { name: "Mis spools", exact: true }).click();
    await page.getByText("SP-PRUEBA", { exact: true }).waitFor();
    await page.screenshot({ path: path.join(evidence, `spools-${width}.png`) });
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Compras", exact: true }).click();
    await page.getByRole("dialog", { name: "Mis compras" }).waitFor();
    assert.equal(await page.locator(".purchase-invoice-card").count(), 2);
    await checkViewport(page);
    await page.screenshot({ path: path.join(evidence, `purchase-cards-${width}.png`) });
    const first = page.getByRole("button", { name: /Ver líneas de compra de Proveedor de prueba/ });
    await first.click();
    await page.getByRole("dialog", { name: "Detalle de compra" }).waitFor();
    await page.getByRole("heading", { name: "1. Bambu Lab · Candy Red" }).waitFor();
    const total = new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 2 }).format(14000.94);
    assert.equal(await page.locator(".invoice-totals > div:last-child dd").innerText(), total, "keep fractional charges");
    assert.equal(await page.locator(".invoice-lines > article").count(), 1);
    assert.equal(await page.getByRole("heading", { name: /Latte Brown/ }).count(), 0, "only selected order lines");
    await checkViewport(page);
    await page.screenshot({ path: path.join(evidence, `purchase-detail-${width}.png`) });
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog", { name: "Mis compras" }).count(), 1);
    assert.match(await page.locator(":focus").getAttribute("aria-label"), /Proveedor de prueba/);
    await page.getByRole("button", { name: /Ver líneas de compra de Proveedor USD/ }).click();
    await page.getByRole("heading", { name: "Pago registrado" }).waitFor();
    assert.match(await page.locator(".invoice-payment-detail").innerText(), /1 USD = 500 CRC/);
    assert.match(await page.locator(".invoice-lines").innerText(), /Sin spool/);
    await page.getByRole("button", { name: "Cerrar ventana" }).focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(":focus").getAttribute("aria-label"), "Volver");
    await page.getByRole("button", { name: "Cerrar ventana" }).click();
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.deepEqual(errors, []);
    console.log(`PASS navigation, spool draft/save, purchase snapshots, focus and layout: ${width}px`);
  } finally { await context.close(); }
}

(async () => {
  await fs.mkdir(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_CHANNEL ? { channel: process.env.TEST_BROWSER_CHANNEL } : {}) });
  try { for (const width of [320, 390, 1280]) await run(browser, width); }
  finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
