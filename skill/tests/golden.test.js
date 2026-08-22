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
