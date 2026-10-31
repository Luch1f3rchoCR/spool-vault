// Pure language/presentation tests. No account, network or persistence.
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {appLanguages, resolveLanguage, messages, translate, formatNumber, formatMoney, currencyLabel, formatExchangeRate, formatDate} = require('../lib/i18n.ts');
const normalize = value => value.replace(/\s+/g, ' ');
const parameters = value => Array.from(value.matchAll(/\{(\w+)\}/g), match => match[1]).sort();

test('explicit Spanish/English preferences resolve without choosing a currency', () => {
  assert.deepEqual(appLanguages, ['es', 'en']);
  assert.equal(resolveLanguage('en'), 'en');
  assert.equal(resolveLanguage('es'), 'es');
  for (const value of [null, undefined, 'fr', 'CRC', {}, 0]) assert.equal(resolveLanguage(value), 'es');
});

test('both catalogs contain all keys and matching interpolation parameters', () => {
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages.es).sort());
  for (const key of Object.keys(messages.es)) {
    assert.ok(messages.en[key].trim(), `English text is missing: ${key}`);
    assert.deepEqual(parameters(messages.en[key]), parameters(messages.es[key]), key);
    for (const language of appLanguages) {
      const values = Object.fromEntries(parameters(messages[language][key]).map(name => [name, 'TEST']));
      assert.doesNotMatch(translate(language, key, values), /\{\w+\}/, key);
    }
  }
});

test('English includes guidance and the cost example, with no silent Spanish fallback', () => {
  assert.equal(translate('en', 'machineRate'), 'Hourly machine cost');
  assert.match(translate('en', 'powerHelp'), /Average electrical power/);
  assert.match(translate('en', 'guideMethod'), /expected hours of use/);
  assert.match(translate('en', 'guideExample', {equipment:'CRC 300,000.00', hours:'3,000', hourly:'CRC 100.00'}), /not applied automatically/);
  assert.throws(() => translate('en', 'missingKey'), /Missing translation/);
  assert.throws(() => translate('en', 'rateHelp'), /Missing translation parameter/);
});

test('interpolated user data stays literal, not recursively translated or evaluated', () => {
  const value = '<b>Mi perfil {amount}</b>';
  assert.equal(translate('en', 'hourlyAmount', {amount:value}), `${value} / h`);
});

test('formatting keeps currency explicit in both languages and never converts amounts', () => {
  for (const language of appLanguages) {
    for (const currency of ['CRC', 'USD', 'EUR']) {
      const text = formatMoney(135, currency, language);
      assert.ok(text.includes(currency));
      assert.doesNotMatch(text, /₡|\$|€/);
      assert.ok(text.includes('135'));
    }
  }
  assert.equal(normalize(formatMoney(1234.5, 'CRC', 'en')), 'CRC 1,234.50');
  assert.equal(normalize(formatMoney(1234.5, 'CRC', 'es')), 'CRC 1 234,50');
  assert.equal(normalize(formatMoney(0, 'USD', 'en')), 'USD 0.00');
  assert.equal(formatNumber(3000, 'en'), '3,000');
});

test('currency names explain CRC to English speakers without changing stored codes', () => {
  assert.equal(currencyLabel('CRC', 'en'), 'CRC — Costa Rican colón');
  assert.equal(currencyLabel('USD', 'en'), 'USD — US dollar');
  assert.equal(currencyLabel('EUR', 'es'), 'EUR — Euro');
  assert.equal(currencyLabel('MXN', 'en'), 'MXN');
});

test('exchange-rate text identifies its direction and does not turn a small positive rate into zero', () => {
  assert.equal(formatExchangeRate(465, 'USD', 'CRC', 'en'), '1 USD = 465 CRC');
  assert.equal(formatExchangeRate(465.5, 'USD', 'CRC', 'es'), '1 USD = 465,5 CRC');
  assert.equal(formatExchangeRate(0.0000000001, 'USD', 'CRC', 'en'), '1 USD = 0.0000000001 CRC');
  assert.throws(() => formatExchangeRate(0, 'USD', 'CRC', 'en'), /positive finite/);
  assert.throws(() => formatExchangeRate(Infinity, 'USD', 'CRC', 'en'), /positive finite/);
});

test('missing/invalid monetary data is rejected rather than presented as zero', () => {
  for (const value of [null, undefined, NaN, Infinity]) assert.throws(() => formatMoney(value, 'USD', 'en'), /finite number/);
  for (const currency of ['', '₡', 'usd', 'USD<script>']) assert.throws(() => formatMoney(10, currency, 'en'), /ISO currency/);
});


test('workspace labels, empty states and singular/plural copy exist in both languages', () => {
  assert.equal(translate('en', 'nav.inventory'), 'Inventory');
  assert.equal(translate('en', 'nav.primary'), 'Main navigation');
  assert.equal(translate('en', 'dashboard.helloName', {name:'Lucho'}), 'Hello, Lucho');
  assert.equal(translate('es', 'dashboard.rollOne'), 'rollo activo');
  assert.equal(translate('en', 'dashboard.rollMany'), 'active rolls');
  assert.equal(translate('en', 'production.unitOne', {quantity:1}), '1 unit');
  assert.equal(translate('en', 'production.unitMany', {quantity:2}), '2 units');
  assert.match(translate('en', 'production.help'), /does not send a job/);
  assert.match(translate('en', 'dashboard.empty'), /Your activity/);
});

test('calendar dates keep their day even for a viewer west of UTC', () => {
  for (const language of appLanguages) {
    const value = formatDate('2026-10-30', language, {day:'numeric',month:'long',timeZone:'America/Costa_Rica'});
    assert.match(value, /30/);
    assert.doesNotMatch(value, /29/);
  }
});

test('timestamps keep viewer time zone semantics independently of language', () => {
  const instant = '2026-10-30T02:00:00Z';
  assert.match(formatDate(instant, 'en', {day:'numeric',month:'short',timeZone:'America/Costa_Rica'}), /29/);
  assert.match(formatDate(instant, 'en', {day:'numeric',month:'short',timeZone:'UTC'}), /30/);
});

test('invalid historical dates remain missing rather than silently becoming another date', () => {
  for (const value of ['', 'bad date', '2026-02-30', '2026-13-01', '2026-02-30T10:00:00Z']) {
    assert.equal(formatDate(value, 'en'), null);
  }
  assert.ok(formatDate('2024-02-29', 'es'));
});
