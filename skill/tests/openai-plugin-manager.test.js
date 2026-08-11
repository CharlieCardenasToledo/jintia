"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const manager = require("../scripts/openai-plugin-manager");

function fixture() {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-plugin-home-"));
  const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-plugin-package-"));
  fs.mkdirSync(path.join(packageRoot, "skill", "bin"), { recursive: true });
  fs.mkdirSync(path.join(packageRoot, "openai-plugin", ".codex-plugin"), { recursive: true });
  fs.writeFileSync(path.join(packageRoot, "package.json"), JSON.stringify({ version: "11.6.12" }));
  fs.writeFileSync(path.join(packageRoot, "skill", "package.json"), JSON.stringify({ version: "11.6.12" }));
  fs.writeFileSync(path.join(packageRoot, "skill", "SKILL.md"), "---\nname: jintia-skill\n---\n");
  fs.writeFileSync(path.join(packageRoot, "skill", "bin", "jintia.js"), "#!/usr/bin/env node\n");
  fs.writeFileSync(path.join(packageRoot, "openai-plugin", ".codex-plugin", "plugin.json"), JSON.stringify({ name: "jintia", version: "11.6.12" }));
  fs.writeFileSync(path.join(packageRoot, "openai-plugin", ".mcp.json"), "{}\n");
  return { homeDir, packageRoot };
}

test("plugin status sin instalación", () => {
  const f = fixture();
  try { assert.equal(manager.status(f).status, "not-installed"); }
  finally { fs.rmSync(f.homeDir, { recursive: true, force: true }); fs.rmSync(f.packageRoot, { recursive: true, force: true }); }
});

test("plugin install es idempotente y conserva marketplace ajeno", () => {
  const f = fixture();
  try {
    const marketplace = path.join(f.homeDir, ".agents", "plugins", "marketplace.json");
    fs.mkdirSync(path.dirname(marketplace), { recursive: true });
    fs.writeFileSync(marketplace, JSON.stringify({ plugins: [{ name: "other", source: { source: "local" } }] }));
    const first = manager.install({ ...f, yes: true });
    const second = manager.install({ ...f, yes: true });
    assert.equal(first.changed, true);
    assert.equal(second.changed, false);
    assert.equal(manager.status(f).current, true);
    assert.equal(JSON.parse(fs.readFileSync(marketplace)).plugins.length, 2);
  } finally { fs.rmSync(f.homeDir, { recursive: true, force: true }); fs.rmSync(f.packageRoot, { recursive: true, force: true }); }
});

test("plugin install rechaza destino ajeno y exige yes", () => {
  const f = fixture();
  try {
    assert.throws(() => manager.install(f), /--yes/);
    const target = path.join(f.homeDir, ".codex", "plugins", "jintia");
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, "foreign.txt"), "foreign");
    assert.equal(manager.status(f).status, "foreign");
    assert.throws(() => manager.install({ ...f, yes: true }), /no será sobrescrita/);
  } finally { fs.rmSync(f.homeDir, { recursive: true, force: true }); fs.rmSync(f.packageRoot, { recursive: true, force: true }); }
});
