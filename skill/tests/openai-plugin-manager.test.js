"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const CURRENT_VERSION = require("../package.json").version;
const manager = require("../scripts/openai-plugin-manager");

function fixture(version = "11.6.13") {
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
function seedCanonical(f) {
  const result = manager.install({ ...f, yes: true });
  assert.equal(result.changed, true);
  return result;
}

test("status sin instalación", () => { const f = fixture(); try { assert.equal(manager.status(f).status, "not-installed"); } finally { cleanup(f); } });

test("CLI plugin status devuelve reporte canónico", () => { const f = fixture(); try { const cli = path.resolve(__dirname, "..", "bin", "jintia.js"); const result = spawnSync(process.execPath, [cli, "plugin", "status", "--json"], { env: { ...process.env, JINTIA_PLUGIN_HOME: f.homeDir }, encoding: "utf8" }); assert.equal(result.status, 0); const report = JSON.parse(result.stdout); assert.equal(report.tool, "jintia"); assert.equal(report.command, "plugin status"); assert.equal(report.status, "success"); assert.equal(report.exitCode, 0); assert.equal(report.data.operation, "status"); assert.equal(report.data.status, "not-installed"); assert.equal(report.data.current, false); } finally { cleanup(f); } });

test("CLI plugin install devuelve reporte canónico y layout real", () => { const f = fixture(); try { const cli = path.resolve(__dirname, "..", "bin", "jintia.js"); const env = { ...process.env, JINTIA_PLUGIN_HOME: f.homeDir }; const result = spawnSync(process.execPath, [cli, "plugin", "install", "--yes", "--json"], { env, encoding: "utf8" }); assert.equal(result.status, 0); const report = JSON.parse(result.stdout); assert.equal(report.tool, "jintia"); assert.equal(report.command, "plugin install"); assert.equal(report.status, "success"); assert.equal(report.exitCode, 0); assert.equal(report.data.operation, "install"); assert.equal(report.data.current, true); assert.equal(report.data.installed, true); assert.equal(report.data.marketplaceConfigured, true); assert.equal(report.data.changed, true); assert.equal(report.data.version, CURRENT_VERSION); const t = target(f); for (const relative of [".codex-plugin/plugin.json", ".mcp.json", "README.md", "skills/jintia-skill/SKILL.md", "skills/jintia-skill/package.json", "skills/jintia-skill/bin/jintia.js"]) assert.ok(fs.existsSync(path.join(t, relative))); for (const relative of ["openai-plugin", "skill", ".jintia-plugin.json"]) assert.equal(fs.existsSync(path.join(t, relative)), false); const catalog = JSON.parse(fs.readFileSync(marketplace(f))); assert.ok(catalog.plugins.some(plugin => plugin.name === "jintia")); } finally { cleanup(f); } });

test("CLI plugin status posterior confirma installed current", () => { const f = fixture(); try { const cli = path.resolve(__dirname, "..", "bin", "jintia.js"); const env = { ...process.env, JINTIA_PLUGIN_HOME: f.homeDir }; const install = spawnSync(process.execPath, [cli, "plugin", "install", "--yes", "--json"], { env, encoding: "utf8" }); assert.equal(install.status, 0); const result = spawnSync(process.execPath, [cli, "plugin", "status", "--json"], { env, encoding: "utf8" }); const report = JSON.parse(result.stdout); assert.equal(result.status, 0); assert.equal(report.status, "success"); assert.equal(report.data.operation, "status"); assert.equal(report.data.status, "installed"); assert.equal(report.data.current, true); assert.equal(report.data.marketplaceConfigured, true); assert.equal(report.data.installedVersion, CURRENT_VERSION); assert.equal(report.data.availableVersion, CURRENT_VERSION); } finally { cleanup(f); } });

test("status sin marketplace nunca declara current", () => { const f = fixture(); try { seedCanonical(f); fs.rmSync(marketplace(f)); const result = manager.status(f); assert.equal(result.current, false); assert.equal(result.status, "incomplete"); } finally { cleanup(f); } });

test("manifest JSON inválido se clasifica foreign", () => { const f = fixture(); try { write(path.join(target(f), ".codex-plugin/plugin.json"), "{"); assert.equal(manager.status(f).status, "foreign"); assert.throws(() => manager.install({ ...f, yes: true }), /no será sobrescrita/); } finally { cleanup(f); } });

test("manifest con nombre ajeno se clasifica foreign", () => { const f = fixture(); try { write(path.join(target(f), ".codex-plugin/plugin.json"), JSON.stringify({ name: "otro-plugin", version: "11.6.13" })); assert.equal(manager.status(f).status, "foreign"); assert.throws(() => manager.install({ ...f, yes: true }), /no será sobrescrita/); } finally { cleanup(f); } });

test("instalación incompleta Jintia se repara", () => { const f = fixture(); try { seedCanonical(f); fs.rmSync(path.join(target(f), ".mcp.json")); assert.equal(manager.status(f).status, "incomplete"); assert.equal(manager.install({ ...f, yes: true }).current, true); assert.equal(manager.status(f).status, "installed"); } finally { cleanup(f); } });

test("actualización 11.6.12 a 11.6.13 restaura target y marketplace", () => { const old = fixture("11.6.12"); const current = fixture("11.6.13"); try { seedCanonical(old); const oldReadme = fs.readFileSync(path.join(target(old), "README.md")); const oldMarketplace = fs.readFileSync(marketplace(old)); assert.throws(() => manager.install({ ...current, homeDir: old.homeDir, yes: true, writeMarketplace: () => { throw new Error("marketplace write failed"); } }), /marketplace write failed/); assert.deepEqual(fs.readFileSync(path.join(target(old), "README.md")), oldReadme); assert.deepEqual(fs.readFileSync(marketplace(old)), oldMarketplace); } finally { cleanup(old); cleanup(current); } });

test("rollback de instalación nueva elimina target y marketplace", () => { const f = fixture(); try { assert.throws(() => manager.install({ ...f, yes: true, writeMarketplace: () => { throw new Error("marketplace write failed"); } }), /marketplace write failed/); assert.equal(fs.existsSync(target(f)), false); assert.equal(fs.existsSync(marketplace(f)), false); assert.equal(fs.readdirSync(path.dirname(target(f))).some(n => n.includes(".stage-") || n.includes(".backup-")), false); } finally { cleanup(f); } });

test("staging inválido no activa el target", () => { const f = fixture(); const original = fs.copyFileSync; try { fs.copyFileSync = (source, destination, ...args) => { if (String(destination).includes(".stage-") && String(destination).endsWith(`${path.sep}.mcp.json`)) return; return original(source, destination, ...args); }; assert.throws(() => manager.install({ ...f, yes: true }), /staging/i); assert.equal(fs.existsSync(target(f)), false); } finally { fs.copyFileSync = original; cleanup(f); } });

test("fallo atómico limpia marketplace temporal", () => { const f = fixture(); const original = fs.renameSync; try { fs.renameSync = (source, destination) => { if (String(source).includes("marketplace.json.tmp-") && String(destination).endsWith("marketplace.json")) throw new Error("atomic rename failed"); return original(source, destination); }; assert.throws(() => manager.install({ ...f, yes: true }), /atomic rename failed/); assert.equal(fs.existsSync(target(f)), false); assert.equal(fs.readdirSync(path.dirname(marketplace(f))).some(n => n.includes("marketplace.json.tmp-")), false); } finally { fs.renameSync = original; cleanup(f); } });

test("fuente sin README falla antes de crear estado", () => { const f = fixture(); try { fs.rmSync(path.join(f.packageRoot, "openai-plugin", "README.md")); assert.throws(() => manager.install({ ...f, yes: true }), /Fuente del plugin incompleta|ENOENT/); assert.equal(fs.existsSync(target(f)), false); assert.equal(fs.existsSync(marketplace(f)), false); } finally { cleanup(f); } });

test("homeDir tiene prioridad y CODEX_HOME no duplica .codex", () => { const f = fixture(); const oldCodex = process.env.CODEX_HOME; const oldPluginHome = process.env.JINTIA_PLUGIN_HOME; try { delete process.env.JINTIA_PLUGIN_HOME; process.env.CODEX_HOME = path.join(f.homeDir, "sentinel"); assert.equal(manager.detection({ homeDir: f.homeDir }).target, path.join(f.homeDir, ".codex", "plugins", "jintia")); assert.equal(manager.detection().target.startsWith(path.join(f.homeDir, "sentinel", ".codex")), false); } finally { if (oldCodex === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = oldCodex; if (oldPluginHome === undefined) delete process.env.JINTIA_PLUGIN_HOME; else process.env.JINTIA_PLUGIN_HOME = oldPluginHome; cleanup(f); } });

test("instalación limpia crea marketplace y resultado actual", () => { const f = fixture(); try { const r = seedCanonical(f); assert.equal(r.current, true); assert.equal(manager.status(f).status, "installed"); assert.equal(JSON.parse(fs.readFileSync(marketplace(f))).plugins[0].name, "jintia"); } finally { cleanup(f); } });

test("instalación exitosa no deja stage ni backup", () => { const f = fixture(); try { seedCanonical(f); assert.equal(fs.readdirSync(path.dirname(target(f))).some(n => n.includes(".stage-") || n.includes(".backup-")), false); } finally { cleanup(f); } });

test("layout canónico exacto sin wrappers ni marcador sintético", () => { const f = fixture(); try { seedCanonical(f); const t = target(f); for (const file of [".codex-plugin/plugin.json", ".mcp.json", "README.md", "skills/jintia-skill/SKILL.md", "skills/jintia-skill/package.json", "skills/jintia-skill/bin/jintia.js"]) assert.ok(fs.existsSync(path.join(t, file))); for (const file of ["openai-plugin", "skill", ".jintia-plugin.json"]) assert.equal(fs.existsSync(path.join(t, file)), false); } finally { cleanup(f); } });

test("copia manifest MCP README y Skill al layout final", () => { const f = fixture(); try { seedCanonical(f); assert.deepEqual(fs.readFileSync(path.join(target(f), ".mcp.json")), fs.readFileSync(path.join(f.packageRoot, "openai-plugin", ".mcp.json"))); assert.deepEqual(fs.readFileSync(path.join(target(f), "README.md")), fs.readFileSync(path.join(f.packageRoot, "openai-plugin", "README.md"))); assert.deepEqual(fs.readFileSync(path.join(target(f), "skills/jintia-skill/content.txt")), fs.readFileSync(path.join(f.packageRoot, "skill/content.txt"))); } finally { cleanup(f); } });

test("preserva plugins ajenos e instalación segunda es no-op", () => { const f = fixture(); try { const m = marketplace(f); write(m, JSON.stringify({ plugins: [{ name: "other", source: { source: "local" } }] })); assert.equal(seedCanonical(f).changed, true); assert.equal(manager.install({ ...f, yes: true }).changed, false); assert.deepEqual(JSON.parse(fs.readFileSync(m)).plugins.map(p => p.name), ["other", "jintia"]); } finally { cleanup(f); } });

test("reconoce instalación canónica previa sin marcador sintético", () => { const f = fixture(); try { seedCanonical(f); fs.rmSync(path.join(target(f), ".jintia-plugin.json"), { force: true }); assert.equal(manager.status(f).status, "installed"); } finally { cleanup(f); } });

test("actualiza versión 11.6.12 a 11.6.13", () => { const old = fixture("11.6.12"); const newer = fixture("11.6.13"); try { seedCanonical(old); write(path.join(target(old), "skills/jintia-skill/config/institution.json"), "institution"); write(path.join(target(old), "skills/jintia-skill/config/notebooks.json"), "notebooks"); const r = manager.install({ ...newer, homeDir: old.homeDir, yes: true }); assert.equal(r.current, true); assert.equal(JSON.parse(fs.readFileSync(path.join(target(old), "skills/jintia-skill/package.json"))).version, "11.6.13"); assert.equal(fs.readFileSync(path.join(target(old), "skills/jintia-skill/config/institution.json"), "utf8"), "institution"); assert.equal(fs.readFileSync(path.join(target(old), "skills/jintia-skill/config/notebooks.json"), "utf8"), "notebooks"); } finally { cleanup(old); cleanup(newer); } });

test("institution.json se preserva byte a byte", () => { const old = fixture("11.6.12"); const newer = fixture("11.6.13"); try { seedCanonical(old); const bytes = Buffer.from("institution unique bytes"); write(path.join(target(old), "skills/jintia-skill/config/institution.json"), bytes); manager.install({ ...newer, homeDir: old.homeDir, yes: true }); assert.deepEqual(fs.readFileSync(path.join(target(old), "skills/jintia-skill/config/institution.json")), bytes); } finally { cleanup(old); cleanup(newer); } });

test("notebooks.json se preserva byte a byte", () => { const old = fixture("11.6.12"); const newer = fixture("11.6.13"); try { seedCanonical(old); const bytes = Buffer.from("notebooks unique bytes"); write(path.join(target(old), "skills/jintia-skill/config/notebooks.json"), bytes); manager.install({ ...newer, homeDir: old.homeDir, yes: true }); assert.deepEqual(fs.readFileSync(path.join(target(old), "skills/jintia-skill/config/notebooks.json")), bytes); } finally { cleanup(old); cleanup(newer); } });

test("destino foreign, manifest inválido o estructura incompleta se rechazan", () => { const f = fixture(); try { fs.mkdirSync(target(f), { recursive: true }); write(path.join(target(f), "foreign.txt"), "x"); assert.equal(manager.status(f).status, "foreign"); assert.throws(() => manager.install({ ...f, yes: true }), /no será sobrescrita/); } finally { cleanup(f); } });

test("marketplace inválido o plugins no-array se rechaza", () => { const f = fixture(); try { write(marketplace(f), "{"); assert.throws(() => manager.status(f), SyntaxError); fs.rmSync(marketplace(f)); write(marketplace(f), JSON.stringify({ plugins: {} })); assert.throws(() => manager.install({ ...f, yes: true }), /debe ser un array/); } finally { cleanup(f); } });

test("install exige --yes", () => { const f = fixture(); try { assert.throws(() => manager.install(f), /--yes/); } finally { cleanup(f); } });

test("CLI install sin yes devuelve reporte failed completo", () => { const f = fixture(); try { const cli = path.resolve(__dirname, "..", "bin", "jintia.js"); const result = spawnSync(process.execPath, [cli, "plugin", "install", "--json"], { env: { ...process.env, JINTIA_PLUGIN_HOME: f.homeDir }, encoding: "utf8" }); const report = JSON.parse(result.stdout); assert.notEqual(result.status, 0); assert.equal(report.tool, "jintia"); assert.equal(report.command, "plugin install"); assert.equal(report.status, "failed"); assert.notEqual(report.exitCode, 0); assert.ok(Array.isArray(report.errors)); assert.ok(report.errors.length > 0); } finally { cleanup(f); } });

test("bytes alterados con misma versión no son current y marketplace ausente impide current", () => { const f = fixture(); try { seedCanonical(f); fs.appendFileSync(path.join(target(f), "README.md"), "changed\n"); assert.equal(manager.status(f).status, "outdated"); fs.rmSync(marketplace(f)); const fresh = fixture(); try { seedCanonical(fresh); fs.rmSync(marketplace(fresh)); assert.equal(manager.status(fresh).status, "incomplete"); } finally { cleanup(fresh); } } finally { cleanup(f); } });

test("rollback restaura target y marketplace, sin staging residual", () => { const f = fixture(); try { seedCanonical(f); const beforeTarget = fs.readFileSync(path.join(target(f), "README.md")); const beforeMarketplace = fs.readFileSync(marketplace(f)); const next = fixture("11.6.13"); try { fs.appendFileSync(path.join(next.packageRoot, "openai-plugin", "README.md"), "new bytes\n"); assert.throws(() => manager.install({ ...next, homeDir: f.homeDir, yes: true, writeMarketplace: () => { throw new Error("marketplace write failed"); } }), /marketplace write failed/); assert.deepEqual(fs.readFileSync(path.join(target(f), "README.md")), beforeTarget); assert.deepEqual(fs.readFileSync(marketplace(f)), beforeMarketplace); assert.equal(fs.readdirSync(path.dirname(target(f))).some(n => n.includes(".stage-") || n.includes(".backup-")), false); } finally { cleanup(next); } } finally { cleanup(f); } });

test("CLI status install y falta de yes usan HOME temporal", () => { const f = fixture(); try { const cli = path.resolve(__dirname, "..", "bin", "jintia.js"); const env = { ...process.env, JINTIA_PLUGIN_HOME: f.homeDir }; const status = spawnSync(process.execPath, [cli, "plugin", "status", "--json"], { env, encoding: "utf8" }); assert.equal(status.status, 0); const statusReport = JSON.parse(status.stdout); assert.equal(statusReport.command, "plugin status"); assert.equal(statusReport.data.status, "not-installed"); const install = spawnSync(process.execPath, [cli, "plugin", "install", "--yes", "--json"], { env, encoding: "utf8" }); assert.equal(install.status, 0); const installReport = JSON.parse(install.stdout); assert.equal(installReport.command, "plugin install"); assert.equal(installReport.data.current, true); const noYes = spawnSync(process.execPath, [cli, "plugin", "install", "--json"], { env, encoding: "utf8" }); assert.notEqual(noYes.status, 0); } finally { cleanup(f); } });
