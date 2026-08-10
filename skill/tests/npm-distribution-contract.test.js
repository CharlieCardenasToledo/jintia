"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const PACKAGE = "@charlie.act7/gemini-notebook-mcp";
const VERSION = "2.3.5";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function validFixture() {
  return {
    rootPackage: { name: "@charlie.act7/jintia", files: ["skill/", "openai-plugin/", "release/release-config.json"] },
    releaseConfig: { $schemaVersion: "1.0.0", repository: "CharlieCardenasToledo/jintia", minimumDesktopVersion: "1.1.0", mcp: { package: PACKAGE, version: VERSION, node: ">=22.13.0", npmIntegrity: `sha512-${"A".repeat(86)}==` } },
    openaiMcp: { notebooklm: { command: "npx", args: ["-y", `${PACKAGE}@${VERSION}`] } },
  };
}

function validateDistributionContract({ rootPackage, releaseConfig, openaiMcp }) {
  assert.equal(rootPackage?.name, "@charlie.act7/jintia");
  assert.equal(rootPackage?.files?.filter(file => file === "release/release-config.json").length, 1);
  assert.doesNotMatch(JSON.stringify(rootPackage?.files), /"release(?:\/|\*|\*\*)"/);
  assert.equal(releaseConfig?.$schemaVersion, "1.0.0");
  assert.equal(releaseConfig?.repository, "CharlieCardenasToledo/jintia");
  assert.equal(releaseConfig?.minimumDesktopVersion, "1.1.0");
  assert.equal(releaseConfig?.mcp?.package, PACKAGE);
  assert.match(releaseConfig?.mcp?.version ?? "", /^\d+\.\d+\.\d+$/);
  assert.match(releaseConfig?.mcp?.npmIntegrity ?? "", /^sha512-[A-Za-z0-9+/]+={0,2}$/);
  assert.equal(openaiMcp?.notebooklm?.args?.at(-1), `${releaseConfig.mcp.package}@${releaseConfig.mcp.version}`);
}

test("el paquete npm declara el contrato técnico canónico de Jintia", () => {
  validateDistributionContract({ rootPackage: readJson("package.json"), releaseConfig: readJson("release/release-config.json"), openaiMcp: readJson("openai-plugin/.mcp.json") });
});

test("acepta un fixture de distribución válido aislado", () => validateDistributionContract(validFixture()));

test("rechaza un paquete npm que omite el contrato técnico", () => {
  const fixture = validFixture();
  fixture.rootPackage.files = ["skill/", "openai-plugin/"];
  assert.throws(() => validateDistributionContract(fixture));
});

for (const selector of ["release/", "release/*", "release/**"]) {
  test(`rechaza publicar ${selector} como sustituto del contrato explícito`, () => {
    const fixture = validFixture();
    fixture.rootPackage.files = [selector];
    assert.throws(() => validateDistributionContract(fixture));
  });
}

test("rechaza un repository incorrecto", () => {
  const fixture = validFixture();
  fixture.releaseConfig.repository = "otro/repo";
  assert.throws(() => validateDistributionContract(fixture));
});

test("rechaza integrity inválido", () => {
  const fixture = validFixture();
  fixture.releaseConfig.mcp.npmIntegrity = "sha1-deadbeef";
  assert.throws(() => validateDistributionContract(fixture));
});

test("rechaza divergencia MCP", () => {
  const fixture = validFixture();
  fixture.openaiMcp.notebooklm.args[1] = `${PACKAGE}@2.3.4`;
  assert.throws(() => validateDistributionContract(fixture));
});
