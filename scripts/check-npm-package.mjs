import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Ejecuta esta validación mediante npm run package:check.");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const skillPackage = JSON.parse(readFileSync(resolve(root, "skill/package.json"), "utf8"));
const openaiPlugin = JSON.parse(readFileSync(resolve(root, "openai-plugin/.codex-plugin/plugin.json"), "utf8"));
const releaseConfig = JSON.parse(readFileSync(resolve(root, "release/release-config.json"), "utf8"));
const packed = JSON.parse(execFileSync(process.execPath, [npmCli, "pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
}));

const [artifact] = packed;
const failures = [];
const files = new Set((artifact?.files || []).map(file => file.path.replace(/\\/g, "/")));
const required = [
  "LICENSE",
  "README.md",
  "package.json",
  "skill/.claude-plugin/plugin.json",
  "skill/SKILL.md",
  "skill/agents/openai.yaml",
  "skill/bin/jintia.js",
  "skill/runtime/core/harness-manager.js",
  "skill/themes/jintia-clasico/meta.json",
  "openai-plugin/.codex-plugin/plugin.json",
  "openai-plugin/.mcp.json",
  "openai-plugin/README.md",
  "release/release-config.json",
];

if (packageJson.name !== "@charlie.act7/jintia") failures.push(`nombre npm inesperado: ${packageJson.name}`);
if (packageJson.version !== skillPackage.version) failures.push("la versión npm no coincide con la skill");
if (openaiPlugin.name !== "jintia") failures.push(`nombre del wrapper inesperado: ${openaiPlugin.name}`);
if (openaiPlugin.version !== skillPackage.version) failures.push("la versión del wrapper no coincide con la skill");
if (packageJson.bin?.jintia !== "skill/bin/jintia.js") failures.push("falta el ejecutable jintia");
if (artifact?.name !== packageJson.name || artifact?.version !== packageJson.version) failures.push("npm pack devolvió identidad inconsistente");
for (const file of required) if (!files.has(file)) failures.push(`falta en el paquete npm: ${file}`);
const releaseFiles = [...files].filter(file => file.startsWith("release/"));
if (releaseFiles.length !== 1 || releaseFiles[0] !== "release/release-config.json") failures.push(`archivos release inesperados: ${JSON.stringify(releaseFiles)}`);
if (!packageJson.files.includes("release/release-config.json")) failures.push("package.json no publica explícitamente release/release-config.json");
if (packageJson.files.some(file => ["release", "release/", "release/*", "release/**"].includes(file))) failures.push("package.json publica release/ demasiado ampliamente");
if (releaseConfig.$schemaVersion !== "1.0.0") failures.push("release schemaVersion inesperado");
if (releaseConfig.repository !== "CharlieCardenasToledo/jintia") failures.push("release repository inesperado");
if (releaseConfig.minimumDesktopVersion !== "1.1.0") failures.push("release minimumDesktopVersion inesperado");
if (releaseConfig.mcp?.package !== "@charlie.act7/gemini-notebook-mcp") failures.push("release MCP package inesperado");
if (!/^\d+\.\d+\.\d+$/.test(releaseConfig.mcp?.version || "")) failures.push("release MCP version no es exacta");
if (typeof releaseConfig.mcp?.node !== "string" || !releaseConfig.mcp.node.trim()) failures.push("release MCP node inválido");
if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(releaseConfig.mcp?.npmIntegrity || "")) failures.push("release MCP integrity inválido");
const openaiMcp = JSON.parse(readFileSync(resolve(root, "openai-plugin/.mcp.json"), "utf8"));
if (openaiMcp.notebooklm?.args?.at(-1) !== `${releaseConfig.mcp.package}@${releaseConfig.mcp.version}`) failures.push("OpenAI MCP no coincide con release-config");
for (const file of files) {
  if (file.startsWith("skill/tests/") || file.startsWith("openai-plugin/skills/") || /(?:institution|notebooks)\.json$/i.test(file)) {
    failures.push(`archivo privado o de desarrollo incluido: ${file}`);
  }
}

if (failures.length) {
  failures.forEach(failure => console.error(`[ERROR] ${failure}`));
  process.exit(1);
}

console.log(`Paquete npm válido: ${artifact.name}@${artifact.version}, ${artifact.entryCount} archivos, ${artifact.unpackedSize} bytes sin comprimir.`);
