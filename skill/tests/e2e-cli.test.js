"use strict";

/**
 * e2e-cli.test.js — Tests end-to-end que ejercitan la CLI completa
 *
 * Verifica que las compuertas de seguridad son inevitables desde la CLI:
 * - plan save sin --file → error
 * - plan save sin topic → error
 * - guide create sin plan aprobado → error
 * - Flujo completo: init → plan save → plan approve → guide create → guide finalize
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const fs     = require("node:fs");
const os     = require("node:os");
const path   = require("node:path");
const { spawnSync } = require("node:child_process");

const root     = path.resolve(__dirname, "..");
const cli      = path.join(root, "bin", "jintia.js");
const fixtures = path.join(__dirname, "fixtures");

function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    cwd: cwd || root,
    shell: false,
  });
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "jintia-e2e-"));
}

// Sílabo mínimo válido con semana 01 completa
const E2E_README = `# Bases de datos

**Asignatura:** Estructura, modelado y almacenamiento de bases de datos
**Código:** E2E01
**Periodo académico ordinario:** 2026-A

### Semana 01 — Introducción a bases de datos

**Unidad:** 1
**Tema / contenido semanal:** Enfoque de bases de datos vs. archivos
**Resultado de aprendizaje:** Diferenciar el enfoque de bases de datos del de archivos.
**Herramienta de aprendizaje:** Beynon-Davies (2018)
**Horas:** 4
**Actividades calificadas:** Ninguna
`;

// ─── Compuertas de CLI ────────────────────────────────────────────────────────

test("E2E-01 — plan save sin --file devuelve error y muestra ayuda", () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, "semanas"), { recursive: true });
    fs.mkdirSync(path.join(dir, "bibliografia"), { recursive: true });
    fs.writeFileSync(path.join(dir, "README.md"), E2E_README);

    const result = run(["plan", "save", dir, "01"]);

    assert.notEqual(result.status, 0, "plan save sin --file debe fallar");
    const output = (result.stdout || "") + (result.stderr || "");
    assert.match(output, /--file/i, "Debe mencionar --file en el mensaje de error");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("E2E-02 — plan save sin topic devuelve error de validación", () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, "semanas"), { recursive: true });
    fs.mkdirSync(path.join(dir, "bibliografia"), { recursive: true });
    fs.writeFileSync(path.join(dir, "README.md"), E2E_README);

    const planFile = path.join(dir, "plan-sin-topic.json");
    fs.writeFileSync(planFile, JSON.stringify({
      course: "TEST",
      evidence: [{ source: "Fuente", status: "verified", location: "README.md" }],
      missingEvidence: [],
    }));

    const result = run(["plan", "save", dir, "01", "--file", planFile]);
    assert.notEqual(result.status, 0, "plan save sin topic debe fallar");
    const output = (result.stdout || "") + (result.stderr || "");
    assert.match(output, /topic/i, "Debe mencionar 'topic' en el error");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("E2E-03 — guide create sin plan aprobado devuelve error", () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, "semanas"), { recursive: true });
    fs.writeFileSync(path.join(dir, "README.md"), E2E_README);

    const result = run(["guide", "create", dir, "01", "--input", path.join(fixtures, "guide-sample.json")]);
    assert.notEqual(result.status, 0, "guide create sin plan aprobado debe fallar");
    const output = (result.stdout || "") + (result.stderr || "");
    assert.match(output, /aprobado|plan/i, "Debe mencionar que el plan no está aprobado");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("E2E-04 — plan save sin evidencia verificada queda pending (ai-fallback ya no bloquea)", () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, "semanas"), { recursive: true });
    fs.mkdirSync(path.join(dir, "bibliografia"), { recursive: true });
    fs.writeFileSync(path.join(dir, "README.md"), E2E_README);

    const planFile = path.join(dir, "plan-ai-fallback.json");
    fs.writeFileSync(planFile, JSON.stringify({
      course: "TEST",
      topic: "Tema de prueba",
      evidence: [],
      missingEvidence: ["Beynon-Davies cap. 1"],
      provenance: "ai-fallback",
    }));

    const result = run(["plan", "save", dir, "01", "--file", planFile, "--json"]);
    assert.equal(result.status, 0, `plan save debe guardar el plan: ${result.stderr}`);
    const data = JSON.parse(result.stdout);
    assert.equal(data.state, "pending", "ai-fallback no debe bloquear el plan por falta de fuentes externas");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("E2E-05 — plan approve falla si la semana no existe en el sílabo (blocked curricular)", () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, "semanas"), { recursive: true });
    fs.mkdirSync(path.join(dir, "bibliografia"), { recursive: true });
    fs.writeFileSync(path.join(dir, "README.md"), E2E_README);

    const planFile = path.join(dir, "plan-inexistente.json");
    fs.writeFileSync(planFile, JSON.stringify({
      course: "TEST",
      topic: "Tema inexistente",
    }));

    // E2E_README solo declara la semana 01; la semana 09 no existe.
    run(["plan", "save", dir, "09", "--file", planFile]);
    const result = run(["plan", "approve", dir, "09", "--json"]);
    assert.notEqual(result.status, 0, "plan approve para una semana inexistente debe fallar");
    const data = JSON.parse(result.stdout);
    assert.equal(data.status, "error");
    assert.match(data.message, /no existe en el sílabo/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("E2E-06 — flujo completo: init → plan save → plan approve → guide create → guide finalize", () => {
  const dir = makeTempDir();
  try {
    // 1. Init
    const initResult = run(["init", dir, "--code", "E2E06", "--name", "Curso E2E"]);
    assert.equal(initResult.status, 0, `init falló: ${initResult.stderr}`);

    // 2. Escribir sílabo con semana 01 completa
    fs.writeFileSync(path.join(dir, "README.md"), E2E_README);

    // 3. Crear evidencia local (PDF en bibliografía)
    const biblioDir = path.join(dir, "bibliografia");
    fs.writeFileSync(path.join(biblioDir, "beynon-davies.pdf"), "dummy PDF content for test");

    // 4. plan save con evidencia verificada
    const planFile = path.join(dir, "plan-01.json");
    fs.writeFileSync(planFile, JSON.stringify({
      course: "Curso E2E",
      topic: "Enfoque de bases de datos vs. archivos",
      outcomes: { cognitive: "Diferenciar el enfoque de BD del de archivos" },
      evidence: [{ source: "Beynon-Davies (2018)", status: "verified", location: "bibliografia/beynon-davies.pdf" }],
      missingEvidence: [],
    }));

    const saveResult = run(["plan", "save", dir, "01", "--file", planFile, "--json"]);
    assert.equal(saveResult.status, 0, `plan save falló: ${saveResult.stderr}`);
    const saveData = JSON.parse(saveResult.stdout);
    assert.equal(saveData.state, "pending", `Plan con evidencia verificada debe estar en pending, obtenido: ${saveData.state}`);

    // 5. plan approve
    const approveResult = run(["plan", "approve", dir, "01", "--json"]);
    assert.equal(approveResult.status, 0,
      `plan approve falló: ${approveResult.stderr}\n${approveResult.stdout}`);

    // 6. guide create (usa guide-sample.json del fixture)
    const guideSample = path.join(fixtures, "guide-sample.json");
    const createResult = run(["guide", "create", dir, "01", "--input", guideSample]);
    assert.equal(createResult.status, 0, `guide create falló: ${createResult.stderr}`);

    const guidePath = path.join(dir, "semanas", "semana-01", "guide.json");
    assert.ok(fs.existsSync(guidePath), "guide.json debe existir en semanas/semana-01/");

    // 7. guide finalize
    const finalizeResult = run(["guide", "finalize", dir, "01"]);
    assert.equal(finalizeResult.status, 0, `guide finalize falló: ${finalizeResult.stderr}`);

    // 8. Verificar que el plan quedó en "generated"
    const { getPlan } = require("../runtime/core/plan-state");
    const record = getPlan(dir, 1);
    assert.ok(record, "El plan debe existir");
    assert.equal(record.status, "generated",
      `Plan debe estar en generated al finalizar, obtenido: ${record.status}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("E2E-07 — syllabus check valida semana específica", () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, "semanas"), { recursive: true });
    fs.writeFileSync(path.join(dir, "README.md"), E2E_README);

    // Semana que existe: semana 01
    const result01 = run(["syllabus", "check", dir, "01", "--json"]);
    assert.equal(result01.status, 0, `syllabus check semana 01 debe pasar: ${result01.stderr}`);
    const data01 = JSON.parse(result01.stdout);
    assert.equal(data01.found, true, "Semana 01 debe encontrarse en el sílabo");
    assert.equal(data01.status, "success");

    // Semana que NO existe: semana 99
    const result99 = run(["syllabus", "check", dir, "99", "--json"]);
    assert.notEqual(result99.status, 0, "syllabus check semana 99 debe fallar");
    const data99 = JSON.parse(result99.stdout);
    assert.equal(data99.found, false, "Semana 99 no debe encontrarse");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
