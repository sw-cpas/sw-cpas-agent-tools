# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this repository is

Client-side tooling for the public, read-only agent interfaces of SW Accounting & Consulting Corp
(<https://sw-cpas.com>). The server side (REST API, MCP servers, `/ask`, markdown pages) lives on the firm's
WordPress site, not here.

## Layout

- `bin/sw-cpas.mjs`: the command-line tool. Single file, ES module, no dependencies, Node.js 18+.
- `test/cli.test.mjs`: tests with `node:test`; they stub `fetch`, so they never call the live site.
- `skills/sw-accounting/SKILL.md`: copy of the skill served at `/.well-known/agent-skills/sw-accounting/SKILL.md`.
- `plugin.json`, `mcp.json`: Agent Plugins manifest and MCP configuration (agent-plugins.org 1.0.0 schemas).
- `server.json`, `server.docs.json`: Official MCP Registry manifests for `com.sw-cpas/mcp` and `com.sw-cpas/docs-mcp`.

## Commands

```bash
npm test          # node --test test/
node bin/sw-cpas.mjs help
```

## Rules

1. Keep the CLI dependency-free and read-only. Do not add commands that write data or need credentials.
2. Do not hard-code firm facts (phone, address, services) in the CLI; fetch them from the API so the site stays the
   single source of truth.
3. Never add secrets, tokens or personal data to this repository.
4. When the API contract changes, check it against <https://sw-cpas.com/openapi.json> and update the tests.
5. Bump `version` in `package.json`, `plugin.json`, `server.json` and `server.docs.json` together.
