# SW Accounting agent tools

Official command-line tool, MCP configuration, agent skill and agent plugin for
[SW Accounting & Consulting Corp](https://sw-cpas.com), a bilingual (English/Korean) CPA firm in Los Angeles.

Everything here reads the firm's **public, read-only** interfaces. There is **no API key, sign-up or OAuth**.
Developer documentation: <https://sw-cpas.com/developers/>.

## Command-line tool

Node.js 18 or later. No dependencies. Published on npm as [`sw-cpas`](https://www.npmjs.com/package/sw-cpas).

```bash
npx sw-cpas help
npx sw-cpas services --category valuation
npx sw-cpas ask "Who can help a Korean company set up a U.S. subsidiary?"
npm install -g sw-cpas   # then run: sw-cpas firm
```

| Command | What it returns |
| --- | --- |
| `firm` | Address, phone, email, languages, leadership |
| `services [--category C] [--q TEXT]` | All services, optionally filtered |
| `service <id>` | One service, e.g. `dental-cpa` |
| `faqs [--q TEXT] [--lang en\|ko]` | Published questions and answers |
| `articles [--q TEXT] [--category SLUG]` | Insights articles |
| `article <id>` | One article as markdown |
| `contact` | How to start an engagement |
| `ask <question>` | Ranked pages, services and FAQs for a question |
| `mcp` | MCP client configuration |

Add `--json` for raw JSON. `--base URL` (or `SW_CPAS_BASE`) points the tool at another origin.

## MCP servers

Two Streamable HTTP servers, no sign-in, read-only tools:

```json
{
  "mcpServers": {
    "sw-accounting": { "type": "http", "url": "https://sw-cpas.com/mcp" },
    "sw-accounting-docs": { "type": "http", "url": "https://sw-cpas.com/mcp/docs" }
  }
}
```

Registry manifests: [`server.json`](server.json) (`com.sw-cpas/mcp`) and [`server.docs.json`](server.docs.json) (`com.sw-cpas/docs-mcp`).

## Agent skill and plugin

- [`skills/sw-accounting/SKILL.md`](skills/sw-accounting/SKILL.md): when and how an agent should use the firm's site. The same file is published at
  <https://sw-cpas.com/.well-known/agent-skills/sw-accounting/SKILL.md>.
- [`plugin.json`](plugin.json) and [`mcp.json`](mcp.json): an [Agent Plugin](https://agent-plugins.org/) that bundles the skill and both MCP servers.

## Public API

Base URL `https://sw-cpas.com/wp-json/swc/v1`, contract at <https://sw-cpas.com/openapi.json>.
60 requests per minute per IP; responses carry `RateLimit-*` headers and errors are JSON with a `hint`.
Sandbox for testing integrations: `https://sw-cpas.com/wp-json/swc/v1/sandbox` (same endpoints and data, `X-Environment: sandbox`).

## What these tools do not do

They cannot see client records, file returns or take payments. Never send Social Security numbers, bank details
or tax documents through them. To become a client: (323) 991-8581, swyoun@sw-cpas.com or <https://sw-cpas.com/contact/>.

## License

Code in this repository: MIT. The firm's site content and data remain subject to the
[Terms of Service](https://sw-cpas.com/terms-of-service/).
