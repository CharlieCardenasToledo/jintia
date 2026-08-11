"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");
const PLUGIN_NAME = "jintia";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function packageHome() {
  return process.env.JINTIA_PLUGIN_HOME || process.env.CODEX_HOME || process.env.USERPROFILE || os.homedir();
}

function paths(options = {}) {
  const home = options.homeDir || packageHome();
  return {
    home,
    target: path.join(home, ".codex", "plugins", PLUGIN_NAME),
    marketplace: path.join(home, ".agents", "plugins", "marketplace.json"),
  };
}

function sources(packageRoot = PACKAGE_ROOT) {
  const skill = path.join(packageRoot, "skill");
  const plugin = path.join(packageRoot, "openai-plugin");
  const rootPackage = readJson(path.join(packageRoot, "package.json"));
  const skillPackage = readJson(path.join(skill, "package.json"));
  const pluginManifest = readJson(path.join(plugin, ".codex-plugin", "plugin.json"));
  const version = rootPackage.version;
  if (!version || skillPackage.version !== version || pluginManifest.version !== version || pluginManifest.name !== PLUGIN_NAME) {
    throw new Error("Los manifiestos Jintia no comparten la misma versión.");
  }
  if (!/^name:\s*jintia-skill\s*$/m.test(fs.readFileSync(path.join(skill, "SKILL.md"), "utf8"))) {
    throw new Error("SKILL.md no identifica una Jintia Skill.");
  }
  for (const required of [
    path.join(skill, "SKILL.md"),
    path.join(skill, "bin", "jintia.js"),
    path.join(plugin, ".codex-plugin", "plugin.json"),
    path.join(plugin, ".mcp.json"),
  ]) {
    if (!fs.statSync(required).isFile()) throw new Error(`Fuente del plugin incompleta: ${required}`);
  }
  return { packageRoot, skill, plugin, version };
}

function manifest(target) {
  const file = path.join(target, ".jintia-plugin.json");
  if (!fs.existsSync(file)) return null;
  try {
    const value = readJson(file);
    return value && value.name === PLUGIN_NAME ? value : { foreign: true };
  } catch { return { foreign: true }; }
}

function marketplaceState(file) {
  if (!fs.existsSync(file)) return { value: { plugins: [] }, exists: false };
  const value = readJson(file);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("El marketplace no contiene un objeto JSON válido.");
  if (value.plugins !== undefined && !Array.isArray(value.plugins)) throw new Error("El campo plugins del marketplace debe ser un array.");
  return { value, exists: true };
}

function canonicalEntry() {
  return {
    name: PLUGIN_NAME,
    source: { source: "local", path: "./.codex/plugins/jintia" },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Education",
  };
}

function configured(value) {
  return Array.isArray(value.plugins) && value.plugins.some(plugin =>
    plugin && plugin.name === PLUGIN_NAME && JSON.stringify(plugin) === JSON.stringify(canonicalEntry())
  );
}

function filesCurrent(target, source) {
  const marker = manifest(target);
  return marker && marker.version === source.version
    && fs.existsSync(path.join(target, "openai-plugin", ".mcp.json"))
    && fs.existsSync(path.join(target, "skill", "bin", "jintia.js"));
}

function status(options = {}) {
  const source = sources(options.packageRoot);
  const targetPaths = paths(options);
  const marker = fs.existsSync(targetPaths.target) ? manifest(targetPaths.target) : null;
  const marketplace = marketplaceState(targetPaths.marketplace);
  const marketplaceBackup = fs.existsSync(targetPaths.marketplace) ? fs.readFileSync(targetPaths.marketplace) : null;
  const installed = !!marker && !marker.foreign && filesCurrent(targetPaths.target, source);
  const foreign = fs.existsSync(targetPaths.target) && (!marker || marker.foreign);
  const marketplaceConfigured = configured(marketplace.value);
  const current = installed && marketplaceConfigured;
  return {
    schemaVersion: "1.0.0", operation: "status", target: targetPaths.target, marketplace: targetPaths.marketplace,
    availableVersion: source.version, installedVersion: marker && !marker.foreign ? marker.version : null,
    installed: !!marker && !marker.foreign, current, marketplaceConfigured,
    status: foreign ? "foreign" : current ? "installed" : installed ? "outdated" : fs.existsSync(targetPaths.target) ? "incomplete" : "not-installed",
  };
}

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temp, file);
}

function copyTree(source, target, preserve = []) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const destination = path.join(target, entry.name);
    if (preserve.includes(entry.name)) continue;
    if (entry.isDirectory()) copyTree(path.join(source, entry.name), destination, []);
    else fs.copyFileSync(path.join(source, entry.name), destination);
  }
}

function install(options = {}) {
  if (!options.yes) throw new Error("La instalación del plugin requiere --yes.");
  const source = sources(options.packageRoot);
  const targetPaths = paths(options);
  const current = fs.existsSync(targetPaths.target) ? manifest(targetPaths.target) : null;
  if (fs.existsSync(targetPaths.target) && (!current || current.foreign)) throw new Error("La ruta del plugin existente no pertenece a Jintia y no será sobrescrita.");
  const marketplace = marketplaceState(targetPaths.marketplace);
  if (filesCurrent(targetPaths.target, source) && configured(marketplace.value)) {
    return { schemaVersion: "1.0.0", operation: "install", target: targetPaths.target, marketplace: targetPaths.marketplace, version: source.version, installed: true, current: true, marketplaceConfigured: true, changed: false };
  }
  const stage = `${targetPaths.target}.stage-${Date.now()}-${process.pid}`;
  const backup = `${targetPaths.target}.backup-${Date.now()}-${process.pid}`;
  try {
    copyTree(source.plugin, path.join(stage, "openai-plugin"));
    copyTree(source.skill, path.join(stage, "skill"));
    for (const relative of ["skill/config/institution.json", "skill/config/notebooks.json", "skills/jintia-skill/config/institution.json", "skills/jintia-skill/config/notebooks.json"]) {
      const oldFile = path.join(targetPaths.target, relative);
      if (fs.existsSync(oldFile)) {
        const destination = path.join(stage, relative);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(oldFile, destination);
      }
    }
    fs.writeFileSync(path.join(stage, ".jintia-plugin.json"), `${JSON.stringify({ name: PLUGIN_NAME, version: source.version, managedBy: PLUGIN_NAME }, null, 2)}\n`);
    if (fs.existsSync(targetPaths.target)) fs.renameSync(targetPaths.target, backup);
    fs.renameSync(stage, targetPaths.target);
    const nextMarketplace = { ...marketplace.value, plugins: [...(marketplace.value.plugins || []).filter(plugin => !plugin || plugin.name !== PLUGIN_NAME), canonicalEntry()] };
    atomicJson(targetPaths.marketplace, nextMarketplace);
    const result = status(options);
    if (!result.current) throw new Error("La instalación del plugin no superó la validación final.");
    if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
    return { ...result, operation: "install", version: source.version, changed: true };
  } catch (error) {
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
    if (fs.existsSync(targetPaths.target) && fs.existsSync(backup)) fs.rmSync(targetPaths.target, { recursive: true, force: true });
    if (fs.existsSync(backup) && !fs.existsSync(targetPaths.target)) fs.renameSync(backup, targetPaths.target);
    if (marketplaceBackup) fs.writeFileSync(targetPaths.marketplace, marketplaceBackup);
    else if (fs.existsSync(targetPaths.marketplace)) fs.rmSync(targetPaths.marketplace, { force: true });
    throw error;
  }
}

function main(argv = process.argv.slice(2)) {
  const [subcommand, ...args] = argv;
  const options = { yes: args.includes("--yes"), json: args.includes("--json") };
  const result = subcommand === "status" ? status(options) : subcommand === "install" ? install(options) : (() => { throw new Error("Uso: jintia plugin status [--json] | jintia plugin install --yes [--json]"); })();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

module.exports = { install, status, sources, detection: paths, main };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
