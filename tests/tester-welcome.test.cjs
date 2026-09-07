const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { transform, loadBindings } = require('next/dist/build/swc');
const helpers = import(pathToFileURL(path.resolve('lib/tester-welcome.ts')).href);

test('welcome escapes recipient text and describes the account-bound license', async () => {
  const { welcomePayload } = await helpers;
  const mail = welcomePayload('<img src=x onerror=alert(1)>', 'person@example.invalid', 'Spool Vault <hola@example.invalid>');
  assert.ok(!mail.html.includes('<img'));
  assert.ok(mail.html.includes('&lt;img'));
  assert.deepEqual(mail.to, ['person@example.invalid']);
  assert.match(mail.text, /gratis de por vida/);
  assert.match(mail.text, /https:\/\/spool-vault.vercel.app\//);
});

test('old or invalid uncertain deliveries cannot be resent after deduplication expires', async () => {
  const { canRetryWelcome } = await helpers;
  const now = Date.now();
  assert.equal(canRetryWelcome(new Date(now - 22 * 3600000).toISOString(), now), true);
  assert.equal(canRetryWelcome(new Date(now - 23 * 3600000).toISOString(), now), false);
  assert.equal(canRetryWelcome('invalid', now), false);
});

test('provider requests reuse the invitation idempotency key and reject false success', async () => {
  const { sendWelcomeEmail } = await helpers;
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json(calls.length <= 2 ? { id: 'provider-123' } : { error: 'failure' }, { status: calls.length <= 2 ? 200 : 500 });
  };
  try {
    const payload = { to: ['person@example.invalid'], text: 'Welcome' };
    assert.equal(await sendWelcomeEmail('member-1', payload, 'fake-test-key'), 'provider-123');
    await sendWelcomeEmail('member-1', payload, 'fake-test-key');
    assert.equal(calls[0].options.headers['Idempotency-Key'], calls[1].options.headers['Idempotency-Key']);
    assert.equal(calls[0].options.body, calls[1].options.body);
    await assert.rejects(sendWelcomeEmail('member-2', payload, 'fake-test-key'));
  } finally { global.fetch = originalFetch; }
});

async function routeFixture({ authenticated = true, admin = true, deliveryStatus = 'sending', expired = false, providerFails = false } = {}) {
  await loadBindings();
  const helper = await helpers;
  let sends = 0;
  let serviceCreated = 0;
  const frozen = { from: 'Spool Vault <hola@example.invalid>', to: ['saved@example.invalid'], text: 'Frozen welcome' };
  const mockClient = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'admin', email_confirmed_at: '2026-01-01', is_anonymous: false } : null }, error: null }) },
    from(table) {
      let updating = false;
      const chain = {
        select: () => chain, eq: () => chain, neq: () => chain,
        update: () => { updating = true; return chain; },
        maybeSingle: async () => ({ data: table === 'app_admins' ? (admin ? { user_id: 'admin' } : null) : { id: 'a0000000-0000-4000-8000-000000000001', email: 'saved@example.invalid', display_name: 'Saved name', cancelled_at: null }, error: null }),
        single: async () => ({ data: updating ? { membership_id: 'member' } : null, error: null }),
        then: (resolve) => Promise.resolve({ error: null }).then(resolve)
      };
      return chain;
    },
    rpc: async () => ({ data: { status: deliveryStatus, first_attempt_at: new Date(Date.now() - (expired ? 25 : 1) * 3600000).toISOString(), payload: frozen }, error: null })
  };
  const { code: source } = await transform(fs.readFileSync('app/api/admin/tester-welcome/route.ts', 'utf8'), { filename: 'route.ts', jsc: { parser: { syntax: 'typescript' }, target: 'es2022' }, module: { type: 'commonjs' } });
  const exports = {};
  const context = {
    exports, Response, Request, AbortSignal, Date,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-test', SUPABASE_SECRET_KEY: 'secret-test', RESEND_API_KEY: 'provider-test', WELCOME_EMAIL_FROM: 'test@example.invalid' } },
    require: (name) => {
      if (name === '@supabase/supabase-js') return { createClient: (_, key) => { if (key === 'secret-test') serviceCreated++; return mockClient; } };
      if (name === '@/lib/tester-welcome') return { ...helper, sendWelcomeEmail: async (_, payload) => { sends++; assert.deepEqual(payload, frozen); if (providerFails) throw new Error('timeout'); return 'provider-id'; } };
      throw new Error(`Unexpected import ${name}`);
    }
  };
  vm.runInNewContext(source, context);
  return { route: exports, sends: () => sends, services: () => serviceCreated };
}

function request(token = 'test') {
  return new Request('https://spool-vault.vercel.app/api/admin/tester-welcome', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify({ membership_id: 'a0000000-0000-4000-8000-000000000001', email: 'attacker@example.invalid' }) });
}

test('mail endpoint rejects missing/invalid sessions and non-admins before service access', async () => {
  for (const config of [{ token: '', expected: 401 }, { authenticated: false, expected: 401 }, { admin: false, expected: 403 }]) {
    const fixture = await routeFixture(config);
    assert.equal((await fixture.route.POST(request(config.token))).status, config.expected);
    assert.equal(fixture.services(), 0);
    assert.equal(fixture.sends(), 0);
  }
});

test('mail endpoint uses frozen recipient and payload, and does not resend confirmed or expired attempts', async () => {
  const fresh = await routeFixture();
  assert.equal((await fresh.route.POST(request())).status, 200);
  assert.equal(fresh.sends(), 1);
  const confirmed = await routeFixture({ deliveryStatus: 'accepted' });
  assert.equal((await confirmed.route.POST(request())).status, 200);
  assert.equal(confirmed.sends(), 0);
  const expired = await routeFixture({ expired: true });
  assert.equal((await expired.route.POST(request())).status, 409);
  assert.equal(expired.sends(), 0);
  const failure = await routeFixture({ providerFails: true });
  assert.equal((await failure.route.POST(request())).status, 502);
});
