"use strict";

/**
 * composable-ast.test.js — AST pedagógico verdaderamente componible.
 *
 * flexible-types.test.js prueba los ALIAS clásicos (opening/case/activity).
 * Este archivo prueba la capa siguiente: un `type` totalmente inventado por
 * la IA (no en ningún vocabulario reconocido), anclado en un `role`
 * explícito para seguir recibiendo validación pedagógica; composición vía
 * `children` (piezas semánticas anidables) como alternativa a los campos
 * planos (workedExample/prompt/etc.); y `content` como objeto estructurado
 * en vez de string/array.
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const fs     = require("node:fs");
const os     = require("node:os");
const path   = require("node:path");

const { validate: validateSchema } = require("../scripts/schema-validator");
const { lintGuide }   = require("../scripts/content-linter");
const { renderGuide } = require("../scripts/guide-renderer");
const { hasCapability } = require("../scripts/pedagogical-roles");

const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "schemas", "guide.schema.json"), "utf8"));

function tmpGuide(guide) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-ast-"));
  const guidePath = path.join(dir, "guide.json");
  fs.writeFileSync(guidePath, JSON.stringify(guide));
  return { dir, guidePath };
}

test("AST — un type inventado ('debate') con role='practice' explícito pasa el schema y recibe las reglas JIN-SELF vía children (sin ningún campo plano)", () => {
  const guide = {
    metadata: {
      course: "Test", week: 1, topic: "Argumentación", outcome: "Argumentar una postura con evidencia",
      hours: 1,
      targets: [{ id: "T1", verb: "argumentar", description: "Defender una postura con evidencia." }],
    },
    sections: [
      { type: "orientation", id: "o", route: ["Teoría", "Debate", "Evaluación"] },
      {
        type: "theory", id: "teoria-1", targetIds: ["T1"], estimatedMinutes: 25,
        content: "La normalización de bases de datos reduce la redundancia de la información almacenada.",
      },
      {
        type: "debate", role: "practice", id: "debate-1", targetIds: ["T1"], estimatedMinutes: 25,
        content: "Debate estructurado sobre normalización de bases de datos.",
        children: [
          { type: "example", content: "Ronda modelo: postura A vs postura B con evidencia citada." },
          { type: "prompt", content: "Defiende tu postura durante 3 minutos." },
          { type: "success-criteria", content: "Usa al menos 2 argumentos con evidencia." },
          { type: "feedback", content: "El moderador da retroalimentación tras cada ronda." },
          { type: "remediation", content: "Si no citas evidencia, repite la ronda con el ejemplo modelo." },
        ],
      },
      { type: "assessment", id: "eval-1", targetIds: ["T1"], product: "Registro de la ronda de debate.", criteria: [{ description: "Calidad argumentativa", weight: 100 }], estimatedMinutes: 10 },
    ],
  };

  const schemaErrors = validateSchema(guide, SCHEMA, "$", SCHEMA);
  assert.deepEqual(schemaErrors, [], `no debería haber errores de schema: ${schemaErrors.join(" | ")}`);

  const { dir, guidePath } = tmpGuide(guide);
  try {
    const report = lintGuide(guidePath);
    const errors = report.issues.filter(i => i.severity === "error");
    assert.deepEqual(errors, [], `no debería haber errores pedagógicos; hubo: ${errors.map(e => `${e.rule}: ${e.message}`).join(" | ")}`);
    // JIN-SELF-002 (workedExample) y JIN-SELF-004 (selfCheck/feedback) deben
    // quedar satisfechas por los children "example" y "feedback", no por
    // ningún campo plano — el nodo "debate" no declara workedExample ni feedback.
    const codes = report.issues.map(i => i.rule);
    assert.ok(!codes.includes("JIN-SELF-002"), "workedExample debe detectarse vía el child 'example'");
    assert.ok(!codes.includes("JIN-SELF-004"), "feedback debe detectarse vía el child 'feedback'");
    assert.ok(!codes.includes("JIN-CNT-006"), "con role explícito, 'debate' no debería disparar el aviso de type personalizado sin role");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("AST — un type inventado SIN role dispara JIN-CNT-006 (aviso, no error) y no bloquea el resto de la guía", () => {
  const guide = {
    metadata: { course: "Test", week: 1, topic: "T", outcome: "O" },
    sections: [
      { type: "orientation", route: ["a"] },
      { type: "timeline", content: "Cronología libre sin role declarado." },
    ],
  };
  const { dir, guidePath } = tmpGuide(guide);
  try {
    const report = lintGuide(guidePath);
    const timelineWarning = report.issues.find(i => i.rule === "JIN-CNT-006");
    assert.ok(timelineWarning, "debe emitir JIN-CNT-006 para el type personalizado sin role");
    assert.equal(timelineWarning.severity, "warning", "JIN-CNT-006 debe ser aviso, no error — un type personalizado es legítimo");
    assert.equal(report.summary.errors, 0, "un type personalizado sin role no debe producir errores bloqueantes");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("AST — el renderer no descarta un type completamente desconocido (antes producía solo un comentario HTML vacío)", () => {
  const guide = {
    metadata: { course: "Test", week: 1, topic: "T", outcome: "O" },
    sections: [
      { type: "orientation", route: ["a"] },
      { type: "timeline", id: "tl-1", title: "Cronología del proyecto", content: "1998: fundación. 2005: expansión." },
    ],
  };
  const { dir, guidePath } = tmpGuide(guide);
  try {
    const html = renderGuide(guidePath);
    assert.ok(html.includes('id="tl-1"'), "el nodo de type desconocido debe renderizar su contenido, no descartarse");
    assert.ok(html.includes("Cronología del proyecto"), "el título debe estar presente");
    assert.ok(html.includes("1998: fundación"), "el contenido debe estar presente");
    assert.ok(html.includes("Timeline"), "debe mostrar una etiqueta genérica humanizada derivada del type");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("AST — content como objeto estructurado se renderiza como lista de definición, no como '[object Object]'", () => {
  const guide = {
    metadata: { course: "Test", week: 1, topic: "T", outcome: "O" },
    sections: [
      { type: "orientation", route: ["a"] },
      { type: "concept", id: "c1", content: { question: "¿Qué es una entidad?", answer: "Un objeto del mundo real representable en el modelo." } },
    ],
  };
  const { dir, guidePath } = tmpGuide(guide);
  try {
    const html = renderGuide(guidePath);
    assert.ok(!html.includes("[object Object]"), "un content-objeto nunca debe colapsar a '[object Object]'");
    assert.ok(html.includes("jintia-structured-content"), "debe usar el render de contenido estructurado");
    assert.ok(html.includes("¿Qué es una entidad?"), "el valor de 'question' debe estar presente");
    assert.ok(html.includes("Un objeto del mundo real"), "el valor de 'answer' debe estar presente");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("AST — children anidados (piezas dentro de piezas) se renderizan recursivamente", () => {
  const guide = {
    metadata: { course: "Test", week: 1, topic: "T", outcome: "O" },
    sections: [
      { type: "orientation", route: ["a"] },
      {
        type: "case", id: "caso-1",
        children: [
          { type: "narrative", content: "Una empresa necesita registrar pedidos." },
          {
            type: "question", content: "¿Qué entidades identificas?",
            children: [{ type: "hint", content: "Piensa en los sustantivos del enunciado." }],
          },
        ],
      },
    ],
  };
  const { dir, guidePath } = tmpGuide(guide);
  try {
    const html = renderGuide(guidePath);
    assert.ok(html.includes("Una empresa necesita registrar pedidos"), "la narrativa de primer nivel debe renderizarse");
    assert.ok(html.includes("¿Qué entidades identificas?"), "la pregunta de primer nivel debe renderizarse");
    assert.ok(html.includes("Piensa en los sustantivos"), "la pista anidada dentro de la pregunta debe renderizarse");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("AST — hasCapability() busca en todo el subárbol de children, no solo en el primer nivel (activity > phase > feedback)", () => {
  const node = {
    type: "activity",
    children: [
      {
        type: "phase", content: "Fase 1: exploración",
        children: [{ type: "feedback", content: "Retroalimentación de la fase 1." }],
      },
    ],
  };
  assert.equal(
    hasCapability(node, "feedback", "feedback"), true,
    "un 'feedback' anidado dos niveles abajo (dentro de 'phase') debe contar igual que uno directo en children"
  );
  assert.equal(
    hasCapability(node, "remediation", "remediation"), false,
    "una capacidad realmente ausente en todo el subárbol debe seguir reportando false"
  );
});

test("AST — JIN-SELF-015 (steps, obligatorio en publish) se satisface con children de type 'step', sin el campo plano 'steps'", () => {
  const guide = {
    metadata: { course: "Test", week: 1, topic: "T", outcome: "O" },
    sections: [
      { type: "orientation", route: ["a"], purpose: "p", materials: ["m"], successCriteria: ["sc"], estimatedMinutes: 5 },
      {
        type: "practice", mode: "guided", prompt: "Consigna de la práctica.", workedExample: "Ejemplo modelo.",
        children: [
          { type: "step", content: "Primero identifica las entidades." },
          { type: "step", content: "Después identifica los atributos." },
        ],
      },
    ],
  };
  const { dir, guidePath } = tmpGuide(guide);
  try {
    const report = lintGuide(guidePath, { mode: "publish" });
    const codes = report.issues.map(i => i.rule);
    assert.ok(!codes.includes("JIN-SELF-015"), `'steps' vía children debería satisfacer JIN-SELF-015: ${codes.join(", ")}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
