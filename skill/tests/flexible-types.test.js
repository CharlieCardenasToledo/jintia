"use strict";

/**
 * flexible-types.test.js — El schema no impone una plantilla fija.
 *
 * guide.schema.json no exige "exactamente 1 orientation + N theory + N
 * practice + 1 assessment" ni un orden entre tipos — eso nunca fue una
 * restricción técnica real, solo una convención. Este archivo prueba
 * explícitamente que los tipos "hermanos" (opening≈orientation,
 * case/comparison≈theory/concept, activity/reflection≈practice/scenario)
 * activan exactamente las mismas reglas pedagógicas (JIN-ALN-*, JIN-SELF-*,
 * JIN-CNT-003) que sus equivalentes clásicos, y que el renderer produce la
 * estructura HTML correspondiente sin necesitar los nombres originales.
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const fs     = require("node:fs");
const os     = require("node:os");
const path   = require("node:path");

const { lintGuide }   = require("../scripts/content-linter");
const { renderGuide } = require("../scripts/guide-renderer");

function tmpGuide(guide) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-flex-"));
  const guidePath = path.join(dir, "guide.json");
  fs.writeFileSync(guidePath, JSON.stringify(guide));
  return { dir, guidePath };
}

const FLEXIBLE_GUIDE = {
  metadata: {
    course: "Test", week: 1, topic: "Modelo ER", outcome: "Diferenciar entidad de atributo",
    hours: 1,
    targets: [{ id: "T1", verb: "diferenciar", description: "Diferenciar entidad de atributo." }],
  },
  sections: [
    { type: "opening", id: "o", route: ["Caso", "Comparación", "Actividad", "Evaluación"] },
    {
      type: "case", id: "caso-1", targetIds: ["T1"], estimatedMinutes: 15,
      content: "Una universidad registra estudiantes {{cite:date2004}}. ¿Qué es una entidad aquí?",
    },
    {
      type: "activity", id: "act-1", targetIds: ["T1"], mode: "guided", estimatedMinutes: 20,
      workedExample: "Ejemplo resuelto: Estudiante es entidad, nombre es atributo.",
      prompt: "Clasifica los siguientes términos.",
      successCriteria: ["Clasifica correctamente al menos 3 de 4 términos."],
      selfCheck: "Compara contra la solución modelo.",
      remediation: "Repite con el ejemplo simplificado.",
    },
    {
      type: "assessment", id: "eval-1", targetIds: ["T1"],
      product: "Lista de 5 términos clasificados.",
      criteria: [{ description: "Clasificación correcta", weight: 100 }],
      estimatedMinutes: 10,
    },
  ],
};

test("FLEXIBLE — opening/case/activity satisfacen las mismas reglas JIN-ALN/JIN-SELF que orientation/theory/practice", () => {
  const { dir, guidePath } = tmpGuide(FLEXIBLE_GUIDE);
  try {
    const report = lintGuide(guidePath);
    const errors = report.issues.filter(i => i.severity === "error");
    assert.deepEqual(errors, [], `no debería haber errores; hubo: ${errors.map(e => `${e.rule}: ${e.message}`).join(" | ")}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FLEXIBLE — JIN-CNT-003 acepta 'activity'/'reflection' como precedente válido de assessment (no exige literalmente 'practice'/'scenario')", () => {
  const guide = JSON.parse(JSON.stringify(FLEXIBLE_GUIDE));
  // Sin targets: aísla la comprobación de orden (JIN-CNT-003) de las reglas
  // de alineación (JIN-ALN-*), que exigen su propio contrato de targets.
  delete guide.metadata.targets;
  guide.sections.forEach(s => delete s.targetIds);
  const { dir, guidePath } = tmpGuide(guide);
  try {
    const report = lintGuide(guidePath);
    const codes = report.issues.map(i => i.rule);
    assert.ok(!codes.includes("JIN-CNT-003"), `no debería disparar JIN-CNT-003 con 'activity' precediendo a assessment: ${codes.join(", ")}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FLEXIBLE — quitar la enseñanza ('case') sigue dañando la alineación igual que quitar 'theory' (JIN-ALN-010)", () => {
  const guide = JSON.parse(JSON.stringify(FLEXIBLE_GUIDE));
  guide.sections = guide.sections.filter(s => s.type !== "case");
  const { dir, guidePath } = tmpGuide(guide);
  try {
    const report = lintGuide(guidePath);
    const codes = report.issues.map(i => i.rule);
    assert.ok(codes.includes("JIN-ALN-010"), `sin ninguna sección de enseñanza (ni 'theory' ni 'case'), debe seguir disparando JIN-ALN-010: ${codes.join(", ")}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("FLEXIBLE — el renderer produce la etiqueta y los campos estructurados correctos para los tipos alias", () => {
  const { dir, guidePath } = tmpGuide(FLEXIBLE_GUIDE);
  try {
    const html = renderGuide(guidePath);
    assert.ok(html.includes('class="jintia-block jintia-orientation"'), "opening debe renderizar con la clase de orientation");
    assert.ok(html.includes('class="jintia-block__label" aria-hidden="true">Apertura<'), "opening debe mostrar la etiqueta 'Apertura'");
    assert.ok(html.includes('class="jintia-block jintia-theory"'), "case debe renderizar con la clase de theory");
    assert.ok(html.includes('class="jintia-block__label" aria-hidden="true">Caso<'), "case debe mostrar la etiqueta 'Caso'");
    assert.ok(html.includes('class="jintia-block jintia-practice"'), "activity debe renderizar con la clase de practice");
    assert.ok(html.includes("jintia-practice__worked-example"), "activity debe renderizar el ejemplo trabajado igual que practice");
    assert.ok(html.includes("Ejemplo resuelto: Estudiante es entidad"), "el contenido del ejemplo trabajado debe estar presente");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
