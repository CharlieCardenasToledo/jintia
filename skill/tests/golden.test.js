"use strict";

/**
 * golden.test.js — Fixture de regresión "la guía que parece terminada pero no lo está"
 *
 * tests/fixtures/golden-flawed-guide.json modela el caso que motivó el
 * Release 12.1: visualmente completo (orientation → theory → practice →
 * assessment → bibliography, con horas y citationStyle declarados), pero
 * pedagógicamente inválido — T3 se evalúa sin haberse enseñado, la práctica
 * de T2 no tiene modelo ni autocorrección, y la carga horaria real es una
 * fracción de la declarada. Antes de las familias JIN-ALN, JIN-SELF, JIN-ASM
 * y JIN-WRK esta guía habría pasado `jintia validate` sin errores.
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const path   = require("node:path");

const { lintGuide } = require("../scripts/content-linter");

const FIXTURE = path.join(__dirname, "fixtures", "golden-flawed-guide.json");

test("GOLDEN — la guía visualmente completa pero pedagógicamente inválida no pasa validate", () => {
  const report = lintGuide(FIXTURE);
  assert.equal(report.summary.passed, false, "El fixture golden debe fallar la validación");

  const codes = report.issues.map(i => i.rule);
  const expectedErrors = [
    "JIN-BIB-007", // citationStyle distinto de apa
    "JIN-WRK-002", // carga horaria real muy por debajo de metadata.hours
    "JIN-ALN-010", // T3 se evalúa pero no se enseña
    "JIN-ALN-011", // T1 y T3 sin práctica formativa
    "JIN-ALN-013", // T1 y T2 sin evaluación
    "JIN-ALN-014", // el assessment evalúa T3 sin respaldo de enseñanza
    "JIN-SELF-002", // práctica guiada sin workedExample
    "JIN-SELF-003", // práctica sin successCriteria
    "JIN-SELF-004", // práctica sin selfCheck ni feedback
    "JIN-SELF-005", // ninguna práctica declara remediation
    "JIN-SELF-006", // ninguna práctica de recuperación
    "JIN-SELF-007", // ningún assessment cubre todos los targets
    "JIN-SELF-008", // ninguna práctica declara selfCheck
    "JIN-SELF-009", // ninguna práctica de transferencia
    "JIN-ASM-010",  // assessment sin criteria
    "JIN-ASM-011",  // assessment sin product
  ];

  for (const code of expectedErrors) {
    assert.ok(codes.includes(code), `Se esperaba el código ${code} entre las incidencias: ${codes.join(", ")}`);
  }

  const errorCount = report.issues.filter(i => i.severity === "error").length;
  assert.ok(errorCount >= expectedErrors.length, `Se esperaban al menos ${expectedErrors.length} errores, hubo ${errorCount}`);
});

test("GOLDEN — corregir targetIds, campos de práctica estructurada y horas hace pasar la validación", () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const fixed = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));

  fixed.metadata.citationStyle = "apa";
  fixed.metadata.hours = 2; // 110 min planificados ≈ 91.7% de 120 min → dentro de 90-110%... ajustar abajo

  fixed.sections[0].route = ["Teoría del modelo relacional", "Diagnóstico de redundancia", "Evaluación de evolución histórica"];

  // Enseñanza para T3 y práctica/evaluación completas para los tres targets.
  fixed.sections[1].targetIds = ["T1", "T2", "T3"];
  fixed.sections[1].estimatedMinutes = 70;
  fixed.sections[2].targetIds = ["T1", "T2", "T3"];
  fixed.sections[2].workedExample = "Ejemplo resuelto paso a paso.";
  fixed.sections[2].successCriteria = ["Identifica al menos dos tablas redundantes."];
  fixed.sections[2].selfCheck = "Compara tu respuesta con la solución modelo.";
  fixed.sections[2].feedback = "Si no coincide, revisa las claves foráneas duplicadas.";
  fixed.sections[2].remediation = "Repite el ejercicio con el esquema simplificado.";
  fixed.sections[2].transfer = "Aplica el mismo diagnóstico a un esquema de tu propio proyecto.";
  fixed.sections[2].estimatedMinutes = 40;
  fixed.sections.push({
    type: "practice", id: "retencion", mode: "retrieval", targetIds: ["T1"],
    estimatedMinutes: 10, successCriteria: ["Recuerda sin apoyo la diferencia entre archivo y BD."],
    selfCheck: "Autoevalúa contra la definición de la teoría.",
  });
  fixed.sections[3].targetIds = ["T1", "T2", "T3"];
  fixed.sections[3].product = "Informe de 400-600 palabras.";
  fixed.sections[3].criteria = [{ description: "Cobertura histórica correcta", weight: 100 }];

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-golden-fixed-"));
  const tmpPath = path.join(tmpDir, "guide.json");
  fs.writeFileSync(tmpPath, JSON.stringify(fixed));
  try {
    const report = lintGuide(tmpPath);
    const errors = report.issues.filter(i => i.severity === "error");
    assert.equal(errors.length, 0, `No deberían quedar errores; quedaron: ${errors.map(e => `${e.rule}: ${e.message}`).join(" | ")}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("GOLDEN — JIN-ALN-017 dispara cuando un assessment precede a su propia enseñanza/práctica", () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const guide = {
    metadata: {
      course: "Test", week: 1, topic: "T", outcome: "O", hours: 1,
      targets: [{ id: "T1", verb: "x", description: "x" }],
    },
    sections: [
      { type: "orientation", id: "o", route: ["paso 1"] },
      { type: "assessment", id: "eval", targetIds: ["T1"], product: "p", criteria: [{ description: "c" }], estimatedMinutes: 10 },
      { type: "theory", id: "t", targetIds: ["T1"], content: "x {{cite:date2004}}", estimatedMinutes: 10 },
      { type: "practice", id: "p", targetIds: ["T1"], workedExample: "e", successCriteria: ["c"], selfCheck: "s", remediation: "r", estimatedMinutes: 10 },
    ],
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-order-"));
  const tmpPath = path.join(tmpDir, "guide.json");
  fs.writeFileSync(tmpPath, JSON.stringify(guide));
  try {
    const report = lintGuide(tmpPath);
    assert.ok(report.issues.some(i => i.rule === "JIN-ALN-017"), `Se esperaba JIN-ALN-017: ${report.issues.map(i => i.rule).join(", ")}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("GOLDEN — modo publish exige targets, horas y evidence.json (JIN-SCH-002/003, JIN-EVD-020)", () => {
  const fs = require("node:fs");
  const os = require("node:os");

  const noTargets = { metadata: { course: "T", week: 1, topic: "T", outcome: "O" }, sections: [{ type: "orientation", id: "o" }] };
  const tmpDir1 = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-publish-notargets-"));
  const tmpPath1 = path.join(tmpDir1, "guide.json");
  fs.writeFileSync(tmpPath1, JSON.stringify(noTargets));
  try {
    const report = lintGuide(tmpPath1, { mode: "publish" });
    assert.ok(report.issues.some(i => i.rule === "JIN-SCH-002"), "Sin metadata.targets, publish debe exigir JIN-SCH-002");
    assert.ok(report.issues.some(i => i.rule === "JIN-SCH-003"), "Sin metadata.hours, publish debe exigir JIN-SCH-003");
  } finally {
    fs.rmSync(tmpDir1, { recursive: true, force: true });
  }

  const noEvidence = {
    metadata: { course: "T", week: 1, topic: "T", outcome: "O", hours: 1, targets: [{ id: "T1", verb: "x", description: "x" }] },
    sections: [{ type: "orientation", id: "o", route: ["p"] }],
  };
  const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-publish-noevidence-"));
  const tmpPath2 = path.join(tmpDir2, "guide.json");
  fs.writeFileSync(tmpPath2, JSON.stringify(noEvidence));
  try {
    const report = lintGuide(tmpPath2, { mode: "publish" });
    assert.ok(report.issues.some(i => i.rule === "JIN-EVD-020"), "Con targets pero sin evidence.json, publish debe exigir JIN-EVD-020");
  } finally {
    fs.rmSync(tmpDir2, { recursive: true, force: true });
  }
});

test("GOLDEN — evidencia sin estructura real fuerza BLOCKED (JIN-EVD-017/018/019)", () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const guide = {
    metadata: { course: "T", week: 1, topic: "T", outcome: "O" },
    sections: [{ type: "theory", id: "t", claimIds: ["CLM-001", "CLM-002"] }],
  };
  const evidence = {
    week: 2, // mismatch deliberado con metadata.week=1 → JIN-EVD-019
    claims: [
      { id: "CLM-001", claim: "x", sourceMode: "notebook-primary" }, // sin evidence estructurada → JIN-EVD-017
      { id: "CLM-002", claim: "y", sourceMode: "local-fallback" },   // sin sourceId/sourceName → JIN-EVD-018
    ],
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-evd-structured-"));
  const tmpPath = path.join(tmpDir, "guide.json");
  fs.writeFileSync(tmpPath, JSON.stringify(guide));
  fs.writeFileSync(path.join(tmpDir, "evidence.json"), JSON.stringify(evidence));
  try {
    const report = lintGuide(tmpPath);
    const codes = report.issues.map(i => i.rule);
    assert.ok(codes.includes("JIN-EVD-017"), `Se esperaba JIN-EVD-017: ${codes.join(", ")}`);
    assert.ok(codes.includes("JIN-EVD-018"), `Se esperaba JIN-EVD-018: ${codes.join(", ")}`);
    assert.ok(codes.includes("JIN-EVD-019"), `Se esperaba JIN-EVD-019: ${codes.join(", ")}`);
    assert.equal(report.provenanceSummary.academicProvenance, "BLOCKED", "Sin evidencia estructurada real, no debe poder alcanzar STRONG/GOOD");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("GOLDEN — el puntaje de assessment que difiere del sílabo dispara JIN-ASM-013", () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-syllabus-cross-"));
  fs.writeFileSync(path.join(dir, "README.md"), [
    "# Curso", "",
    "**Asignatura:** X", "**Periodo académico ordinario:** 2026-A", "",
    "### Semana 01 — Tema", "",
    "**Unidad:** 1", "**Tema / contenido semanal:** Tema", "**Resultado de aprendizaje:** RA",
    "**Herramienta de aprendizaje:** Autor (2020)", "**Horas:** 4",
    "**Actividades calificadas:**", "- PE-1.1 — Informe — 2.25 puntos", "",
  ].join("\n"));
  const weekDir = path.join(dir, "semanas", "semana-01");
  require("node:fs").mkdirSync(weekDir, { recursive: true });
  const guide = {
    metadata: { course: "X", week: 1, topic: "T", outcome: "O", targets: [{ id: "T1", verb: "x", description: "x" }] },
    sections: [
      { type: "orientation", id: "o" },
      { type: "assessment", id: "e", code: "PE-1.1", targetIds: ["T1"], points: 4.0, product: "p", criteria: [{ description: "c" }] },
    ],
  };
  fs.writeFileSync(path.join(weekDir, "guide.json"), JSON.stringify(guide));
  try {
    const report = lintGuide(path.join(weekDir, "guide.json"));
    assert.ok(report.issues.some(i => i.rule === "JIN-ASM-013"), `Se esperaba JIN-ASM-013: ${report.issues.map(i => i.rule).join(", ")}`);
    assert.ok(report.issues.some(i => i.rule === "JIN-ASM-016"), `Se esperaba JIN-ASM-016: ${report.issues.map(i => i.rule).join(", ")}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
