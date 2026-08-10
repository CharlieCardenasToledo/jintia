"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

const PACKAGE = "@charlie.act7/gemini-notebook-mcp";
const VERSION = "2.3.9";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function validFixture() {
  return {
    release: { mcp: { package: PACKAGE, version: VERSION, node: ">=22.13.0", npmIntegrity: `sha512-${"A".repeat(86)}==` } },
    openaiMcp: { notebooklm: { command: "npx", args: ["-y", `${PACKAGE}@${VERSION}`] } },
    plugin: { mcpServers: "./.mcp.json" },
  };
}

function validateContract({ release, openaiMcp, plugin }) {
  const mcp = release?.mcp;
  const spec = openaiMcp?.notebooklm?.args?.at(-1);
  assert.equal(mcp?.package, PACKAGE);
  assert.equal(mcp?.version, VERSION);
  assert.match(mcp?.npmIntegrity ?? "", /^sha512-[A-Za-z0-9+/]+={0,2}$/);
  assert.equal(spec, `${PACKAGE}@${VERSION}`);
  assert.equal(plugin?.mcpServers, "./.mcp.json");
  assert.doesNotMatch(spec, /@latest|\^|~|\*|\.tgz|https?:|releases\/download/);
}

test("el contrato MCP real de OpenAI sigue release-config y fija la publicación aprobada", () => {
  validateContract({ release: readJson("release/release-config.json"), openaiMcp: readJson("openai-plugin/.mcp.json"), plugin: readJson("openai-plugin/.codex-plugin/plugin.json") });
});

test("acepta un fixture MCP válido aislado", () => validateContract(validFixture()));

test("rechaza una versión MCP antigua aunque ambos archivos coincidan", () => {
  const fixture = validFixture();
  fixture.release.mcp.version = "2.3.4";
  fixture.openaiMcp.notebooklm.args[1] = `${PACKAGE}@2.3.4`;
  assert.throws(() => validateContract(fixture));
});

test("rechaza divergencia entre release-config y .mcp.json", () => {
  const fixture = validFixture();
  fixture.openaiMcp.notebooklm.args[1] = `${PACKAGE}@2.3.4`;
  assert.throws(() => validateContract(fixture));
});

for (const invalidSpec of [
  `${PACKAGE}@latest`,
  `${PACKAGE}@^2.3.9`,
  `${PACKAGE}@~2.3.9`,
]) {
  test(`rechaza spec flotante ${invalidSpec}`, () => {
    const fixture = validFixture();
    fixture.openaiMcp.notebooklm.args[1] = invalidSpec;
    assert.throws(() => validateContract(fixture));
  });
}

test("rechaza integrity que no sea SRI sha512", () => {
  const fixture = validFixture();
  fixture.release.mcp.npmIntegrity = "sha1-deadbeef";
  assert.throws(() => validateContract(fixture));
});

test("rechaza un manifest OpenAI que deja de apuntar a ./.mcp.json", () => {
  const fixture = validFixture();
  fixture.plugin.mcpServers = "./otro-mcp.json";
  assert.throws(() => validateContract(fixture));
});
