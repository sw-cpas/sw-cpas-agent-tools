import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, parseArgs, mcpConfig, HELP } from '../bin/sw-cpas.mjs';

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url, init });
    const path = url.replace(/^https?:\/\/[^/]+\/wp-json\/swc\/v1/, '');
    const hit = routes[path.split('?')[0]] || routes[path];
    const status = hit ? hit.status || 200 : 404;
    const body = hit ? hit.body : { code: 'rest_no_route', message: 'No route', data: { status: 404, hint: 'See /openapi.json' } };
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: k => (hit && hit.headers && hit.headers[k.toLowerCase()]) || null },
      json: async () => body,
    };
  };
  impl.calls = calls;
  return impl;
}

async function capture(argv, routes, env = {}) {
  const outLines = [];
  const errLines = [];
  const f = fakeFetch(routes);
  const code = await run(argv, { fetchImpl: f, out: s => outLines.push(s), err: s => errLines.push(s), env });
  return { code, out: outLines.join('\n'), err: errLines.join('\n'), calls: f.calls };
}

const firm = { name: 'SW Accounting & Consulting Corp', description: 'CPA firm', address: { street: '1120 S Grand Ave #2710', city: 'Los Angeles', region: 'CA', postal_code: '90015' }, phone_display: '(323) 991-8581', email: 'swyoun@sw-cpas.com', languages: ['en', 'ko'], contact_page: 'https://sw-cpas.com/contact/' };

test('parseArgs handles flags with and without values', () => {
  assert.deepEqual(parseArgs(['services', '--category', 'tax', '--json']), { _: ['services'], flags: { category: 'tax', json: true } });
  assert.deepEqual(parseArgs(['ask', 'dental', 'cpa']), { _: ['ask', 'dental', 'cpa'], flags: {} });
});

test('help prints usage and exits 0', async () => {
  const r = await capture(['help'], {});
  assert.equal(r.code, 0);
  assert.equal(r.out, HELP);
});

test('firm prints phone and address from the API', async () => {
  const r = await capture(['firm'], { '/firm': { body: { data: firm } } });
  assert.equal(r.code, 0);
  assert.match(r.out, /\(323\) 991-8581/);
  assert.match(r.out, /1120 S Grand Ave #2710/);
  assert.equal(r.calls[0].url, 'https://sw-cpas.com/wp-json/swc/v1/firm');
});

test('--json prints raw data', async () => {
  const r = await capture(['firm', '--json'], { '/firm': { body: { data: firm } } });
  assert.deepEqual(JSON.parse(r.out), firm);
});

test('services passes filters as query parameters', async () => {
  const r = await capture(['services', '--category', 'valuation', '--q', '409A'], { '/services': { body: { data: [{ id: '409a-valuation', name: '409A Valuation Services', url: 'https://sw-cpas.com/409a-valuation/' }] } } });
  assert.equal(r.code, 0);
  assert.equal(r.calls[0].url, 'https://sw-cpas.com/wp-json/swc/v1/services?category=valuation&q=409A');
  assert.match(r.out, /409a-valuation/);
});

test('ask POSTs to /search with an Idempotency-Key', async () => {
  const r = await capture(['ask', 'dental', 'practice'], { '/search': { body: { data: { query: 'dental practice', results: [{ name: 'Dental CPA', url: 'https://sw-cpas.com/dental-cpa/' }] } } } });
  assert.equal(r.code, 0);
  const call = r.calls[0];
  assert.equal(call.init.method, 'POST');
  assert.match(call.init.headers['Idempotency-Key'], /^[0-9a-f-]{36}$/);
  assert.deepEqual(JSON.parse(call.init.body), { query: 'dental practice', limit: 8 });
  assert.match(r.out, /1\. Dental CPA/);
});

test('API errors show code, message, hint and Retry-After; exit 1', async () => {
  const r = await capture(['service', 'nope'], { '/services/nope': { status: 429, headers: { 'retry-after': '12' }, body: { code: 'swc_rate_limited', message: 'Too many requests', data: { status: 429, hint: 'Wait.' } } } });
  assert.equal(r.code, 1);
  assert.match(r.err, /swc_rate_limited: Too many requests\. Hint: Wait\. Retry after 12 seconds\./);
});

test('usage errors exit 2', async () => {
  assert.equal((await capture(['service'], {})).code, 2);
  assert.equal((await capture(['article', 'abc'], {})).code, 2);
  assert.equal((await capture(['ask'], {})).code, 2);
  assert.equal((await capture(['bogus'], {})).code, 2);
});

test('--base and SW_CPAS_BASE override the origin', async () => {
  const a = await capture(['firm', '--base', 'https://staging.example.com/'], { '/firm': { body: { data: firm } } });
  assert.equal(a.calls[0].url, 'https://staging.example.com/wp-json/swc/v1/firm');
  const b = await capture(['firm'], { '/firm': { body: { data: firm } } }, { SW_CPAS_BASE: 'https://env.example.com' });
  assert.equal(b.calls[0].url, 'https://env.example.com/wp-json/swc/v1/firm');
});

test('mcp prints both streamable HTTP servers', async () => {
  assert.deepEqual(mcpConfig(), { mcpServers: { 'sw-accounting': { type: 'http', url: 'https://sw-cpas.com/mcp' }, 'sw-accounting-docs': { type: 'http', url: 'https://sw-cpas.com/mcp/docs' } } });
  const r = await capture(['mcp'], {});
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.out).mcpServers['sw-accounting'].url, 'https://sw-cpas.com/mcp');
});
