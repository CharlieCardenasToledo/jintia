#!/usr/bin/env node
"use strict";

const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const { detectInstallationStates, mutate, normalizeProviders } = require("../runtime/core");
const skillVersion = require("../package.json").version;

const args = process.argv.slice(2);
const operation = args.find(arg => !arg.startsWith("--")) || "status";
const value = name => {
  const arg = args.find(item => item.startsWith(`${name}=`));
  if (arg) return arg.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith("--") ? args[index + 1] : null;
};
const projectRoot = path.resolve(value("--project") || process.cwd());
const interactive = Boolean(stdin.isTTY && stdout.isTTY && !args.includes("--json"));
const mutating = ["install", "update", "repair", "uninstall"].includes(operation);

function output(data) {
  if (args.includes("--json")) console.log(JSON.stringify(data, null, 2));
  else if (data.results) data.results.forEach(item => console.log(`${item.id}: ${item.scope} · ${item.status}${item.target ? ` · ${item.target}` : ""}`));
  else (data.providers || data).forEach(item => console.log(`${item.id}: ${item.scope} · ${item.state.status} · ${item.state.version || "sin versión"} · ${item.target}`));
}

function suggestedProviders(scope, options) {
  return [...new Set(detectInstallationStates(options)
    .filter(item => item.scope === scope && item.state.status !== "not-detected")
    .map(item => item.id))];
}

function providerIds(raw) {
  const requested = String(raw || "").split(",").map(item => item.trim()).filter(Boolean);
  const normalized = normalizeProviders(requested).map(provider => provider.id);
  if (requested.length !== normalized.length) throw new Error(`Proveedor desconocido en: ${raw}`);
  return normalized;
}

async function promptOptions(base) {
  if (!mutating) return base;
  const terminal = interactive ? readline.createInterface({ input: stdin, output: stdout }) : null;
  try {
    let scope = value("--scope");
    if (!scope && terminal) scope = (await terminal.question("Alcance project/global [project]: ")).trim() || "project";
    scope ||= "project";
    if (!["project", "global"].includes(scope)) throw new Error("El alcance debe ser project o global.");

    let providers = providerIds(value("--providers"));
    if (!providers.length) {
      const detected = suggestedProviders(scope, base);
      const defaults = detected.length ? detected : ["claude", "codex"];
      if (terminal) {
        const answer = (await terminal.question(`Proveedores separados por coma [${defaults.join(",")}]: `)).trim();
        providers = providerIds(answer || defaults.join(","));
      } else if (detected.length) providers = detected;
      else throw new Error("Indica --providers=claude,codex en ejecuciones no interactivas.");
    }

    let confirm = args.includes("--yes");
    if (!confirm && terminal) {
      console.log(`Se gestionará Jintia ${scope === "project" ? "en este proyecto" : "para el usuario"}: ${providers.join(", ")}.`);
      confirm = /^(?:s|si|sí|y|yes)$/i.test((await terminal.question("¿Continuar? [s/N]: ")).trim());
      if (!confirm) return { ...base, scope, providers, cancelled: true };
    }
    if (!confirm) throw new Error("La operación modifica archivos. Confirma explícitamente con --yes.");
    return { ...base, scope, providers, explicitProviders: providers, confirm, adoptExisting: args.includes("--adopt-existing") };
  } finally {
    terminal?.close();
  }
}

async function main() {
  const requestedProviders = providerIds(value("--providers"));
  const base = {
    providers: requestedProviders,
    explicitProviders: requestedProviders,
    projectRoot,
    scope: value("--scope") || "project",
    sourcePath: value("--source"),
    version: value("--version") || skillVersion,
    confirm: args.includes("--yes"),
    adoptExisting: args.includes("--adopt-existing")
  };
  const options = await promptOptions(base);
  if (options.cancelled) {
    console.log("Instalación cancelada; no se modificaron archivos.");
    return;
  }
  const result = operation === "status" || operation === "doctor"
    ? { operation: "status", projectRoot, providers: detectInstallationStates(options) }
    : mutate(operation, options);
  output(result);
}

main().catch(error => {
  console.error(`Jintia Harness: ${error.message}`);
  process.exitCode = 1;
});
