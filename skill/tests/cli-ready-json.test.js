"use strict";

/**
 * cli-ready-json.test.js — REGRESIÓN 2026-08-23: `jintia ready --json` roto
 * a través del CLI (bin/jintia.js), encontrado con una ejecución real vía
 * el servidor OpenCode al verificar si su relay de tool calls entrega
 * salida incremental o solo al cerrar (no lo hace: solo al cerrar, con el
 * blob completo — ver commit de jintia-desktop).
 *
 * Dos bugs reales encontrados en esa sesión, ambos cubiertos aquí:
 *
 * 1. `runScript()` en bin/jintia.js nunca reenviaba `--json` a ready.js (no
 *    estaba en la lista blanca de scripts que sí lo reciben) — así que
 *    `ready.js` imprimía SIEMPRE el reporte humano de texto plano a stdout,
 *    JSON.parse fallaba, y `createReport()` nunca poblaba `data`. Esto
 *    llevaba años roto (independiente de progress-events.js): cualquier
 *    consumidor de `jintia ready --json` recibía `{"errors":[...]}` sin
 *    el reporte real.
 *
 * 2. Al agregar eventos de progreso a stderr (scripts/progress-events.js),
 *    el bug #1 se volvió mucho más visible: `createReport()` arma su
 *    mensaje de fallback con la ÚLTIMA línea de stdout+stderr concatenados
 *    cuando el exit code no es 0 — y como esos eventos ahora estaban en
 *    stderr, el "mensaje de error" mostrado al usuario pasó a ser
 *    literalmente `##JINTIA-EVENT##{...}` en vez de texto legible.
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const fs     = require("node:fs");
const os     = require("node:os");
const path   = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const cli  = path.join(root, "bin", "jintia.js");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

function buildBlockedGuideDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-cli-ready-json-"));
  const guidePath = path.join(dir, "guide.json");
  // Deliberadamente sin metadata.targets: JIN-SCH-002 bloquea validate
  // --publish, así ready.js termina con deterministicDecision=BLOCKED y
  // exit code 1 — exactamente el caso que rompía el reporte JSON.
  fs.writeFileSync(guidePath, JSON.stringify({
    metadata: { course: "C", week: 1, topic: "T", outcome: "O", hours: 1 },
    sections: [{ type: "orientation", route: ["a"], purpose: "p", materials: ["m"], successCriteria: ["sc"], estimatedMinutes: 5 }],
  }));
  return { dir, guidePath };
}

test("REGRESIÓN — jintia ready --json reenvía --json a ready.js y puebla 'data' con el reporte real", () => {
  const { dir, guidePath } = buildBlockedGuideDir();
  try {
    const result = run(["ready", guidePath, "--skip-pdf", "--json"]);
    assert.equal(result.status, 1, "una guía BLOCKED debe salir con código 1");
    const report = JSON.parse(result.stdout);
    assert.ok(report.data, "el wrapper CLI debe poblar 'data' con el reporte real de ready.js (antes: siempre null, --json nunca llegaba a ready.js)");
    assert.equal(report.data.tool, "jintia ready");
    assert.equal(report.data.deterministicDecision, "BLOCKED");
    assert.ok(Array.isArray(report.data.steps) && report.data.steps.length > 0);
    assert.ok(Array.isArray(report.data.issues) && report.data.issues.length > 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("REGRESIÓN — el mensaje de error del CLI nunca expone líneas ##JINTIA-EVENT## (telemetría interna, no un mensaje humano)", () => {
  const { dir, guidePath } = buildBlockedGuideDir();
  try {
    const result = run(["ready", guidePath, "--skip-pdf", "--json"]);
    assert.doesNotMatch(result.stdout, /##JINTIA-EVENT##/, "la salida --json nunca debe filtrar telemetría de progreso interna");
    const report = JSON.parse(result.stdout);
    for (const err of report.errors) {
      assert.doesNotMatch(err.message, /##JINTIA-EVENT##/);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
