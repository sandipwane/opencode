// Extracts short real code excerpts from the repo and injects them into
// index.html between the /*SNIP-START*/ and /*SNIP-END*/ markers.
// Run from the repo root: node artifacts/system-map/extract-snippets.mjs
import { readFileSync, writeFileSync } from "node:fs"

// id → { file, pattern, before, after } — excerpt starts `before` lines above
// the first pattern match and spans `before + after + 1` lines total.
const CONFIG = {
  tui: { file: "packages/opencode/src/cli/cmd/tui.ts", pattern: /function createWorkerFetch/, before: 0, after: 10 },
  app: { file: "packages/app/src/context/server-sdk.tsx", pattern: /message\.part\.updated/, before: 3, after: 8 },
  desktop: { file: "packages/desktop/src/main/sidecar.ts", pattern: /Server\.listen|cors/, before: 4, after: 7 },
  slack: { file: "packages/slack/src/index.ts", pattern: /createOpencode\(/, before: 1, after: 10 },
  ide: { file: "packages/opencode/src/ide/index.ts", pattern: /TERM_PROGRAM/, before: 2, after: 9 },
  sdk: { file: "packages/sdk/js/src/v2/client.ts", pattern: /x-opencode-directory/, before: 4, after: 7 },
  schema: { file: "packages/schema/src/event-manifest.ts", pattern: /./, before: 0, after: 11 },
  protocol: { file: "packages/protocol/src/groups/session.ts", pattern: /makeSessionGroup/, before: 0, after: 11 },
  clientgen: { file: "packages/client/package.json", pattern: /generate/, before: 3, after: 8 },
  server: { file: "packages/opencode/src/server/server.ts", pattern: /export function listen|function listen|listen\(/, before: 1, after: 10 },
  session: { file: "packages/opencode/src/session/prompt.ts", pattern: /const prompt: \(input: PromptInput\)/, before: 0, after: 11 },
  provider: { file: "packages/opencode/src/session/llm.ts", pattern: /export (const|async function|function) stream|stream\s*[=(]/, before: 1, after: 10 },
  auth: { file: "packages/opencode/src/auth/index.ts", pattern: /auth\.json/, before: 3, after: 8 },
  config: { file: "packages/opencode/src/config/config.ts", pattern: /OPENCODE_DISABLE_PROJECT_CONFIG|opencode\.jsonc?/, before: 2, after: 9 },
  bus: { file: "packages/core/src/event.ts", pattern: /publish/, before: 2, after: 9 },
  sqlite: { file: "packages/core/src/database/database.ts", pattern: /opencode\.db|journal_mode|WAL/i, before: 3, after: 8 },
  plugins: { file: "packages/opencode/src/plugin/index.ts", pattern: /createOpencodeClient/, before: 4, after: 7 },
  permission: { file: "packages/opencode/src/permission/index.ts", pattern: /export function evaluate/, before: 0, after: 11 },
  tools: { file: "packages/opencode/src/tool/registry.ts", pattern: /const plugin = yield\* Plugin\.Service/, before: 2, after: 9 },
  lsp: { file: "packages/opencode/src/lsp/lsp.ts", pattern: /spawning/, before: 2, after: 9 },
  mcp: { file: "packages/opencode/src/mcp/index.ts", pattern: /Effect\.fn\("MCP\.tools"\)/, before: 0, after: 11 },
  workspace: { file: "packages/opencode/src/session/revert.ts", pattern: /const snap = yield\* Snapshot\.Service/, before: 1, after: 10 },
  ext: { file: "packages/llm/src/protocols/anthropic-messages.ts", pattern: /DEFAULT_BASE_URL/, before: 0, after: 11 },
  modelsdev: { file: "packages/core/src/models-dev.ts", pattern: /ModelsDev\.fetchApi/, before: 0, after: 11 },
  docs: { file: "packages/web/astro.config.mjs", pattern: /defineConfig|cloudflare/i, before: 1, after: 10 },
  webapp: { file: "infra/app.ts", pattern: /"WebApp"/, before: 0, after: 9 },
  stats: { file: "infra/stats.ts", pattern: /new aws\.s3tables\.Table/, before: 5, after: 6 },
  lake: { file: "infra/lake.ts", pattern: /FirehoseDeliveryStream/, before: 1, after: 9 },
  console: { file: "infra/console.ts", pattern: /"AuthApi"/, before: 2, after: 8 },
  planetscale: { file: "infra/console.ts", pattern: /^const branch =/, before: 0, after: 11 },
  api: { file: "packages/function/src/api.ts", pattern: /share_sync/, before: 1, after: 9 },
  r2: { file: "packages/function/src/api.ts", pattern: /Bucket\.put/, before: 3, after: 7 },
  enterprise: { file: "packages/enterprise/src/core/share.ts", pattern: /share/i, before: 0, after: 11 },
}

const out = {}
for (const [id, c] of Object.entries(CONFIG)) {
  let text
  try { text = readFileSync(c.file, "utf8") } catch { console.error(`SKIP ${id}: cannot read ${c.file}`); continue }
  const lines = text.split("\n")
  const idx = lines.findIndex(l => c.pattern.test(l))
  if (idx < 0) { console.error(`SKIP ${id}: no match for ${c.pattern} in ${c.file}`); continue }
  const start = Math.max(0, idx - c.before)
  const slice = lines.slice(start, start + c.before + c.after + 1)
  while (slice.length && slice[slice.length - 1].trim() === "") slice.pop()
  // trim common indent
  const indents = slice.filter(l => l.trim()).map(l => l.match(/^\s*/)[0].length)
  const cut = indents.length ? Math.min(...indents) : 0
  out[id] = { file: c.file, start: start + 1, code: slice.map(l => l.slice(cut)).join("\n") }
}

const htmlPath = "artifacts/system-map/index.html"
const html = readFileSync(htmlPath, "utf8")
const json = JSON.stringify(out)
const next = html.replace(/\/\*SNIP-START\*\/[\s\S]*?\/\*SNIP-END\*\//, `/*SNIP-START*/${json}/*SNIP-END*/`)
writeFileSync(htmlPath, next)
console.log(`Injected ${Object.keys(out).length}/${Object.keys(CONFIG).length} snippets (${(json.length / 1024).toFixed(1)} KB)`)
for (const [id, s] of Object.entries(out)) console.log(`\n=== ${id} — ${s.file}:${s.start} ===\n${s.code.split("\n").slice(0, 4).join("\n")}`)
