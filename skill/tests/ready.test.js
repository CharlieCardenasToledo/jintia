"use strict";

/**
 * ready.test.js — jintia ready (orquestador completo, ver scripts/ready.js)
 *
 * Usa --skip-pdf en ambos casos: el paso de compile depende de Vivliostyle
 * CLI real, fuera del alcance de un test determinista de CI. Los demás
 * pasos (validate --publish, evidencia, bibliografía, render, html-lint,
 * preflight) sí se ejercitan de punta a punta.
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const fs     = require("node:fs");
const os     = require("node:os");
const path   = require("node:path");

const { runReady } = require("../scripts/ready");
const { isCitationJsAvailable } = require("../scripts/bibliography-manager");

function buildCompleteGuideDir() {
  const dir     = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-ready-test-"));
  const weekDir = path.join(dir, "semanas", "semana-01");
  fs.mkdirSync(weekDir, { recursive: true });

  const guide = {
    metadata: {
      course: "Test", week: 1, topic: "Tema", outcome: "Resultado",
      hours: 2.5, citationStyle: "apa", bibliography: "reference.bib",
      targets: [
        { id: "T1", verb: "diferenciar", description: "x" },
        { id: "T2", verb: "diagnosticar", description: "y" },
        { id: "T3", verb: "investigar", description: "z" },
      ],
    },
    sections: [
      {
        type: "orientation", id: "o", route: ["Teoría", "Práctica", "Evaluación"],
        purpose: "Propósito de la semana.", materials: ["Lectura base"],
        successCriteria: ["Explica el propósito con sus propias palabras."], estimatedMinutes: 15,
      },
      {
        type: "theory", id: "t", targetIds: ["T1", "T2", "T3"], claimIds: ["CLM-001", "CLM-002", "CLM-003"], estimatedMinutes: 60,
        content: "Un sistema de archivos duplica datos entre programas independientes, mientras que una base de datos centraliza el almacenamiento y reduce la redundancia observada en los procesos administrativos {{cite:date2004}}.",
      },
      {
        type: "practice", id: "p", targetIds: ["T1", "T2", "T3"],
        workedExample: "Ejemplo resuelto: se identifican las tablas redundantes comparando los campos repetidos entre archivos de distintos departamentos.",
        prompt: "Resuelve el caso identificando qué datos se duplican entre los archivos proporcionados.",
        steps: ["Lista los campos de cada archivo.", "Marca los campos que se repiten entre archivos.", "Propón una tabla única que los reemplace."],
        successCriteria: ["Identifica al menos dos campos redundantes."], selfCheck: "Compara tu lista contra la solución modelo.",
        feedback: "Si tu lista difiere, revisa los campos de contacto y ubicación.", remediation: "Repite el ejercicio con un subconjunto más pequeño de archivos.",
        transfer: "Aplica el mismo análisis a los archivos de tu propio proyecto.", estimatedMinutes: 40,
      },
      {
        type: "practice", id: "retencion", mode: "retrieval", targetIds: ["T1"], estimatedMinutes: 10,
        successCriteria: ["Recuerda sin apoyo la diferencia entre archivo y base de datos."],
        selfCheck: "Autoevalúa tu respuesta contra la definición vista en la teoría.",
      },
      {
        type: "assessment", id: "e", targetIds: ["T1", "T2", "T3"],
        product: "Informe de una página describiendo la redundancia diagnosticada y la solución propuesta.",
        criteria: [{ description: "Identifica correctamente la redundancia y propone una solución coherente.", weight: 100 }],
        estimatedMinutes: 20,
      },
      { type: "bibliography", id: "refs" },
    ],
  };

  fs.writeFileSync(path.join(weekDir, "guide.json"), JSON.stringify(guide));
  fs.writeFileSync(path.join(weekDir, "reference.bib"), "@book{date2004, author={Date, C. J.}, title={An Introduction to Database Systems}, year={2004}, publisher={Addison-Wesley}}");
  fs.writeFileSync(path.join(weekDir, "evidence.json"), JSON.stringify({
    week: 1,
    claims: [
      { id: "CLM-001", targetId: "T1", claim: "x", sourceMode: "notebook-primary", bibliographyKey: "date2004", evidence: { sourceId: "s", sourceName: "Beynon-Davies", extractionStatus: "complete" } },
      { id: "CLM-002", targetId: "T2", claim: "y", sourceMode: "notebook-primary", bibliographyKey: "date2004", evidence: { sourceId: "s", sourceName: "Beynon-Davies", extractionStatus: "complete" } },
      { id: "CLM-003", targetId: "T3", claim: "z", sourceMode: "notebook-primary", bibliographyKey: "date2004", evidence: { sourceId: "s", sourceName: "Beynon-Davies", extractionStatus: "complete" } },
    ],
  }));

  return { dir, guidePath: path.join(weekDir, "guide.json") };
}

test("READY — se detiene en el primer paso bloqueante sin renderizar (sin metadata.targets)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-ready-early-"));
  const guidePath = path.join(dir, "guide.json");
  fs.writeFileSync(guidePath, JSON.stringify({
    metadata: { course: "T", week: 1, topic: "T", outcome: "O" },
    sections: [{ type: "orientation", id: "o" }],
  }));
  try {
    const report = await runReady(guidePath, { skipPdf: true });
    assert.equal(report.deterministicDecision, "BLOCKED");
    assert.ok(report.issues.some(i => i.rule === "JIN-SCH-002"));
    const stepNames = report.steps.map(s => s.step);
    assert.ok(!stepNames.includes("render"), "No debe llegar a renderizar si validate --publish ya bloqueó");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("READY — una guía completa pasa toda la cadena determinista (--skip-pdf)", async () => {
  if (!isCitationJsAvailable()) {
    // Sin Citation.js, assertPublishReady() bloquea por diseño (JIN-BIB-001)
    // — ese comportamiento ya está cubierto en bibliography.test.js. Aquí
    // solo se puede probar la cadena completa cuando Citation.js sí está.
    return;
  }
  const { dir, guidePath } = buildCompleteGuideDir();
  try {
    const report = await runReady(guidePath, { skipPdf: true });
    const stepStatus = Object.fromEntries(report.steps.map(s => [s.step, s.status]));
    assert.equal(stepStatus["validate --publish"], "ok", JSON.stringify(report.issues));
    assert.equal(stepStatus["evidence provenance"], "ok");
    assert.equal(stepStatus["bibliography (pre-render)"], "ok");
    assert.equal(stepStatus["render"], "ok");
    assert.equal(stepStatus["html lint"], "ok");
    assert.equal(stepStatus["bibliography (post-render)"], "ok");
    assert.equal(stepStatus["preflight"], "ok");
    assert.equal(stepStatus["compile (PDF)"], "skipped");
    assert.equal(report.deterministicDecision, "PRECHECK_READY", "Sin PDF real, la decisión no debe ser READY sino PRECHECK_READY");
    assert.equal(report.provenance.academicProvenance, "STRONG");
    assert.ok(report.notes.some(n => /jintia-selfstudy-reviewer/.test(n)), "Debe recordar que faltan las revisiones de agente");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("READY — sin --skip-pdf y sin Vivliostyle disponible, la decisión es BLOCKED (no 'skipped')", async () => {
  if (!isCitationJsAvailable()) return;
  const { dir, guidePath } = buildCompleteGuideDir();
  const originalPath    = process.env.PATH;
  const originalManaged = process.env.JINTIA_VIVLIOSTYLE_BIN;
  // Simula un entorno sin Vivliostyle CLI instalado, independientemente de
  // si esta máquina lo tiene instalado globalmente.
  process.env.PATH = "";
  delete process.env.JINTIA_VIVLIOSTYLE_BIN;
  try {
    const report = await runReady(guidePath, { skipPdf: false });
    const compileStep = report.steps.find(s => s.step === "compile (PDF)");
    assert.equal(compileStep.status, "error", "Sin Vivliostyle y sin --skip-pdf, compile debe quedar en error, no 'skipped'");
    assert.equal(report.deterministicDecision, "BLOCKED", "Pedir el cierre completo sin poder alcanzarlo debe bloquear, no aparentar READY");
  } finally {
    process.env.PATH = originalPath;
    if (originalManaged !== undefined) process.env.JINTIA_VIVLIOSTYLE_BIN = originalManaged;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
