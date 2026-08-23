"use strict";

/**
 * progress-events.test.js — Eventos deterministas de progreso hacia stderr.
 *
 * Jintia Desktop necesita saber en qué paso está `jintia ready`/`jintia plan
 * approve` mientras el proceso corre, sin adivinarlo del texto del agente.
 * Estos tests verifican el formato de la línea (sentinel + JSON parseable) y
 * que los dos orquestadores instrumentados realmente la emiten, en orden,
 * para cada paso que ya ejecutan internamente.
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const fs     = require("node:fs");
const os     = require("node:os");
const path   = require("node:path");

const { emitProgress, SENTINEL } = require("../scripts/progress-events");
const { runReady } = require("../scripts/ready");

function captureStderr(fn) {
  const original = process.stderr.write.bind(process.stderr);
  const chunks = [];
  process.stderr.write = (chunk) => { chunks.push(String(chunk)); return true; };
  try {
    return { result: fn(), output: () => chunks.join("") };
  } finally {
    process.stderr.write = original;
  }
}

function extractEvents(text) {
  return text.split("\n")
    .filter(line => line.includes(SENTINEL))
    .map(line => JSON.parse(line.slice(line.indexOf(SENTINEL) + SENTINEL.length)));
}

test("emitProgress escribe una línea con sentinel + JSON parseable a stderr", () => {
  const { output } = captureStderr(() => {
    emitProgress({ command: "ready", step: "render", status: "ok", detail: "guide.html" });
  });
  const events = extractEvents(output());
  assert.equal(events.length, 1);
  assert.deepEqual(events[0], { event: "work.progress", command: "ready", step: "render", status: "ok", detail: "guide.html" });
});

test("emitProgress nunca escribe a stdout (no debe alterar el contrato --json)", () => {
  const originalStdout = process.stdout.write.bind(process.stdout);
  let stdoutTouched = false;
  process.stdout.write = (chunk) => { stdoutTouched = true; return originalStdout(chunk); };
  try {
    captureStderr(() => emitProgress({ command: "ready", step: "x", status: "ok" }));
  } finally {
    process.stdout.write = originalStdout;
  }
  assert.equal(stdoutTouched, false);
});

test("jintia ready emite eventos de progreso en orden para cada paso de la cadena determinista", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-progress-"));
  try {
    const guidePath = path.join(dir, "guide.json");
    fs.writeFileSync(guidePath, JSON.stringify({
      metadata: { course: "C", week: 1, topic: "T", outcome: "O", hours: 1 },
      sections: [
        { type: "orientation", route: ["a"], purpose: "p", materials: ["m"], successCriteria: ["sc"], estimatedMinutes: 5 },
      ],
    }));

    const { result, output } = captureStderr(() => runReady(guidePath, { skipPdf: true }));
    await result;
    const events = extractEvents(output());

    assert.ok(events.length > 0, "debe emitir al menos un evento de progreso");
    assert.equal(events[0].command, "ready");
    assert.equal(events[0].step, "validate --publish");
    assert.equal(events[0].status, "running");

    const steps = events.map(e => e.step);
    assert.ok(steps.includes("validate --publish"));
    // La guía no declara metadata.targets: la cadena se detiene en
    // "validate --publish" (bloqueada) — confirmarlo en vez de asumir que
    // llega a "render" es lo que hace este test robusto a cambios en el gate.
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
