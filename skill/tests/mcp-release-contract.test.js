"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

test("el contrato MCP de OpenAI sigue release-config y fija la publicación aprobada", () => {
  const release = readJson("release/release-config.json");
  const openaiMcp = readJson("openai-plugin/.mcp.json");
  const plugin = readJson("openai-plugin/.codex-plugin/plugin.json");
  const mcp = release.mcp;
  const expected = `${mcp.package}@${mcp.version}`;
  const spec = openaiMcp.notebooklm?.args?.at(-1);

  assert.equal(mcp.package, "@charlie.act7/gemini-notebook-mcp");
  assert.equal(mcp.version, "2.3.5");
  assert.match(mcp.npmIntegrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/);
  assert.equal(spec, expected);
  assert.equal(plugin.mcpServers, "./.mcp.json");
  assert.doesNotMatch(spec, /@latest|\^|~|\*|\.tgz|https?:|releases\/download/);
});
