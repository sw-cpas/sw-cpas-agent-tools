#!/usr/bin/env node
// sw-cpas: command-line access to the public, read-only agent API of
// SW Accounting & Consulting Corp (https://sw-cpas.com). No API key needed.
// Zero dependencies; Node.js 18+ (uses the built-in fetch).

import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DEFAULT_BASE = 'https://sw-cpas.com';

export const HELP = `sw-cpas: public, read-only data from SW Accounting & Consulting Corp (bilingual English/Korean CPA firm, Los Angeles)

Usage: sw-cpas <command> [options]

Commands
  firm                         Firm profile: address, phone, email, languages, leadership
  services [--category C] [--q TEXT]
                               All services, optionally filtered
  service <id>                 One service, e.g. dental-cpa or 409a-valuation
  faqs [--q TEXT] [--lang en|ko] [--page N]
                               Published questions and answers
  articles [--q TEXT] [--category SLUG] [--lang en|ko] [--page N]
                               Insights articles (tax, accounting, M&A, ESG)
  article <id>                 One article with its full text as markdown
  contact                      How to start an engagement
  ask <question...>            Search services, FAQs, pages and articles
  mcp                          Print MCP client configuration for this firm's servers
  help                         Show this help

Options
  --json                       Print the raw JSON response
  --base URL                   API origin (default ${DEFAULT_BASE}, or SW_CPAS_BASE)

No authentication. Rate limit: 60 requests per minute per IP.
Docs: https://sw-cpas.com/developers/  OpenAPI: https://sw-cpas.com/openapi.json`;

export function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (key === 'json' || next === undefined || next.startsWith('--')) {
        out.flags[key] = true;
      } else {
        out.flags[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

export class ApiError extends Error {
  constructor(status, body) {
    const code = body && body.code ? body.code : `http_${status}`;
    const hint = body && body.data && body.data.hint ? ` Hint: ${body.data.hint}` : '';
    super(`${code}: ${(body && body.message) || `HTTP ${status}`}.${hint}`);
    this.status = status;
    this.body = body;
  }
}

async function call(fetchImpl, base, path, init = {}) {
  const res = await fetchImpl(`${base}/wp-json/swc/v1${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'User-Agent': 'sw-cpas-cli/1.0', ...(init.headers || {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = new ApiError(res.status, body);
    const retry = res.headers && res.headers.get ? res.headers.get('retry-after') : null;
    if (retry) err.message += ` Retry after ${retry} seconds.`;
    throw err;
  }
  return body;
}

function qs(params) {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== true && v !== '');
  return p.length ? '?' + new URLSearchParams(p).toString() : '';
}

const fmt = {
  firm: d => [
    d.name,
    d.description,
    `Address: ${d.address.street}, ${d.address.city}, ${d.address.region} ${d.address.postal_code}`,
    `Phone: ${d.phone_display}   Email: ${d.email}`,
    `Languages: ${(d.languages || []).join(', ')}`,
    `Contact form: ${d.contact_page}`,
  ].join('\n'),
  services: list => list.map(s => `${s.id.padEnd(30)} ${s.name}\n${' '.repeat(31)}${s.url}`).join('\n'),
  service: s => [`${s.name} (${s.id})`, s.summary, s.url, ...(s.includes || []).map(i => `  - ${i}`)].join('\n'),
  faqs: list => list.map(f => `Q: ${f.question}\nA: ${f.answer}\n   ${f.page_url}`).join('\n\n'),
  articles: list => list.map(a => `${String(a.id).padEnd(6)} ${a.title}\n       ${a.url}`).join('\n'),
  article: a => a.content_markdown,
  contact: c => [`Phone: ${c.phone_display}`, `Email: ${c.email}`, `Form: ${c.contact_form}`, ...(c.how_to_start || []).map(s => `- ${s}`), c.privacy_note].join('\n'),
  ask: d => (d.results || []).map((r, i) => `${i + 1}. ${r.name}\n   ${r.url}`).join('\n') || 'No matching pages.',
};

export function mcpConfig(base = DEFAULT_BASE) {
  return {
    mcpServers: {
      'sw-accounting': { type: 'http', url: `${base}/mcp` },
      'sw-accounting-docs': { type: 'http', url: `${base}/mcp/docs` },
    },
  };
}

/** Runs one command. Returns the exit code; writes to out / err. */
export async function run(argv, { fetchImpl = globalThis.fetch, out = s => process.stdout.write(s + '\n'), err = s => process.stderr.write(s + '\n'), env = process.env } = {}) {
  const { _: [cmd, ...rest], flags } = parseArgs(argv);
  const base = String(flags.base || env.SW_CPAS_BASE || DEFAULT_BASE).replace(/\/$/, '');
  const show = (data, f) => out(flags.json ? JSON.stringify(data, null, 2) : f(data));
  try {
    switch (cmd) {
      case undefined:
      case 'help':
      case '--help':
        out(HELP);
        return 0;
      case 'mcp':
        out(JSON.stringify(mcpConfig(base), null, 2));
        return 0;
      case 'firm':
        show((await call(fetchImpl, base, '/firm')).data, fmt.firm);
        return 0;
      case 'services':
        show((await call(fetchImpl, base, '/services' + qs({ category: flags.category, q: flags.q }))).data, fmt.services);
        return 0;
      case 'service':
        if (!rest[0]) { err('Usage: sw-cpas service <id>   (ids: sw-cpas services)'); return 2; }
        show((await call(fetchImpl, base, '/services/' + encodeURIComponent(rest[0]))).data, fmt.service);
        return 0;
      case 'faqs':
        show((await call(fetchImpl, base, '/faqs' + qs({ q: flags.q, lang: flags.lang, page: flags.page }))).data, fmt.faqs);
        return 0;
      case 'articles':
        show((await call(fetchImpl, base, '/articles' + qs({ q: flags.q, category: flags.category, lang: flags.lang, page: flags.page }))).data, fmt.articles);
        return 0;
      case 'article':
        if (!/^\d+$/.test(rest[0] || '')) { err('Usage: sw-cpas article <numeric id>   (ids: sw-cpas articles --q TEXT)'); return 2; }
        show((await call(fetchImpl, base, '/articles/' + rest[0])).data, fmt.article);
        return 0;
      case 'contact':
        show((await call(fetchImpl, base, '/contact')).data, fmt.contact);
        return 0;
      case 'ask': {
        const query = rest.join(' ').trim();
        if (!query) { err('Usage: sw-cpas ask <question>'); return 2; }
        const body = await call(fetchImpl, base, '/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
          body: JSON.stringify({ query, limit: 8 }),
        });
        show(body.data, fmt.ask);
        return 0;
      }
      default:
        err(`Unknown command "${cmd}".\n\n${HELP}`);
        return 2;
    }
  } catch (e) {
    err(e instanceof ApiError ? `Error ${e.message}` : `Error: ${e.message}`);
    return 1;
  }
}

// Run when executed directly (also through an npm/npx bin symlink), not when imported by tests.
function isEntry() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
if (isEntry()) {
  run(process.argv.slice(2)).then(code => process.exit(code));
}
