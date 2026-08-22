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

function buildCompleteGuideDir() {
  const dir     = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-ready-test-"));
  const weekDir = path.join(dir, "semanas", "semana-01");
  fs.mkdirSync(weekDir, { recursive: true });

  const guide = {
    metadata: {
      course: "Test", week: 1, topic: "Tema", outcome: "Resultado",
      hours: 2, citationStyle: "apa", bibliography: "reference.bib",
      targets: [
        { id: "T1", verb: "diferenciar", description: "x" },
        { id: "T2", verb: "diagnosticar", description: "y" },
        { id: "T3", verb: "investigar", description: "z" },
      ],
    },
    sections: [
      { type: "orientation", id: "o", route: ["Teoría", "Práctica", "Evaluación"] },
      { type: "theory", id: "t", targetIds: ["T1", "T2", "T3"], claimIds: ["CLM-001"], estimatedMinutes: 60, content: "x {{cite:date2004}}" },
      { type: "practice", id: "p", targetIds: ["T1", "T2", "T3"], workedExample: "e", successCriteria: ["c"], selfCheck: "s", feedback: "f", remediation: "r", transfer: "tr", estimatedMinutes: 40 },
      { type: "practice", id: "retencion", mode: "retrieval", targetIds: ["T1"], estimatedMinutes: 10, successCriteria: ["x"], selfCheck: "y" },
      { type: "assessment", id: "e", targetIds: ["T1", "T2", "T3"], product: "Informe", criteria: [{ description: "c", weight: 100 }], estimatedMinutes: 20 },
      { type: "bibliography", id: "refs" },
    ],
  };

  fs.writeFileSync(path.join(weekDir, "guide.json"), JSON.stringify(guide));
  fs.writeFileSync(path.join(weekDir, "reference.bib"), "@book{date2004, author={Date, C. J.}, title={An Introduction to Database Systems}, year={2004}, publisher={Addison-Wesley}}");
  fs.writeFileSync(path.join(weekDir, "evidence.json"), JSON.stringify({
    week: 1,
    claims: [{ id: "CLM-001", claim: "x", sourceMode: "notebook-primary", bibliographyKey: "date2004", evidence: { sourceId: "s", sourceName: "Beynon-Davies", extractionStatus: "complete" } }],
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
    assert.equal(report.deterministicDecision, "READY");
    assert.equal(report.provenance.academicProvenance, "STRONG");
    assert.ok(report.notes.some(n => /jintia-selfstudy-reviewer/.test(n)), "Debe recordar que faltan las revisiones de agente");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
