#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const registry = {
  init: ["jintia-researcher", "jintia-finish-reviewer"],
  syllabus: ["jintia-researcher", "jintia-instructional-reviewer"],
  plan: ["jintia-researcher", "jintia-instructional-reviewer"],
  guide: ["jintia-researcher", "jintia-instructional-reviewer", "jintia-selfstudy-reviewer", "jintia-visual-producer", "jintia-finish-reviewer"],
  assessment: ["jintia-researcher", "jintia-instructional-reviewer"],
  visual: ["jintia-visual-producer", "jintia-finish-reviewer"],
  validate: ["jintia-finish-reviewer"],
  compile: ["jintia-finish-reviewer"],
  audit: ["jintia-researcher", "jintia-instructional-reviewer", "jintia-selfstudy-reviewer", "jintia-finish-reviewer"],
  migrate: ["jintia-finish-reviewer"],
  doctor: ["jintia-finish-reviewer"],
};

function createPlan(operation) {
  const agents = registry[operation];
  if (!agents) throw new Error(`No existe un plan de agentes para: ${operation}`);
  return {
    schemaVersion: "1.0.0",
    operation,
    mode: "delegation-plan",
    agents: agents.map((name, index) => ({
      name,
      contract: path.join(ROOT, "agents", `${name}.md`),
      order: index + 1,
      status: "pending",
    })),
    handoff: "El agente principal debe ejecutar cada contrato y conservar sus salidas antes de continuar.",
  };
}

const [operation, ...args] = process.argv.slice(2);
if (!operation || !registry[operation]) {
  console.error(`Uso: node scripts/agent-plan.js <${Object.keys(registry).join("|")}> [--json]`);
  process.exit(2);
}
try {
  const plan = createPlan(operation);
  const invalid = plan.agents.find(agent => !fs.existsSync(agent.contract));
  if (invalid) throw new Error(`Falta el contrato del agente: ${invalid.name}`);
  if (args.includes("--json")) console.log(JSON.stringify(plan, null, 2));
  else {
    console.log(`Jintia Agent Plan · ${operation}`);
    for (const agent of plan.agents) console.log(`${agent.order}. ${agent.name} → ${agent.contract}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
module.exports = { registry, createPlan };
