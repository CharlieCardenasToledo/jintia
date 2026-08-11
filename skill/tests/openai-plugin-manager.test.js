"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const manager = require("../scripts/openai-plugin-manager");

function fixture(version = "11.6.12") {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-plugin-home-"));
  const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-plugin-package-"));
  fs.mkdirSync(path.join(packageRoot, "skill", "bin"), { recursive: true });
  fs.mkdirSync(path.join(packageRoot, "skill", "config"), { recursive: true });
  fs.mkdirSync(path.join(packageRoot, "openai-plugin", ".codex-plugin"), { recursive: true });
  fs.writeFileSync(path.join(packageRoot, "package.json"), JSON.stringify({ version }));
  fs.writeFileSync(path.join(packageRoot, "skill", "package.json"), JSON.stringify({ name: "jintia-skill", version }));
  fs.writeFileSync(path.join(packageRoot, "skill", "SKILL.md"), "---\nname: jintia-skill\n---\nSkill\n");
  fs.writeFileSync(path.join(packageRoot, "skill", "bin", "jintia.js"), "#!/usr/bin/env node\n");
  fs.writeFileSync(path.join(packageRoot, "skill", "content.txt"), "managed bytes\n");
  fs.writeFileSync(path.join(packageRoot, "openai-plugin", ".codex-plugin", "plugin.json"), JSON.stringify({ name: "jintia", version }));
  fs.writeFileSync(path.join(packageRoot, "openai-plugin", ".mcp.json"), "{\"mcpServers\":{}}\n");
  fs.writeFileSync(path.join(packageRoot, "openai-plugin", "README.md"), "# Jintia\n");
  return { homeDir, packageRoot };
}

function cleanup(f) { fs.rmSync(f.homeDir, { recursive: true, force: true }); fs.rmSync(f.packageRoot, { recursive: true, force: true }); }
function target(f) { return manager.detection(f).target; }
function marketplace(f) { return manager.detection(f).marketplace; }
function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); }
function seedCanonical(f, version = "11.6.12") {
  const result = manager.install({ ...f, yes: true });
  assert.equal(result.changed, true);
  return result;
}

test("status sin instalación", () => { const f = fixture(); try { assert.equal(manager.status(f).status, "not-installed"); } finally { cleanup(f); } });

test("instalación limpia crea marketplace y resultado actual", () => { const f = fixture(); try { const r = seedCanonical(f); assert.equal(r.current, true); assert.equal(manager.status(f).status, "installed"); assert.equal(JSON.parse(fs.readFileSync(marketplace(f))).plugins[0].name, "jintia"); } finally { cleanup(f); } });

test("layout canónico exacto sin wrappers ni marcador sintético", () => { const f = fixture(); try { seedCanonical(f); const t = target(f); for (const file of [".codex-plugin/plugin.json", ".mcp.json", "README.md", "skills/jintia-skill/SKILL.md", "skills/jintia-skill/package.json", "skills/jintia-skill/bin/jintia.js"]) assert.ok(fs.existsSync(path.join(t, file))); for (const file of ["openai-plugin", "skill", ".jintia-plugin.json"]) assert.equal(fs.existsSync(path.join(t, file)), false); } finally { cleanup(f); } });

test("copia manifest MCP README y Skill al layout final", () => { const f = fixture(); try { seedCanonical(f); assert.deepEqual(fs.readFileSync(path.join(target(f), ".mcp.json")), fs.readFileSync(path.join(f.packageRoot, "openai-plugin", ".mcp.json"))); assert.deepEqual(fs.readFileSync(path.join(target(f), "README.md")), fs.readFileSync(path.join(f.packageRoot, "openai-plugin", "README.md"))); assert.deepEqual(fs.readFileSync(path.join(target(f), "skills/jintia-skill/content.txt")), fs.readFileSync(path.join(f.packageRoot, "skill/content.txt"))); } finally { cleanup(f); } });

test("preserva plugins ajenos e instalación segunda es no-op", () => { const f = fixture(); try { const m = marketplace(f); write(m, JSON.stringify({ plugins: [{ name: "other", source: { source: "local" } }] })); assert.equal(seedCanonical(f).changed, true); assert.equal(manager.install({ ...f, yes: true }).changed, false); assert.deepEqual(JSON.parse(fs.readFileSync(m)).plugins.map(p => p.name), ["other", "jintia"]); } finally { cleanup(f); } });

test("reconoce instalación canónica previa sin marcador sintético", () => { const f = fixture(); try { seedCanonical(f); fs.rmSync(path.join(target(f), ".jintia-plugin.json"), { force: true }); assert.equal(manager.status(f).status, "installed"); } finally { cleanup(f); } });

test("actualiza versión anterior y conserva configuración", () => { const old = fixture("11.6.11"); const newer = fixture("11.6.12"); try { seedCanonical(old); write(path.join(target(old), "skills/jintia-skill/config/institution.json"), "institution"); write(path.join(target(old), "skills/jintia-skill/config/notebooks.json"), "notebooks"); const r = manager.install({ ...newer, homeDir: old.homeDir, yes: true }); assert.equal(r.current, true); assert.equal(JSON.parse(fs.readFileSync(path.join(target(old), "skills/jintia-skill/package.json"))).version, "11.6.12"); assert.equal(fs.readFileSync(path.join(target(old), "skills/jintia-skill/config/institution.json"), "utf8"), "institution"); assert.equal(fs.readFileSync(path.join(target(old), "skills/jintia-skill/config/notebooks.json"), "utf8"), "notebooks"); } finally { cleanup(old); cleanup(newer); } });

test("destino foreign, manifest inválido o estructura incompleta se rechazan", () => { const f = fixture(); try { fs.mkdirSync(target(f), { recursive: true }); write(path.join(target(f), "foreign.txt"), "x"); assert.equal(manager.status(f).status, "foreign"); assert.throws(() => manager.install({ ...f, yes: true }), /no será sobrescrita/); } finally { cleanup(f); } });

test("marketplace inválido o plugins no-array se rechaza", () => { const f = fixture(); try { write(marketplace(f), "{"); assert.throws(() => manager.status(f), SyntaxError); fs.rmSync(marketplace(f)); write(marketplace(f), JSON.stringify({ plugins: {} })); assert.throws(() => manager.install({ ...f, yes: true }), /debe ser un array/); } finally { cleanup(f); } });

test("install exige --yes", () => { const f = fixture(); try { assert.throws(() => manager.install(f), /--yes/); } finally { cleanup(f); } });

test("bytes alterados con misma versión no son current y marketplace ausente impide current", () => { const f = fixture(); try { seedCanonical(f); fs.appendFileSync(path.join(target(f), "README.md"), "changed\n"); assert.equal(manager.status(f).status, "outdated"); fs.rmSync(marketplace(f)); const fresh = fixture(); try { seedCanonical(fresh); fs.rmSync(marketplace(fresh)); assert.equal(manager.status(fresh).status, "incomplete"); } finally { cleanup(fresh); } } finally { cleanup(f); } });

test("rollback restaura target y marketplace, sin staging residual", () => { const f = fixture(); try { seedCanonical(f); const beforeTarget = fs.readFileSync(path.join(target(f), "README.md")); const beforeMarketplace = fs.readFileSync(marketplace(f)); const next = fixture("11.6.13"); try { assert.throws(() => manager.install({ ...next, homeDir: f.homeDir, yes: true, writeMarketplace: () => { throw new Error("marketplace write failed"); } }), /marketplace write failed/); assert.deepEqual(fs.readFileSync(path.join(target(f), "README.md")), beforeTarget); assert.deepEqual(fs.readFileSync(marketplace(f)), beforeMarketplace); assert.equal(fs.readdirSync(path.dirname(target(f))).some(n => n.includes(".stage-") || n.includes(".backup-")), false); } finally { cleanup(next); } } finally { cleanup(f); } });

test("CLI status install y falta de yes usan HOME temporal", () => { const f = fixture(); try { const cli = path.resolve(__dirname, "..", "bin", "jintia.js"); const env = { ...process.env, JINTIA_PLUGIN_HOME: f.homeDir }; const status = spawnSync(process.execPath, [cli, "plugin", "status", "--json"], { env, encoding: "utf8" }); assert.equal(status.status, 0); const statusReport = JSON.parse(status.stdout); assert.equal(statusReport.command, "plugin status"); assert.equal(statusReport.data.status, "not-installed"); const install = spawnSync(process.execPath, [cli, "plugin", "install", "--yes", "--json"], { env, encoding: "utf8" }); assert.equal(install.status, 0); const installReport = JSON.parse(install.stdout); assert.equal(installReport.command, "plugin install"); assert.equal(installReport.data.current, true); const noYes = spawnSync(process.execPath, [cli, "plugin", "install", "--json"], { env, encoding: "utf8" }); assert.notEqual(noYes.status, 0); } finally { cleanup(f); } });
