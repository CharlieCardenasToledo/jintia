"use strict";

/**
 * regression.test.js — 7 escenarios de regresión basados en la interacción fallida
 *
 * Estos tests verifican que los fallos documentados en la interacción del
 * 2026-08-06 no puedan repetirse. Cada test corresponde a un escenario
 * descrito en el plan de actualización P0.
 */

const test    = require("node:test");
const assert  = require("node:assert/strict");
const fs      = require("node:fs");
const os      = require("node:os");
const path    = require("node:path");
const { spawnSync } = require("node:child_process");

const root     = path.resolve(__dirname, "..");
const cli      = path.join(root, "bin", "jintia.js");
const fixtures = path.join(__dirname, "fixtures");

const {
  parseSyllabus,
  serializeSyllabus,
  replaceWeek,
  validateSyllabus,
  safeUpdate,
  createBackup,
} = require("../runtime/core/syllabus-manager");

const { check: evidenceCheck, blockGenericKnowledge } = require("../runtime/core/evidence-gate");
const { savePlan, approvePlan, checkPlanApproved, getPlan } = require("../runtime/core/plan-state");

// ─── Helper ───────────────────────────────────────────────────────────────────

function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd: cwd || process.cwd(),
  });
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "jintia-reg-"));
}

function makeCourse(dir, { readme = null } = {}) {
  fs.mkdirSync(path.join(dir, "semanas"), { recursive: true });
  fs.mkdirSync(path.join(dir, "bibliografia"), { recursive: true });
  fs.mkdirSync(path.join(dir, "config"), { recursive: true });
  const readmePath = path.join(dir, "README.md");
  if (readme) fs.writeFileSync(readmePath, readme);
  return readmePath;
}

const MINIMAL_README = `# Bases de datos

**Asignatura:** Estructura, modelado y almacenamiento de bases de datos
**Código:** CC05A_IFT200
**Periodo académico ordinario:** 2026-A

### Semana 01 — Introducción a bases de datos

**Unidad:** 1
**Tema / contenido semanal:** Enfoque de bases de datos vs. archivos
**Resultado de aprendizaje:** Diferenciar el enfoque de bases de datos del enfoque de archivos.
**Herramienta de aprendizaje:** Beynon-Davies (2018)
**Horas:** 4
**Actividades calificadas:** Ninguna

---

### Semana 02 — Modelo relacional

**Unidad:** 1
**Tema / contenido semanal:** Esquemas relacionales y restricciones
**Resultado de aprendizaje:** Identificar relaciones, atributos y restricciones de integridad.
**Herramienta de aprendizaje:** Beynon-Davies (2018) cap. 3
**Horas:** 4
**Actividades calificadas:** [P1] Ejercicio relacional (20%)
`;

// ═══════════════════════════════════════════════════════════════════════════════
// Escenario 1: Inicialización limpia
// ═══════════════════════════════════════════════════════════════════════════════

test("R01 — init crea estructura sin contenido académico", () => {
  const dir = makeTempDir();

  const result = run(["init", dir, "--code", "TEST100", "--name", "Curso de Prueba"], dir);

  assert.equal(result.status, 0, `init falló:\n${result.stderr}\n${result.stdout}`);

  // Las tres carpetas deben existir
  assert.ok(fs.existsSync(path.join(dir, "semanas")),     "semanas/ debe existir");
  assert.ok(fs.existsSync(path.join(dir, "bibliografia")), "bibliografia/ debe existir");
  assert.ok(fs.existsSync(path.join(dir, "config")),      "config/ debe existir");

  // README.md debe existir pero SIN semanas académicas
  const readmePath = path.join(dir, "README.md");
  assert.ok(fs.existsSync(readmePath), "README.md debe existir");

  const content = fs.readFileSync(readmePath, "utf8");
  assert.doesNotMatch(content, /### Semana \d/i, "init no debe crear secciones de semana");
  assert.doesNotMatch(content, /Resultado de aprendizaje/i, "init no debe crear resultados de aprendizaje");
  assert.doesNotMatch(content, /Actividades calificadas/i, "init no debe crear actividades");

  // No debe haber archivos LaTeX
  const allFiles = fs.readdirSync(dir, { recursive: true });
  const latexFiles = allFiles.filter(f => String(f).endsWith(".tex") || String(f).includes("latex"));
  assert.equal(latexFiles.length, 0, `init no debe crear archivos LaTeX: ${latexFiles.join(", ")}`);

  fs.rmSync(dir, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Escenario 2: No inventar sílabo
// ═══════════════════════════════════════════════════════════════════════════════

test("R02 — syllabus-manager no inventa semanas: replaceWeek solo agrega la semana indicada", () => {
  const dir = makeTempDir();
  const readme = makeCourse(dir, { readme: MINIMAL_README });

  // parsear + verificar que solo hay 2 semanas originales
  const model = parseSyllabus(fs.readFileSync(readme, "utf8"));
  assert.equal(model.weeks.length, 2, "El sílabo de prueba tiene 2 semanas");

  // Añadir una sola semana nueva
  const updated = replaceWeek({ ...model, weeks: [...model.weeks] }, 3, `### Semana 03 — Semana nueva

**Unidad:** 2
**Tema / contenido semanal:** Contenido
**Resultado de aprendizaje:** Resultado
**Herramienta de aprendizaje:** Fuente
**Horas:** 4
**Actividades calificadas:** Ninguna`);

  // Solo debe haber 3 semanas (la nueva) — no se inventaron otras
  assert.equal(updated.weeks.length, 3, "replaceWeek agrega exactamente una semana nueva");

  // La semana 03 es la recién añadida
  const week3 = updated.weeks.find(w => w.number === 3);
  assert.ok(week3, "La semana 03 debe existir en el modelo");

  // No deben haberse creado semanas 04..08 automáticamente
  const extraWeeks = updated.weeks.filter(w => w.number > 3);
  assert.equal(extraWeeks.length, 0, `No deben existir semanas por encima de 03: ${extraWeeks.map(w => w.number).join(", ")}`);

  fs.rmSync(dir, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Escenario 3: Actualización sin duplicados
// ═══════════════════════════════════════════════════════════════════════════════

test("R03 — replaceWeek elimina duplicados al reemplazar una semana", () => {
  const DUPLICATED = `# Curso con duplicados

**Asignatura:** Bases de datos
**Periodo académico ordinario:** 2026-A

### Semana 01 — Versión A

**Unidad:** 1
**Tema / contenido semanal:** Tema original
**Resultado de aprendizaje:** Resultado original
**Herramienta de aprendizaje:** Fuente A
**Horas:** 4
**Actividades calificadas:** Ninguna

---

### Semana 01 — Versión B (duplicado)

**Unidad:** 1
**Tema / contenido semanal:** Tema duplicado
**Resultado de aprendizaje:** Resultado duplicado
**Herramienta de aprendizaje:** Fuente B
**Horas:** 4
**Actividades calificadas:** Ninguna
`;

  const model = parseSyllabus(DUPLICATED);
  // parseSyllabus puede devolver dos entradas semana 01
  const originalCount = model.weeks.filter(w => w.number === 1).length;

  // Reemplazar la semana 01 → debe quedar solo una
  const newWeek = `### Semana 01 — Versión corregida

**Unidad:** 1
**Tema / contenido semanal:** Tema definitivo
**Resultado de aprendizaje:** Resultado definitivo
**Herramienta de aprendizaje:** Fuente definitiva
**Horas:** 4
**Actividades calificadas:** Ninguna`;

  const updated = replaceWeek(model, 1, newWeek);
  const count01 = updated.weeks.filter(w => w.number === 1).length;
  assert.equal(count01, 1, `Después de replaceWeek debe haber exactamente 1 Semana 01, encontradas: ${count01}`);
});

test("R03b — validateSyllabus detecta semanas duplicadas", () => {
  const DUPLICATED = MINIMAL_README.replace("### Semana 02", "### Semana 01");
  const { valid, errors } = validateSyllabus(DUPLICATED);
  assert.equal(valid, false, "Un sílabo con semanas duplicadas debe fallar la validación");
  const dupeError = errors.find(e => /duplicad/i.test(e));
  assert.ok(dupeError, `Debe reportar semanas duplicadas, errores: ${JSON.stringify(errors)}`);
});

test("R03c — validateSyllabus detecta Ninguna coexistiendo con actividades en misma línea", () => {
  const CONFLICTED = `# Curso

**Asignatura:** Test
**Periodo académico ordinario:** 2026-A

### Semana 01 — Test

**Unidad:** 1
**Tema / contenido semanal:** Tema
**Resultado de aprendizaje:** Resultado
**Herramienta de aprendizaje:** Fuente
**Horas:** 4
**Actividades calificadas:** Ninguna [P1] Foro (10%)
`;
  const { valid, errors } = validateSyllabus(CONFLICTED);
  assert.equal(valid, false,
    `Un sílabo con Ninguna + actividad real en la misma línea debe ser inválido. Errores: ${errors.join("; ")}`);
  assert.ok(
    errors.some(e => /ninguna/i.test(e)),
    `Debe reportar el conflicto de Ninguna. Errores encontrados: ${errors.join(", ")}`
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Escenario 4: NotebookLM falla → fallback a ai-fallback (JIN-EVD-001 / JIN-EVD-003)
// ═══════════════════════════════════════════════════════════════════════════════

// README vacío de fuentes para probar bloqueo estricto de evidencia
const README_NO_SOURCES = `# Curso sin fuentes

**Asignatura:** Curso de prueba sin fuentes
**Periodo académico ordinario:** 2026-A

### Semana 01 — Tema

**Unidad:** 1
**Tema / contenido semanal:** Tema de prueba
**Resultado de aprendizaje:** Resultado de prueba
**Herramienta de aprendizaje:**
**Horas:** 4
**Actividades calificadas:** Ninguna
`;

test("R04 — evidence-gate continúa con ai-fallback (JIN-EVD-003) cuando NotebookLM falla y no hay fuentes locales", () => {
  const dir = makeTempDir();
  // README sin fuentes declaradas y sin archivos en bibliografía/semanas
  makeCourse(dir, { readme: README_NO_SOURCES });

  // Sin fuentes locales y NotebookLM caído
  const result = evidenceCheck({
    courseRoot:  dir,
    weekNumber:  1,
    notebookLM:  { configured: true, available: false, reason: "BROWSER_CRASHED" },
  });

  assert.equal(result.allowed, true, "Ya no debe bloquear: debe continuar con procedencia ai-fallback");
  assert.equal(result.provenance, "ai-fallback", `Procedencia esperada ai-fallback, recibida: ${result.provenance}`);
  assert.equal(result.code, "JIN-EVD-003", `Código esperado JIN-EVD-003, recibido: ${result.code}`);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("R04b — evidence-gate continúa con ai-fallback (JIN-EVD-001) cuando no hay ninguna fuente", () => {
  const dir = makeTempDir();
  // README sin fuentes declaradas y sin archivos en bibliografía/semanas
  makeCourse(dir, { readme: README_NO_SOURCES });

  const result = evidenceCheck({
    courseRoot:  dir,
    weekNumber:  1,
    notebookLM:  { configured: false, available: false },
  });

  assert.equal(result.allowed, true, "Ya no debe bloquear: debe continuar con procedencia ai-fallback");
  assert.equal(result.provenance, "ai-fallback", `Procedencia esperada ai-fallback, recibida: ${result.provenance}`);
  assert.equal(result.code, "JIN-EVD-001", `Código esperado JIN-EVD-001, recibido: ${result.code}`);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("R04c — blockGenericKnowledge siempre devuelve JIN-EVD-002", () => {
  const result = blockGenericKnowledge();
  assert.equal(result.allowed, false, "blockGenericKnowledge siempre bloquea");
  assert.equal(result.code, "JIN-EVD-002");
});

// ═══════════════════════════════════════════════════════════════════════════════
// Escenario 5: Prohibición de LaTeX en rutas activas
// ═══════════════════════════════════════════════════════════════════════════════

test("R05 — init no crea carpetas ni archivos LaTeX", () => {
  const dir = makeTempDir();
  run(["init", dir, "--code", "TEST100", "--name", "Prueba"], dir);

  function findLatex(base) {
    const entries = fs.readdirSync(base, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(base, e.name);
      if (e.isDirectory()) {
        if (e.name === "latex") return full;
        const nested = findLatex(full);
        if (nested) return nested;
      } else if (e.name.endsWith(".tex")) {
        return full;
      }
    }
    return null;
  }

  const found = findLatex(dir);
  assert.equal(found, null, `init no debe crear archivos/carpetas LaTeX: ${found}`);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("R05b — plan-state solo declara guide.json, reference.bib y figure/ como archivos planeados", () => {
  const dir = makeTempDir();
  makeCourse(dir, { readme: MINIMAL_README });

  const file = savePlan(dir, 1, {
    course: "TEST",
    topic:  "Tema de prueba",
    missingEvidence: [],
  });

  const record = getPlan(dir, 1);
  assert.ok(record, "El plan debe guardarse");

  const hasLatex = record.plannedFiles.some(f => /latex|\.tex/.test(f));
  assert.equal(hasLatex, false, `Los archivos planeados no deben incluir LaTeX: ${JSON.stringify(record.plannedFiles)}`);

  const expectedFiles = [`semanas/semana-01/guide.json`, `semanas/semana-01/reference.bib`];
  for (const expected of expectedFiles) {
    assert.ok(
      record.plannedFiles.some(f => f.includes(expected.replace(/\//g, path.sep)) || f.includes(expected)),
      `plannedFiles debe incluir ${expected}`
    );
  }

  fs.rmSync(dir, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Escenario 6: Comando por harness
// ═══════════════════════════════════════════════════════════════════════════════

test("R06 — guide sin plan aprobado informa el problema", () => {
  const dir = makeTempDir();
  makeCourse(dir, { readme: MINIMAL_README });

  // No hay .jintia-plan.json → checkPlanApproved debe retornar approved: false
  const check = checkPlanApproved(dir, 1);
  assert.equal(check.approved, false, "Sin plan guardado, approved debe ser false");
  assert.match(check.message, /No existe plan|plan.*aprobad/i,
    `Mensaje debe mencionar que no existe plan o que no está aprobado: ${check.message}`);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("R06b — plan en estado pending NO permite guide", () => {
  const dir = makeTempDir();
  makeCourse(dir, { readme: MINIMAL_README });

  // Evidence verificada → plan queda en "pending", no "blocked"
  savePlan(dir, 1, {
    course: "TEST",
    topic:  "Tema",
    evidence: [{ source: "Beynon-Davies (2018)", status: "verified", location: "README.md" }],
    missingEvidence: [],
  });

  const check = checkPlanApproved(dir, 1);
  assert.equal(check.approved, false, "Un plan en pending no debe permitir guide");
  assert.equal(check.status, "pending", `Estado esperado: pending, obtenido: ${check.status}`);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("R06c — plan aprobado permite guide", () => {
  const dir = makeTempDir();
  makeCourse(dir, { readme: MINIMAL_README });

  // Evidence verificada → pending; approvePlan re-verifica evidencia y semana
  savePlan(dir, 1, {
    course: "TEST",
    topic:  "Tema",
    evidence: [{ source: "Beynon-Davies (2018)", status: "verified", location: "README.md" }],
    missingEvidence: [],
  });
  const approval = approvePlan(dir, 1);
  assert.ok(approval.ok, `approvePlan debe tener éxito: ${approval.message}`);

  const check = checkPlanApproved(dir, 1);
  assert.equal(check.approved, true, "Un plan aprobado debe permitir guide");

  fs.rmSync(dir, { recursive: true, force: true });
});

test("R06d — ai-fallback (missingEvidence) ya no bloquea el plan por sí solo", () => {
  const dir = makeTempDir();
  makeCourse(dir, { readme: MINIMAL_README });

  // Sin fuentes verificadas y con evidencia faltante: evidence-gate.js
  // garantiza ai-fallback como último recurso, así que el plan debe quedar
  // en "pending" (aprobable), no "blocked".
  savePlan(dir, 1, {
    course:          "TEST",
    topic:           "Tema",
    missingEvidence: ["Material ASU IFT-200 Module 1"],
    provenance:      "ai-fallback",
  });

  const record = getPlan(dir, 1);
  assert.equal(record.status, "pending", "ai-fallback no debe bloquear el plan por falta de fuentes externas");
  assert.equal(record.provenance, "ai-fallback");

  const approval = approvePlan(dir, 1);
  assert.ok(approval.ok, `Un plan con ai-fallback debe poder aprobarse: ${approval.message}`);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("R06e — blocked queda reservado para contrato curricular irresoluble (semana inexistente)", () => {
  const dir = makeTempDir();
  makeCourse(dir, { readme: MINIMAL_README });

  // MINIMAL_README solo declara las semanas 1 y 2; pedir aprobación de la
  // semana 9 debe bloquear en approvePlan() por semana inexistente, no por
  // evidencia.
  savePlan(dir, 9, {
    course: "TEST",
    topic:  "Tema inexistente",
  });

  const approval = approvePlan(dir, 9);
  assert.equal(approval.ok, false, "No se puede aprobar un plan para una semana que no existe en el sílabo");
  assert.match(approval.message, /no existe en el sílabo/i);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("R06f — plan con targets no puede aprobarse si la matriz de alineación está incompleta", () => {
  const dir = makeTempDir();
  makeCourse(dir, { readme: MINIMAL_README });

  savePlan(dir, 1, {
    course: "TEST",
    topic: "Tema",
    targets: [{ id: "T1", verb: "x", description: "x" }, { id: "T2", verb: "y", description: "y" }],
    // T2 no aparece en la matriz → incompleta
    alignmentMatrix: [
      { targetId: "T1", teaching: true, practice: true, feedback: true, assessment: true, evidence: true },
    ],
  });

  const approval = approvePlan(dir, 1);
  assert.equal(approval.ok, false, "No se puede aprobar con la matriz de alineación incompleta");
  assert.match(approval.message, /matriz de alineación/i);
  assert.match(approval.message, /T2/);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("R06g — plan con targets se aprueba cuando la matriz de alineación cubre las 5 dimensiones", () => {
  const dir = makeTempDir();
  makeCourse(dir, { readme: MINIMAL_README });

  savePlan(dir, 1, {
    course: "TEST",
    topic: "Tema",
    targets: [{ id: "T1", verb: "x", description: "x" }],
    alignmentMatrix: [
      { targetId: "T1", teaching: true, practice: true, feedback: true, assessment: true, evidence: true },
    ],
  });

  const approval = approvePlan(dir, 1);
  assert.ok(approval.ok, `Plan con matriz completa debe aprobarse: ${approval.message}`);

  fs.rmSync(dir, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Escenario 7: Pipeline editorial (validate → render → preflight)
// ═══════════════════════════════════════════════════════════════════════════════

test("R07 — validate pasa con guide-sample.json del fixture", () => {
  const result = run(["validate", path.join(fixtures, "guide-sample.json"), "--json"]);
  assert.equal(result.status, 0, `validate falló:\n${result.stderr}\n${result.stdout}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "success", `Errores: ${JSON.stringify(report.errors)}`);
});

test("R07b — render produce guide.html a partir de guide-sample.json", () => {
  const dir       = makeTempDir();
  const guideJson = path.join(dir, "guide.json");
  const guideHtml = path.join(dir, "guide.html");

  fs.cpSync(path.join(fixtures, "guide-sample.json"), guideJson);

  const result = run(["render", guideJson, "--output", guideHtml], dir);
  assert.equal(result.status, 0, `render falló:\n${result.stderr}`);
  assert.ok(fs.existsSync(guideHtml), "guide.html debe existir");

  const html = fs.readFileSync(guideHtml, "utf8");
  assert.doesNotMatch(html, /\\documentclass/i, "HTML no debe contener LaTeX");
  assert.doesNotMatch(html, /\\begin\{document\}/i, "HTML no debe contener entorno document de LaTeX");
  assert.match(html, /<!DOCTYPE html>/i, "HTML debe comenzar con DOCTYPE");

  fs.rmSync(dir, { recursive: true, force: true });
});

test("R07c — createBackup genera archivo con timestamp antes de editar", () => {
  const dir  = makeTempDir();
  const file = path.join(dir, "README.md");
  fs.writeFileSync(file, "# Contenido original\n");

  const backup = createBackup(file);
  assert.ok(backup, "createBackup debe retornar la ruta del respaldo");
  assert.ok(fs.existsSync(backup), "El archivo de respaldo debe existir");
  assert.match(path.basename(backup), /README\.md\.bak-\d{8}-\d{6}/,
    `El nombre del respaldo debe incluir timestamp: ${path.basename(backup)}`);

  const originalContent = fs.readFileSync(file, "utf8");
  const backupContent   = fs.readFileSync(backup, "utf8");
  assert.equal(backupContent, originalContent, "El respaldo debe tener el mismo contenido que el original");

  fs.rmSync(dir, { recursive: true, force: true });
});

test("R07d — safeUpdate restaura respaldo si la validación falla", () => {
  const dir      = makeTempDir();
  const readme   = path.join(dir, "README.md");
  const original = "# Curso original\n\n**Asignatura:** Test\n";
  fs.writeFileSync(readme, original);

  // Intentar actualizar con markdown inválido (sin campos canónicos)
  const result = safeUpdate(readme, {
    weekNumber:   1,
    weekMarkdown: "### Semana 01\n\n(sin campos canónicos)",
  });

  // El sílabo original no tenía los campos requeridos → debe fallar
  // Verificar que el archivo sigue siendo el original
  const current = fs.readFileSync(readme, "utf8");
  assert.equal(current, original, "safeUpdate debe restaurar el contenido original si falla");
  assert.equal(result.ok, false, "safeUpdate debe indicar fallo");
  assert.ok(result.errors && result.errors.length > 0, "safeUpdate debe reportar errores");

  fs.rmSync(dir, { recursive: true, force: true });
});
