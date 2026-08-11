"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");
const PLUGIN_NAME = "jintia";
const MUTABLE_FILES = new Set([
  "config/institution.json",
  "config/notebooks.json",
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function paths(options = {}) {
  const home = options.homeDir || process.env.JINTIA_PLUGIN_HOME || os.homedir();
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
    path.join(skill, "package.json"),
    path.join(skill, "bin", "jintia.js"),
    path.join(plugin, ".codex-plugin", "plugin.json"),
    path.join(plugin, ".mcp.json"),
    path.join(plugin, "README.md"),
  ]) {
    if (!fs.statSync(required).isFile()) throw new Error(`Fuente del plugin incompleta: ${required}`);
  }
  return { packageRoot, skill, plugin, version };
}

function installedPluginManifest(target) {
  const file = path.join(target, ".codex-plugin", "plugin.json");
  if (!fs.existsSync(file)) return null;
  try {
    const value = readJson(file);
    return value && typeof value === "object" && !Array.isArray(value) && value.name === PLUGIN_NAME
      ? value
      : { foreign: true };
  } catch {
    return { foreign: true };
  }
}

function recognized(target) {
  const value = installedPluginManifest(target);
  return value && !value.foreign ? value : null;
}

function requiredTargetFiles(target) {
  return [
    path.join(target, ".codex-plugin", "plugin.json"),
    path.join(target, ".mcp.json"),
    path.join(target, "README.md"),
    path.join(target, "skills", "jintia-skill", "package.json"),
    path.join(target, "skills", "jintia-skill", "SKILL.md"),
    path.join(target, "skills", "jintia-skill", "bin", "jintia.js"),
  ];
}

function structurallyComplete(target) {
  return !!recognized(target) && requiredTargetFiles(target).every(file => fs.existsSync(file) && fs.statSync(file).isFile());
}

function canonicalEntry() {
  return {
    name: PLUGIN_NAME,
    source: { source: "local", path: "./.codex/plugins/jintia" },
    policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
    category: "Education",
  };
}

function marketplaceState(file) {
  if (!fs.existsSync(file)) return { value: { plugins: [] }, exists: false, bytes: null };
  const bytes = fs.readFileSync(file);
  const value = JSON.parse(bytes.toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("El marketplace no contiene un objeto JSON válido.");
  if (value.plugins !== undefined && !Array.isArray(value.plugins)) throw new Error("El campo plugins del marketplace debe ser un array.");
  return { value, exists: true, bytes };
}

function marketplaceConfigured(value) {
  return Array.isArray(value.plugins) && value.plugins.some(plugin =>
    plugin && plugin.name === PLUGIN_NAME && JSON.stringify(plugin) === JSON.stringify(canonicalEntry())
  );
}

function fileEqual(left, right) {
  return fs.existsSync(left) && fs.existsSync(right) && fs.statSync(left).isFile() && fs.statSync(right).isFile()
    && fs.readFileSync(left).equals(fs.readFileSync(right));
}

function treeEqual(source, target, relative = "") {
  if (!fs.existsSync(source) || !fs.existsSync(target)) return false;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const rel = (relative ? path.join(relative, entry.name) : entry.name).split(path.sep).join("/");
    if (MUTABLE_FILES.has(rel)) continue;
    const sourceFile = path.join(source, entry.name);
    const targetFile = path.join(target, entry.name);
    if (entry.isDirectory()) {
      if (!fs.existsSync(targetFile) || !fs.statSync(targetFile).isDirectory() || !treeEqual(sourceFile, targetFile, rel)) return false;
    } else if (!fileEqual(sourceFile, targetFile)) return false;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const rel = (relative ? path.join(relative, entry.name) : entry.name).split(path.sep).join("/");
    if (!MUTABLE_FILES.has(rel) && !fs.existsSync(path.join(source, entry.name))) return false;
  }
  return true;
}

function currentBytes(target, source) {
  if (!structurallyComplete(target)) return false;
  return fileEqual(path.join(source.plugin, ".codex-plugin", "plugin.json"), path.join(target, ".codex-plugin", "plugin.json"))
    && fileEqual(path.join(source.plugin, ".mcp.json"), path.join(target, ".mcp.json"))
    && fileEqual(path.join(source.plugin, "README.md"), path.join(target, "README.md"))
    && treeEqual(source.skill, path.join(target, "skills", "jintia-skill"));
}

function status(options = {}) {
  const source = sources(options.packageRoot);
  const targetPaths = paths(options);
  const targetExists = fs.existsSync(targetPaths.target);
  const installedManifest = targetExists ? installedPluginManifest(targetPaths.target) : null;
  const marketplace = marketplaceState(targetPaths.marketplace);
  const isRecognized = !!installedManifest && !installedManifest.foreign;
  const complete = isRecognized && structurallyComplete(targetPaths.target);
  const bytesCurrent = complete && currentBytes(targetPaths.target, source);
  const marketplaceIsConfigured = marketplaceConfigured(marketplace.value);
  let state = "not-installed";
  if (targetExists && !isRecognized) state = "foreign";
  else if (targetExists && !complete) state = "incomplete";
  else if (complete && (!bytesCurrent || installedManifest.version !== source.version)) state = "outdated";
  else if (complete && !marketplaceIsConfigured) state = "incomplete";
  else if (complete) state = "installed";
  return {
    schemaVersion: "1.0.0", operation: "status", target: targetPaths.target, marketplace: targetPaths.marketplace,
    availableVersion: source.version, installedVersion: isRecognized ? installedManifest.version || null : null,
    installed: isRecognized, current: state === "installed", marketplaceConfigured: marketplaceIsConfigured, status: state,
  };
}

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
    fs.renameSync(temp, file);
  } catch (error) {
    try { fs.rmSync(temp, { force: true }); } catch { /* preserve original error */ }
    throw error;
  }
}

function copyTree(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const destination = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(path.join(source, entry.name), destination);
    else fs.copyFileSync(path.join(source, entry.name), destination);
  }
}

function copyMutableFiles(target, stage) {
  for (const relative of MUTABLE_FILES) {
    const oldFile = path.join(target, "skills", "jintia-skill", relative);
    if (fs.existsSync(oldFile)) {
      const destination = path.join(stage, "skills", "jintia-skill", relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(oldFile, destination);
    }
  }
}

function buildMarketplace(value) {
  return {
    ...value,
    plugins: [...(value.plugins || []).filter(plugin => !plugin || plugin.name !== PLUGIN_NAME), canonicalEntry()],
  };
}

function install(options = {}) {
  if (!options.yes) throw new Error("La instalación del plugin requiere --yes.");
  const source = sources(options.packageRoot);
  const targetPaths = paths(options);
  const targetExists = fs.existsSync(targetPaths.target);
  if (targetExists && !recognized(targetPaths.target)) throw new Error("La ruta del plugin existente no pertenece a Jintia y no será sobrescrita.");
  const marketplace = marketplaceState(targetPaths.marketplace);
  const writeMarketplace = options.writeMarketplace || atomicJson;
  if (targetExists && currentBytes(targetPaths.target, source) && recognized(targetPaths.target).version === source.version && marketplaceConfigured(marketplace.value)) {
    return { schemaVersion: "1.0.0", operation: "install", target: targetPaths.target, marketplace: targetPaths.marketplace, version: source.version, installed: true, current: true, marketplaceConfigured: true, changed: false };
  }
  const stamp = `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}`;
  const stage = `${targetPaths.target}.stage-${stamp}`;
  const backup = `${targetPaths.target}.backup-${stamp}`;
  let targetActivated = false;
  try {
    copyTree(path.join(source.plugin, ".codex-plugin"), path.join(stage, ".codex-plugin"));
    fs.copyFileSync(path.join(source.plugin, ".mcp.json"), path.join(stage, ".mcp.json"));
    fs.copyFileSync(path.join(source.plugin, "README.md"), path.join(stage, "README.md"));
    copyTree(source.skill, path.join(stage, "skills", "jintia-skill"));
    if (targetExists) copyMutableFiles(targetPaths.target, stage);
    if (!structurallyComplete(stage) || !currentBytes(stage, source)) throw new Error("El staging del plugin no superó la validación.");
    if (targetExists) fs.renameSync(targetPaths.target, backup);
    fs.renameSync(stage, targetPaths.target);
    targetActivated = true;
    writeMarketplace(targetPaths.marketplace, buildMarketplace(marketplace.value));
    const result = status(options);
    if (!result.current) throw new Error("La instalación del plugin no superó la validación final.");
    if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
    return { ...result, operation: "install", version: source.version, changed: true };
  } catch (error) {
    try { if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true }); } catch { /* preserve original error */ }
    try {
      if (targetActivated && fs.existsSync(targetPaths.target)) fs.rmSync(targetPaths.target, { recursive: true, force: true });
      if (fs.existsSync(backup) && !fs.existsSync(targetPaths.target)) fs.renameSync(backup, targetPaths.target);
      if (marketplace.exists) fs.writeFileSync(targetPaths.marketplace, marketplace.bytes);
      else if (fs.existsSync(targetPaths.marketplace)) fs.rmSync(targetPaths.marketplace, { force: true });
    } catch { /* preserve original error */ }
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

module.exports = { install, status, sources, detection: paths, main, installedPluginManifest, structurallyComplete, currentBytes, marketplaceConfigured };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
